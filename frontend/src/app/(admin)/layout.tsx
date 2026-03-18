// frontend/src/app/(admin)/layout.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/authStore";
import { useMe } from "@/lib/hooks/useAuth";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { TopBar } from "@/components/layout/TopBar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user } = useAuthStore();
    const router = useRouter();
    useMe();

    useEffect(() => {
        if (user && user.role !== "super_admin") {
            router.replace("/dashboard");
        }
    }, [user, router]);

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            <AdminSidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <TopBar />
                <main className="flex-1 overflow-y-auto">
                    <div className="p-6 max-w-7xl mx-auto">{children}</div>
                </main>
            </div>
        </div>
    );
}