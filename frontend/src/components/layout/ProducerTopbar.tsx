// frontend/src/components/layout/ProducerTopbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard, BookOpen, HelpCircle,
    ClipboardList, Users, BarChart3,
    Settings, GraduationCap, LogOut, Menu, X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { useLogout } from "@/lib/hooks/useAuth";
import { useAuthStore } from "@/lib/stores/authStore";
import Image from "next/image";


const navItems = [
    { href: "/producer/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/producer/courses", label: "Cursos", icon: BookOpen },
    { href: "/producer/questions", label: "Questões", icon: HelpCircle },
    { href: "/producer/simulados", label: "Simulados", icon: ClipboardList },
    { href: "/producer/students", label: "Alunos", icon: Users },
    { href: "/producer/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/producer/settings", label: "Config.", icon: Settings },
];

export function ProducerTopbar() {
    const pathname = usePathname();
    const { getBranding } = useTenantStore();
    const { user } = useAuthStore();
    const logout = useLogout();
    const branding = getBranding();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <>
            <header className="fixed top-0 left-0 right-0 z-40 h-14 border-b border-border bg-card/95 backdrop-blur-sm flex items-center px-4 gap-3">
                {/* Logo */}
                <Link href="/producer/dashboard" className="flex items-center gap-2 shrink-0 mr-2">
                    {branding.logo_url ? (
                        <div className="h-7 w-7 rounded-lg overflow-hidden shrink-0 border border-border">
                            <Image
                                src={branding.logo_url}
                                alt={branding.platform_name}
                                width={28}
                                height={28}
                                className="h-full w-full object-contain"
                            />
                        </div>
                    ) : (
                        <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                            <GraduationCap className="h-4 w-4 text-primary-foreground" />
                        </div>
                    )}
                    <div className="hidden sm:block">
                        <p className="text-xs font-semibold text-foreground leading-tight truncate max-w-[120px]">
                            {branding.platform_name}
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-tight">Produtor</p>
                    </div>
                </Link>

                <div className="w-px h-5 bg-border hidden md:block" />

                {/* Nav desktop */}
                <nav className="hidden md:flex items-center gap-0.5 flex-1 overflow-x-auto">
                    {navItems.map(({ href, label, icon: Icon }) => {
                        const isActive = pathname === href || pathname.startsWith(href + "/");
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                )}
                            >
                                <Icon className="h-3.5 w-3.5 shrink-0" />
                                {label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Right: user + logout */}
                <div className="ml-auto flex items-center gap-2">
                    <span className="hidden lg:block text-xs text-muted-foreground truncate max-w-[100px]">
                        {user?.name?.split(" ")[0]}
                    </span>
                    <button
                        onClick={logout}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-accent"
                        title="Sair"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        <span className="hidden sm:block">Sair</span>
                    </button>
                    <button
                        className="md:hidden p-1.5 rounded-md hover:bg-accent"
                        onClick={() => setMobileOpen(v => !v)}
                    >
                        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                    </button>
                </div>
            </header>

            {/* Mobile menu */}
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