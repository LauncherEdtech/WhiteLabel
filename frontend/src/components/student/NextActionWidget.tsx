// frontend/src/components/student/NextActionWidget.tsx
"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { X, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface NextAction {
    action_type: string;
    title: string;
    message: string;
    cta_label: string;
    cta_url: string;
    cta_params: Record<string, string>;
    icon: string;
    priority: "high" | "medium" | "low";
}

// ── Persistência de dismiss no localStorage ───────────────────────────────────

const DISMISS_KEY = "next_action_dismiss";
const DISMISS_TTL_MS = 4 * 60 * 60 * 1000; // 4 horas

function getDismissed(): { action_type: string; until: number } | null {
    try {
        const raw = localStorage.getItem(DISMISS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Date.now() > parsed.until) {
            localStorage.removeItem(DISMISS_KEY);
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

function setDismissed(action_type: string) {
    try {
        localStorage.setItem(
            DISMISS_KEY,
            JSON.stringify({ action_type, until: Date.now() + DISMISS_TTL_MS })
        );
    } catch { }
}

// ── Cores por prioridade ──────────────────────────────────────────────────────

const PRIORITY_STYLES = {
    high: {
        border: "border-destructive/30",
        bg: "bg-destructive/5",
        badge: "bg-destructive/10 text-destructive",
        badgeLabel: "Ação prioritária",
        indicator: "bg-destructive",
        button: "bg-destructive hover:bg-destructive/90 text-white",
    },
    medium: {
        border: "border-primary/30",
        bg: "bg-primary/5",
        badge: "bg-primary/10 text-primary",
        badgeLabel: "Recomendado",
        indicator: "bg-primary",
        button: "bg-primary hover:bg-primary/90 text-primary-foreground",
    },
    low: {
        border: "border-success/30",
        bg: "bg-success/5",
        badge: "bg-success/10 text-success",
        badgeLabel: "Sugestão",
        indicator: "bg-success",
        button: "bg-success hover:bg-success/90 text-white",
    },
} as const;

// ── Widget ────────────────────────────────────────────────────────────────────

export function NextActionWidget() {
    const router = useRouter();
    const [dismissed, setDismissedState] = useState(false);

    const { data, isLoading } = useQuery<NextAction>({
        queryKey: ["next-action"],
        queryFn: () =>
            apiClient.get("/analytics/student/next-action").then(r => r.data),
        staleTime: 15 * 60 * 1000, // 15 min (sincronizado com backend)
        refetchOnWindowFocus: false,
    });

    // Verifica dismiss no localStorage após a ação chegar
    useEffect(() => {
        if (!data) return;
        const dismissed = getDismissed();
        // Se o tipo da ação foi dispensado e ainda não expirou, esconde
        if (dismissed && dismissed.action_type === data.action_type) {
            setDismissedState(true);
        } else {
            setDismissedState(false);
        }
    }, [data?.action_type]);

    const handleDismiss = () => {
        if (!data) return;
        setDismissed(data.action_type);
        setDismissedState(true);
    };

    const handleAccept = () => {
        if (!data) return;
        // Monta URL com query params
        const params = new URLSearchParams(data.cta_params).toString();
        const url = params ? `${data.cta_url}?${params}` : data.cta_url;
        router.push(url);
    };

    // Não renderiza se estiver carregando, dispensado ou sem dados
    if (isLoading || dismissed || !data) return null;

    const style = PRIORITY_STYLES[data.priority];

    return (
        <div className={cn(
            "rounded-xl border p-4 transition-all duration-300 animate-fade-in",
            style.border, style.bg
        )}>
            <div className="flex items-start gap-3">
                {/* Ícone + indicador de prioridade */}
                <div className="relative shrink-0">
                    <div className="h-10 w-10 rounded-xl bg-background border border-border flex items-center justify-center text-xl shadow-sm">
                        {data.icon}
                    </div>
                    {/* Indicador pulsante */}
                    <span className={cn(
                        "absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-background",
                        style.indicator
                    )}>
                        <span className={cn(
                            "absolute inset-0 rounded-full animate-ping opacity-75",
                            style.indicator
                        )} />
                    </span>
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                    {/* Badge + dismiss */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3 text-muted-foreground" />
                            <span className={cn(
                                "text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                                style.badge
                            )}>
                                {style.badgeLabel}
                            </span>
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="h-5 w-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                            title="Dispensar sugestão"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>

                    <p className="text-sm font-semibold text-foreground leading-snug mb-1">
                        {data.title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                        {data.message}
                    </p>

                    {/* Botões */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleAccept}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                                style.button
                            )}
                        >
                            {data.cta_label}
                            <ArrowRight className="h-3 w-3" />
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                            Agora não
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}