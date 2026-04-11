// frontend/src/components/layout/StudentMinimalNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard, BookOpen, HelpCircle,
    ClipboardList, Calendar, BarChart3, LogOut, Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useLogout } from "@/lib/hooks/useAuth";
import { useAuthStore } from "@/lib/stores/authStore";

const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Início" },
    { href: "/courses", icon: BookOpen, label: "Cursos" },
    { href: "/questions", icon: HelpCircle, label: "Questões" },
    { href: "/simulados", icon: ClipboardList, label: "Simulados" },
    { href: "/schedule", icon: Calendar, label: "Agenda" },
    { href: "/analytics", icon: BarChart3, label: "Stats" },
    { href: "/hall-of-fame", icon: Trophy, label: "Honra" },
];

export function StudentMinimalNav() {
    const pathname = usePathname();
    const logout = useLogout();
    const { user } = useAuthStore();

    return (
        <>
            {/* ── Barra superior: saudação + botão Sair ── */}
            <div className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center justify-between px-4 bg-card/90 backdrop-blur-xl border-b border-border">
                <p className="text-sm text-muted-foreground">
                    Olá,{" "}
                    <span className="font-medium text-foreground">
                        {user?.name?.split(" ")[0]}
                    </span>{" "}
                    👋
                </p>
                <button
                    onClick={logout}
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors px-3 py-1.5 rounded-lg hover:bg-destructive/10"
                >
                    <LogOut className="h-4 w-4" />
                    <span>Sair</span>
                </button>
            </div>

            {/* ── Spacer para o topbar fixo ── */}
            <div className="h-12" />

            {/* ── Dock flutuante na parte inferior ── */}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg">
                <nav className={cn(
                    "flex items-center justify-around px-2 py-3 rounded-2xl",
                    "bg-card/95 backdrop-blur-xl border border-border",
                    "shadow-2xl shadow-black/30",
                )}>
                    {navItems.map(({ href, icon: Icon, label }) => {
                        const isActive = pathname === href || pathname.startsWith(href + "/");
                        return (
                            <Link
                                key={href}
                                href={href}
                                title={label}
                                className={cn(
                                    "flex flex-col items-center gap-1 px-3 py-2 rounded-xl min-w-[44px]",
                                    "text-xs font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-primary text-primary-foreground scale-105"
                                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                )}
                            >
                                <Icon className="h-5 w-5" />
                                <span className="text-[10px] leading-none">{label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* ── Padding para conteúdo não ficar sob o dock ── */}
            <div className="pb-28" />
        </>
    );
}