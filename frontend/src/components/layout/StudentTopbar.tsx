// frontend/src/components/layout/StudentTopbar.tsx
// Layout de navegação superior para o portal do aluno.
// Alternativa à sidebar — mais compacto, visual "app moderno".

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard, BookOpen, HelpCircle,
    ClipboardList, Calendar, BarChart3,
    GraduationCap, Trophy, LogOut, Menu, X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { useLogout } from "@/lib/hooks/useAuth";
import { useAuthStore } from "@/lib/stores/authStore";

const navItems = [
    { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
    { href: "/courses",    label: "Cursos",      icon: BookOpen },
    { href: "/questions",  label: "Questões",    icon: HelpCircle },
    { href: "/simulados",  label: "Simulados",   icon: ClipboardList },
    { href: "/schedule",   label: "Cronograma",  icon: Calendar },
    { href: "/analytics",  label: "Desempenho",  icon: BarChart3 },
    { href: "/hall-of-fame", label: "Conquistas", icon: Trophy },
];

export function StudentTopbar() {
    const pathname = usePathname();
    const { getBranding } = useTenantStore();
    const { user } = useAuthStore();
    const logout = useLogout();
    const branding = getBranding();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <>
            {/* ── Topbar ── */}
            <header className="fixed top-0 left-0 right-0 z-40 h-14 border-b border-border bg-card/95 backdrop-blur-sm flex items-center px-4 gap-4">
                {/* Logo */}
                <Link href="/dashboard" className="flex items-center gap-2 shrink-0 mr-2">
                    <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
                        <GraduationCap className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <span className="font-semibold text-sm text-foreground hidden sm:block truncate max-w-[120px]">
                        {branding.platform_name}
                    </span>
                </Link>

                {/* Nav desktop */}
                <nav className="hidden md:flex items-center gap-0.5 flex-1">
                    {navItems.map(({ href, label, icon: Icon }) => {
                        const isActive = pathname === href || pathname.startsWith(href + "/");
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                )}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Right: user + logout */}
                <div className="ml-auto flex items-center gap-2">
                    <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-[120px]">
                        {user?.name?.split(" ")[0]}
                    </span>
                    <button
                        onClick={logout}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-accent"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        <span className="hidden sm:block">Sair</span>
                    </button>
                    {/* Mobile menu toggle */}
                    <button
                        className="md:hidden p-1.5 rounded-md hover:bg-accent"
                        onClick={() => setMobileOpen(v => !v)}
                    >
                        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                    </button>
                </div>
            </header>

            {/* ── Mobile menu ── */}
            {mobileOpen && (
                <div className="fixed inset-0 z-30 pt-14 bg-background/95 backdrop-blur-sm md:hidden">
                    <nav className="p-4 space-y-1">
                        {navItems.map(({ href, label, icon: Icon }) => {
                            const isActive = pathname === href || pathname.startsWith(href + "/");
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    onClick={() => setMobileOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                                        isActive
                                            ? "bg-primary text-primary-foreground"
                                            : "text-foreground hover:bg-accent"
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    {label}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            )}

            {/* Spacer para o conteúdo não ficar atrás da topbar */}
            <div className="h-14" />
        </>
    );
}