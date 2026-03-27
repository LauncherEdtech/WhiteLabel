// frontend/src/components/layout/StudentMinimalNav.tsx
// Layout "minimal" — navegação discreta como dock flutuante na parte inferior.
// Visual clean e focado no conteúdo.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard, BookOpen, HelpCircle,
    ClipboardList, Calendar, BarChart3, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useLogout } from "@/lib/hooks/useAuth";

const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Início" },
    { href: "/courses", icon: BookOpen, label: "Cursos" },
    { href: "/questions", icon: HelpCircle, label: "Questões" },
    { href: "/simulados", icon: ClipboardList, label: "Simulados" },
    { href: "/schedule", icon: Calendar, label: "Agenda" },
    { href: "/analytics", icon: BarChart3, label: "Stats" },
];

export function StudentMinimalNav() {
    const pathname = usePathname();
    const logout = useLogout();

    return (
        <>
            {/* Dock flutuante na parte inferior */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                <nav
                    className={cn(
                        "flex items-center gap-1 px-3 py-2 rounded-2xl",
                        "bg-card/90 backdrop-blur-xl border border-border",
                        "shadow-2xl shadow-black/20"
                    )}
                >
                    {navItems.map(({ href, icon: Icon, label }) => {
                        const isActive =
                            pathname === href || pathname.startsWith(href + "/");
                        return (
                            <Link
                                key={href}
                                href={href}
                                title={label}
                                className={cn(
                                    "relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl",
                                    "text-xs font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-primary text-primary-foreground scale-105"
                                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                <span className="hidden sm:block text-[10px]">{label}</span>
                            </Link>
                        );
                    })}

                    <div className="w-px h-6 bg-border mx-1" />

                    <button
                        onClick={logout}
                        title="Sair"
                        className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    >
                        <LogOut className="h-4 w-4" />
                        <span className="hidden sm:block text-[10px]">Sair</span>
                    </button>
                </nav>
            </div>

            {/* Padding para o conteúdo não ser coberto pelo dock */}
            <div className="pb-24" />
        </>
    );
}