// frontend/src/components/layout/TopBar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useAuthStore } from "@/lib/stores/authStore";
import { useUnreadCount } from "@/lib/hooks/useNotifications";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { cn } from "@/lib/utils/cn";

const WHATSAPP_NUMBER = "5562995594055";

function whatsappUrl(tenantName: string) {
    const msg = encodeURIComponent(`Olá! Preciso de suporte na plataforma ${tenantName}.`);
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
}

// Ícone WhatsApp inline (sem dependência externa)
function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    );
}

export function TopBar() {
    const { user } = useAuthStore();
    const { tenant } = useTenantStore();
    const pathname = usePathname();
    const { data: unreadData } = useUnreadCount();
    const unreadCount = unreadData?.unread_count ?? 0;

    const tenantName = tenant?.name ?? "LauncherEdu";

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

            <div className="flex items-center gap-2">
                {/* Botão de suporte WhatsApp */}
                <a
                    href={whatsappUrl(tenantName)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Falar com o suporte"
                    className="relative h-9 w-9 rounded-lg border border-border bg-background flex items-center justify-center transition-colors text-[#25D366] hover:bg-[#25D366]/10 hover:border-[#25D366]/40"
                >
                    <WhatsAppIcon className="h-4 w-4" />
                </a>

                {/* Sino de notificações */}
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