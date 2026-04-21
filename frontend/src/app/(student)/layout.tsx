// frontend/src/app/(student)/layout.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/authStore";
import { useMe } from "@/lib/hooks/useAuth";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { StudentSidebar } from "@/components/layout/StudentSidebar";
import { StudentTopbar } from "@/components/layout/StudentTopbar";
import { StudentMinimalNav } from "@/components/layout/StudentMinimalNav";
import { TopBar } from "@/components/layout/TopBar";
import { FloatingCoachWidget } from "@/components/student/FloatingCoachWidget";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { useOnboarding } from "@/lib/hooks/useOnboarding";
import { FloatingSupportButton } from "@/components/shared/FloatingSupportButton";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuthStore();
    const router = useRouter();
    const { isLoading: isFetching } = useMe();
    const { tenant } = useTenantStore();
    const queryClient = useQueryClient();

    const layoutStudent = (tenant?.branding as any)?.layout_student || "sidebar";

    // Detecta mobile (< 1024px = breakpoint lg do Tailwind)
    // Com o viewport meta tag, window.innerWidth retorna o valor real do device
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 1024);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    // Mobile sempre usa minimal — desktop respeita configuração do produtor
    const effectiveLayout = isMobile ? "minimal" : layoutStudent;

    // Onboarding
    const { needsOnboarding } = useOnboarding();
    const [showTour, setShowTour] = useState(false);

    useEffect(() => {
        if (needsOnboarding && !isLoading && !isFetching) {
            const t = setTimeout(() => setShowTour(true), 500);
            return () => clearTimeout(t);
        }
    }, [needsOnboarding, isLoading, isFetching]);

    useEffect(() => {
        if (!isLoading && !isFetching && user) {
            if (user.role !== "student") {
                router.replace("/producer/dashboard");
            }
        }
    }, [user, isLoading, isFetching, router]);

    // Prefetch silencioso dos dados mais usados
    useEffect(() => {
        if (!user) return;
        queryClient.prefetchQuery({
            queryKey: ["student-dashboard"],
            queryFn: () => apiClient.get("/analytics/student/dashboard").then(r => r.data),
            staleTime: 5 * 60 * 1000,
        });
        queryClient.prefetchQuery({
            queryKey: ["courses"],
            queryFn: () => apiClient.get("/courses/").then(r => r.data),
            staleTime: 5 * 60 * 1000,
        });
        queryClient.prefetchQuery({
            queryKey: ["next-action"],
            queryFn: () => apiClient.get("/analytics/student/next-action").then(r => r.data),
            staleTime: 15 * 60 * 1000,
        });
    }, [user]);

    if (isLoading || isFetching) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    <p className="text-sm text-muted-foreground">Carregando...</p>
                </div>
            </div>
        );
    }

    // ── Layout: Barra superior ────────────────────────────────────────────────
    if (effectiveLayout === "topbar") {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <StudentTopbar />
                <main className="flex-1 overflow-y-auto">
                    <div className="p-6 max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
                <FloatingCoachWidget />
                <FloatingSupportButton />
                {showTour && <OnboardingTour onComplete={() => setShowTour(false)} />}
            </div>
        );
    }

    // ── Layout: Dock minimal ──────────────────────────────────────────────────
    if (effectiveLayout === "minimal") {
        return (
            <div className="min-h-screen bg-background">
                <main className="pt-12 pb-28">
                    <div className="p-6 max-w-5xl mx-auto">
                        {children}
                    </div>
                </main>
                <StudentMinimalNav />
                <FloatingCoachWidget />
                <FloatingSupportButton />
                {showTour && <OnboardingTour onComplete={() => setShowTour(false)} />}
            </div>
        );
    }

    // ── Layout: Sidebar (padrão) ──────────────────────────────────────────────
    return (
        <div className="flex h-screen bg-background overflow-hidden">
            <StudentSidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <TopBar />
                <main className="flex-1 overflow-y-auto">
                    <div className="p-6 max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
            <FloatingCoachWidget />
            <FloatingSupportButton />
            {showTour && <OnboardingTour onComplete={() => setShowTour(false)} />}
        </div>
    );
}