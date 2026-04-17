// frontend/src/lib/hooks/useNotifications.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { apiClient } from "@/lib/api/client";

export interface Notification {
    id: string;
    title: string;
    message: string;
    notification_type: string;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
}

interface NotificationsResponse {
    notifications: Notification[];
    total: number;
    page: number;
    pages: number;
    has_next: boolean;
}

// Helper: só faz queries se o usuário estiver autenticado
function isAuthenticated(): boolean {
    return !!Cookies.get("access_token");
}

// ── Lista de notificações ─────────────────────────────────────────────────────

export function useNotifications(page = 1) {
    return useQuery<NotificationsResponse>({
        queryKey: ["notifications", page],
        queryFn: () =>
            apiClient
                .get(`/notifications/?page=${page}&per_page=20`)
                .then((r) => r.data),
        enabled: isAuthenticated(),
        staleTime: 30_000,
    });
}

// ── Contagem de não lidas (para badge no navbar) ──────────────────────────────

export function useUnreadCount() {
    return useQuery<{ unread_count: number }>({
        queryKey: ["notifications", "unread-count"],
        queryFn: () =>
            apiClient.get("/notifications/unread-count").then((r) => r.data),
        enabled: isAuthenticated(),         // não dispara sem token
        staleTime: 30_000,
        refetchInterval: 60_000,            // polling a cada 60s
        refetchIntervalInBackground: false, // pausa quando aba está em background
    });
}

// ── Marcar uma como lida ──────────────────────────────────────────────────────

export function useMarkRead() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) =>
            apiClient.patch(`/notifications/${id}/read`).then((r) => r.data),
        onSuccess: () => {
            // Invalida lista e badge ao mesmo tempo
            qc.invalidateQueries({ queryKey: ["notifications"] });
        },
    });
}

// ── Marcar todas como lidas ───────────────────────────────────────────────────

export function useMarkAllRead() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () =>
            apiClient.post("/notifications/read-all").then((r) => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["notifications"] });
        },
    });
}