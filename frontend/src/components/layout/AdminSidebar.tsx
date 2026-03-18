// frontend/src/components/layout/AdminSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, Settings, LogOut, Shield } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useLogout } from "@/lib/hooks/useAuth";
import { useAuthStore } from "@/lib/stores/authStore";

const navItems = [
    { href: "/admin/tenants", label: "Tenants", icon: Building2 },
    { href: "/admin/settings", label: "Configurações", icon: Settings },
];

export function AdminSidebar() {
    const pathname = usePathname();
    const { user } = useAuthStore();
    const logout = useLogout();

    return (
        <aside className="w-64 shrink-0 flex flex-col border-r border-border bg-card h-screen">
            <div className="p-5 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                        <p className="font-display font-semibold text-sm text-foreground">Super Admin</p>
                        <p className="text-xs text-muted-foreground">Painel global</p>
                    </div>
                </div>
            </div>

            <nav className="flex-1 p-3 space-y-1">
                {navItems.map(({ href, label, icon: Icon }) => (
                    <Link
                        key={href}
                        href={href}
                        className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                            pathname.startsWith(href)
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        )}
                    >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                    </Link>
                ))}
            </nav>

            <div className="p-3 border-t border-border">
                <div className="flex items-center gap-3 px-3 py-2">
                    <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
                        <span className="text-xs font-semibold text-destructive">
                            {user?.name?.charAt(0)}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
                        <p className="text-xs text-muted-foreground">super_admin</p>
                    </div>
                    <button onClick={logout} className="text-muted-foreground hover:text-destructive transition-colors">
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
}