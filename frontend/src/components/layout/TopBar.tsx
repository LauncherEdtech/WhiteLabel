// frontend/src/components/layout/TopBar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useAuthStore } from "@/lib/stores/authStore";
import { useUnreadCount } from "@/lib/hooks/useNotifications";
import { cn } from "@/lib/utils/cn";

export function TopBar() {
    const { user } = useAuthStore();
    const pathname = usePathname();
    const { data: unreadData } = useUnreadCount();
    const unreadCount = unreadData?.unread_count ?? 0;

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return "Bom dia";
        if (h < 18) return "Boa tarde";
        return "Boa noite";
    };

    return (
        <header className="h-14 shrink-0 border-b border-border bg-card/50 backdrop-blur-sm px-4 flex items-center justify-between">
            {/* Espaço para o botão hamburger no mobile (44px = w-11) */}
            <div className="w-11 lg:w-0 shrink-0" />

            <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                    {greeting()},{" "}
                    <span className="font-medium text-foreground">
                        {user?.name?.split(" ")[0]}
                    </span>{" "}
                    👋
                </p>
            </div>

            <div className="flex items-center gap-3">
                <Link
                    href="/notifications"
                    className={cn(
                        "relative h-9 w-9 rounded-lg border border-border bg-background flex items-center justify-center transition-colors",
                        pathname === "/notifications"
                            ? "text-primary border-primary/40 bg-primary/5"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Notificações"
                >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                    )}
                </Link>
            </div>
        </header>
    );
}