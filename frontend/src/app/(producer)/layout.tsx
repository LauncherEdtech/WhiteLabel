// frontend/src/app/(producer)/layout.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProducerSidebar } from "@/components/layout/ProducerSidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useAuthStore } from "@/lib/stores/authStore";
import { useMe } from "@/lib/hooks/useAuth";

export default function ProducerLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuthStore();
    const router = useRouter();
    const { isLoading: isFetching } = useMe();

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