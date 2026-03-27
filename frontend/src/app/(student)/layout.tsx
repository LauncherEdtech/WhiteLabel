// frontend/src/app/(student)/layout.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/authStore";
import { useMe } from "@/lib/hooks/useAuth";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { StudentSidebar } from "@/components/layout/StudentSidebar";
import { StudentTopbar } from "@/components/layout/StudentTopbar";
import { StudentMinimalNav } from "@/components/layout/StudentMinimalNav";
import { TopBar } from "@/components/layout/TopBar";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuthStore();
    const router = useRouter();
    const { isLoading: isFetching } = useMe();
    const { tenant } = useTenantStore();

    // Lê o layout salvo no branding do tenant
    const layoutStudent = (tenant?.branding as any)?.layout_student || "sidebar";

    useEffect(() => {
        if (!isLoading && !isFetching && user) {
            if (user.role !== "student") {
                router.replace("/producer/dashboard");
            }
        }
    }, [user, isLoading, isFetching, router]);

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
    if (layoutStudent === "topbar") {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <StudentTopbar />
                <main className="flex-1 overflow-y-auto">
                    <div className="p-6 max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        );
    }

    // ── Layout: Dock minimal ──────────────────────────────────────────────────
    if (layoutStudent === "minimal") {
        return (
            <div className="min-h-screen bg-background">
                <main className="pb-28">
                    <div className="p-6 max-w-5xl mx-auto">
                        {children}
                    </div>
                </main>
                <StudentMinimalNav />
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
        </div>
    );
}