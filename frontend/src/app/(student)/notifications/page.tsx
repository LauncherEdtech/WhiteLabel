// frontend/src/app/(student)/notifications/page.tsx
"use client";

import { Bell, BellOff, CheckCheck, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { formatRelative } from "@/lib/utils/date";  // utilitário já existente no projeto
import {
    useNotifications,
    useMarkRead,
    useMarkAllRead,
} from "@/lib/hooks/useNotifications";

export default function NotificationsPage() {
    const { data, isLoading } = useNotifications();
    const markRead = useMarkRead();
    const markAllRead = useMarkAllRead();

    const notifications = data?.notifications ?? [];
    const hasUnread = notifications.some((n) => !n.is_read);

    return (
        <div className="max-w-2xl space-y-5 animate-fade-in">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-xl font-bold text-foreground">
                        Notificações
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Mensagens do seu produtor
                    </p>
                </div>
                {hasUnread && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markAllRead.mutate()}
                        loading={markAllRead.isPending}
                    >
                        <CheckCheck className="h-4 w-4" />
                        Marcar todas como lidas
                    </Button>
                )}
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Carregando...
                </div>
            )}

            {/* Empty state */}
            {!isLoading && notifications.length === 0 && (
                <Card>
                    <CardContent className="py-16 text-center space-y-3">
                        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                            <BellOff className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <p className="font-medium text-foreground">Nenhuma notificação ainda</p>
                        <p className="text-sm text-muted-foreground">
                            Quando seu produtor enviar uma mensagem, ela aparecerá aqui.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Lista */}
            {!isLoading && notifications.length > 0 && (
                <div className="space-y-2">
                    {notifications.map((notif) => (
                        <button
                            key={notif.id}
                            onClick={() => {
                                if (!notif.is_read) markRead.mutate(notif.id);
                            }}
                            disabled={markRead.isPending}
                            className={cn(
                                "w-full text-left p-4 rounded-xl border transition-all disabled:opacity-60",
                                notif.is_read
                                    ? "border-border bg-card hover:bg-accent/50"
                                    : "border-primary/30 bg-primary/5 hover:bg-primary/10"
                            )}
                        >
                            <div className="flex items-start gap-3">
                                {/* Ícone */}
                                <div
                                    className={cn(
                                        "mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                                        notif.is_read
                                            ? "bg-muted text-muted-foreground"
                                            : "bg-primary/10 text-primary"
                                    )}
                                >
                                    <Bell className="h-4 w-4" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-foreground truncate">
                                            {notif.title}
                                        </p>
                                        {/* Indicador de não lido */}
                                        {!notif.is_read && (
                                            <span className="shrink-0 h-2 w-2 rounded-full bg-primary" />
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                                        {notif.message}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1.5">
                                        {/* Usa o utilitário existente do projeto — não importa date-fns diretamente */}
                                        {formatRelative(notif.created_at)}
                                    </p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}