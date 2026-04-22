// frontend/src/components/layout/StudentTopbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard, BookOpen, HelpCircle,
    ClipboardList, Calendar, BarChart3,
    GraduationCap, Trophy, LogOut, Menu, X, Bell,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { useLogout } from "@/lib/hooks/useAuth";
import { useAuthStore } from "@/lib/stores/authStore";
import { useUnreadCount } from "@/lib/hooks/useNotifications";
import Image from "next/image";

const WHATSAPP_NUMBER = "5562995594055";

function whatsappUrl(tenantName: string) {
    const msg = encodeURIComponent(`Olá! Preciso de suporte na plataforma ${tenantName}.`);
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
}

function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    );
}

const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/courses", label: "Cursos", icon: BookOpen },
    { href: "/questions", label: "Questões", icon: HelpCircle },
    { href: "/simulados", label: "Simulados", icon: ClipboardList },
    { href: "/schedule", label: "Cronograma", icon: Calendar },
    { href: "/analytics", label: "Desempenho", icon: BarChart3 },
    { href: "/hall-of-fame", label: "Conquistas", icon: Trophy },
];

export function StudentTopbar() {
    const pathname = usePathname();
    const { getBranding, tenant } = useTenantStore();
    const { user } = useAuthStore();
    const logout = useLogout();
    const branding = getBranding();
    const [mobileOpen, setMobileOpen] = useState(false);

    const { data: unreadData } = useUnreadCount();
    const unreadCount = unreadData?.unread_count ?? 0;

    const tenantName = tenant?.name ?? "LauncherEdu";

    return (
        <>
            {/* ── Topbar ── */}
            <header className="fixed top-0 left-0 right-0 z-40 h-14 border-b border-border bg-card/95 backdrop-blur-sm flex items-center px-4 gap-4">

                {/* Logo */}
                <Link href="/dashboard" className="flex items-center gap-2 shrink-0 mr-2">
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

                {/* Right: suporte + sino + nome + logout */}
                <div className="ml-auto flex items-center gap-2">

                    {/* Botão de suporte WhatsApp */}
                    <a
                        href={whatsappUrl(tenantName)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Falar com o suporte"
                        className="relative flex items-center justify-center h-8 w-8 rounded-md transition-colors text-[#25D366] hover:bg-[#25D366]/10"
                    >
                        <WhatsAppIcon className="h-4 w-4" />
                    </a>

                    {/* Sino de notificações */}
                    <Link
                        href="/notifications"
                        className={cn(
                            "relative flex items-center justify-center h-8 w-8 rounded-md transition-colors",
                            pathname === "/notifications"
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        )}
                        title="Notificações"
                    >
                        <Bell className="h-4 w-4" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                                {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                        )}
                    </Link>

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
                        aria-label="Abrir menu"
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

                        {/* Notificações no mobile */}
                        <Link
                            href="/notifications"
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                                pathname === "/notifications"
                                    ? "bg-primary text-primary-foreground"
                                    : "text-foreground hover:bg-accent"
                            )}
                        >
                            <Bell className="h-4 w-4" />
                            Notificações
                            {unreadCount > 0 && (
                                <span className="ml-auto h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                    {unreadCount > 99 ? "99+" : unreadCount}
                                </span>
                            )}
                        </Link>
                    </nav>
                </div>
            )}

            {/* Spacer */}
            <div className="h-14" />
        </>
    );
}