// frontend/src/components/layout/StudentLayout.tsx
// Layout wrapper dinâmico: escolhe sidebar | topbar | minimal com base no branding.

"use client";

import { useAppearance } from "@/lib/hooks/useAppearance";
import { StudentSidebar } from "./StudentSidebar";
import { StudentTopbar } from "./StudentTopbar";
import { StudentMinimalNav } from "./StudentMinimalNav";

interface StudentLayoutProps {
    children: React.ReactNode;
}

export function StudentLayout({ children }: StudentLayoutProps) {
    const { layoutStudent } = useAppearance();

    if (layoutStudent === "topbar") {
        return (
            <div className="min-h-screen bg-background">
                <StudentTopbar />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                    {children}
                </main>
            </div>
        );
    }

    if (layoutStudent === "minimal") {
        return (
            <div className="min-h-screen bg-background">
                <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-28">
                    {children}
                </main>
                <StudentMinimalNav />
            </div>
        );
    }

    // Default: sidebar (layout atual)
    return (
        <div className="flex h-screen bg-background overflow-hidden">
            <StudentSidebar />
            <main className="flex-1 overflow-y-auto">
                <div className="p-6 max-w-5xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}