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
import { cn } from "@/lib/utils/cn";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuthStore();
    const router = useRouter();
    const { isLoading: isFetching } = useMe();
    const { tenant } = useTenantStore();
    const queryClient = useQueryClient();

    const layoutStudent = (tenant?.branding as any)?.layout_student || "sidebar";

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

    return (
        <div className="bg-background min-h-screen">

            {/* ══════════════════════════════════════════════════════
                MOBILE (< lg): SEMPRE minimal — puro CSS, zero JS
                Funciona desde o primeiro render do servidor.
            ══════════════════════════════════════════════════════ */}
            <div className="block lg:hidden">
                <StudentMinimalNav />
            </div>

            {/* ══════════════════════════════════════════════════════
                DESKTOP (>= lg): layout configurado pelo produtor
            ══════════════════════════════════════════════════════ */}

            {/* Sidebar desktop */}
            {layoutStudent === "sidebar" && (
                <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 border-r border-border bg-card z-30">
                    <StudentSidebar desktopOnly />
                </aside>
            )}

            {/* Topbar desktop */}
            {layoutStudent === "topbar" && (
                <div className="hidden lg:block">
                    <StudentTopbar />
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                CONTEÚDO — renderizado UMA VEZ, padding via CSS
            ══════════════════════════════════════════════════════ */}
            <main className={cn(
                // Mobile: espaço para topbar fixo + dock inferior
                "pt-12 pb-28 min-h-screen",
                // Desktop overrides por layout
                layoutStudent === "sidebar" && "lg:pt-0 lg:pb-0 lg:ml-64 lg:flex lg:flex-col",
                layoutStudent === "topbar" && "lg:pt-14 lg:pb-0",
                layoutStudent === "minimal" && "lg:pt-0 lg:pb-28",
            )}>
                {/* TopBar interna — só no sidebar desktop */}
                {layoutStudent === "sidebar" && (
                    <div className="hidden lg:block">
                        <TopBar />
                    </div>
                )}
                <div className={cn(
                    "p-6 max-w-7xl mx-auto",
                    layoutStudent === "sidebar" && "lg:flex-1 lg:overflow-y-auto",
                )}>
                    {children}
                </div>
            </main>

            <FloatingCoachWidget />
            {showTour && <OnboardingTour onComplete={() => setShowTour(false)} />}
        </div>
    );
}