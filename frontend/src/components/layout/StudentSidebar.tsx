// frontend/src/components/layout/StudentSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
    LayoutDashboard, BookOpen, HelpCircle,
    ClipboardList, Calendar, BarChart3,
    LogOut, GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { useLogout } from "@/lib/hooks/useAuth";
import { useAuthStore } from "@/lib/stores/authStore";

const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/courses", label: "Cursos", icon: BookOpen },
    { href: "/questions", label: "Questões", icon: HelpCircle },
    { href: "/simulados", label: "Simulados", icon: ClipboardList },
    { href: "/schedule", label: "Cronograma", icon: Calendar },
    { href: "/analytics", label: "Desempenho", icon: BarChart3 },
];

export function StudentSidebar() {
    const pathname = usePathname();
    const { getBranding } = useTenantStore();
    const { user } = useAuthStore();
    const logout = useLogout();
    const branding = getBranding();

    return (
        <aside className="w-64 shrink-0 flex flex-col border-r border-border bg-card h-screen">
            {/* Logo */}
            <div className="p-5 border-b border-border">
                <Link href="/dashboard" className="flex items-center gap-3">
                    {branding.logo_url ? (
                        <Image
                            src={branding.logo_url}
                            alt={branding.platform_name}
                            width={32}
                            height={32}
                            className="rounded-lg"
                        />
                    ) : (
                        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                            <GraduationCap className="h-5 w-5 text-primary-foreground" />
                        </div>
                    )}
                    <span className="font-display font-semibold text-sm text-foreground truncate">
                        {branding.platform_name}
                    </span>
                </Link>
            </div>

            {/* Navegação */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {navItems.map(({ href, label, icon: Icon }) => {
                    const isActive =
                        pathname === href || pathname.startsWith(href + "/");
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                                isActive
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                        >
                            <Icon className="h-4 w-4 shrink-0" />
                            {label}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer com usuário */}
            <div className="p-3 border-t border-border">
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-primary">
                            {user?.name?.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                            {user?.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                            {user?.email}
                        </p>
                    </div>
                    <button
                        onClick={logout}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Sair"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
}