// frontend/src/app/(producer)/layout.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/authStore";
import { useMe } from "@/lib/hooks/useAuth";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { ProducerSidebar } from "@/components/layout/ProducerSidebar";
import { ProducerTopbar } from "@/components/layout/ProducerTopbar";
import { TopBar } from "@/components/layout/TopBar";

export default function ProducerLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuthStore();
    const router = useRouter();
    const { isLoading: isFetching } = useMe();
    const { tenant } = useTenantStore();

    // Lê o layout salvo no branding do tenant
    const layoutProducer = (tenant?.branding as any)?.layout_producer || "sidebar";

    useEffect(() => {
        if (!isLoading && !isFetching && user) {
            if (user.role === "student") {
                router.replace("/dashboard");
            }
        }
    }, [user, isLoading, isFetching, router]);

    if (isLoading || isFetching) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
        );
    }

    // ── Layout: Barra superior ────────────────────────────────────────────────
    if (layoutProducer === "topbar") {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <ProducerTopbar />
                <main className="flex-1 overflow-y-auto">
                    <div className="p-6 max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        );
    }

    // ── Layout: Sidebar (padrão) ──────────────────────────────────────────────
    return (
        <div className="flex h-screen bg-background overflow-hidden">
            <ProducerSidebar />
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