// frontend/src/components/layout/ProducerSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard, BookOpen, HelpCircle,
    ClipboardList, Users, BarChart3,
    Settings, GraduationCap, LogOut,
} from "lucide-react";
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
    { href: "/producer/settings", label: "Configurações", icon: Settings },
];

export function ProducerSidebar() {
    const pathname = usePathname();
    const { getBranding } = useTenantStore();
    const { user } = useAuthStore();
    const logout = useLogout();
    const branding = getBranding();

    return (
        <aside className="w-64 shrink-0 flex flex-col border-r border-border bg-card h-screen">
            <div className="p-5 border-b border-border">
                <Link href="/producer/dashboard" className="flex items-center gap-3">
                    {branding.logo_url ? (
                        <div className="h-8 w-8 rounded-lg overflow-hidden shrink-0 border border-border">
                            <Image
                                src={branding.logo_url}
                                alt={branding.platform_name}
                                width={32}
                                height={32}
                                className="h-full w-full object-contain"
                            />
                        </div>
                    ) : (
                        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                            <GraduationCap className="h-5 w-5 text-primary-foreground" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="font-display font-semibold text-sm text-foreground truncate">
                            {branding.platform_name}
                        </p>
                        <p className="text-xs text-muted-foreground">Painel do Produtor</p>
                    </div>
                </Link>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {navItems.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href || pathname.startsWith(href + "/");
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

            <div className="p-3 border-t border-border">
                <div className="flex items-center gap-3 px-3 py-2">
                    <div className="h-8 w-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-secondary">
                            {user?.name?.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
                        <p className="text-xs text-muted-foreground">Produtor</p>
                    </div>
                    <button onClick={logout} className="text-muted-foreground hover:text-destructive transition-colors">
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
}