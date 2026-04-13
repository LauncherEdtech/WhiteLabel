// frontend/src/components/student/FloatingCoachWidget.tsx
"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { X, ArrowRight, Brain } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { NextAction } from "@/types/api";

// ── Dismiss no localStorage (4h por action_type) ──────────────────────────────

const DISMISS_KEY = "coach_widget_dismiss";
const DISMISS_TTL = 4 * 60 * 60 * 1000;

function getDismissed(): { action_type: string; until: number } | null {
    try {
        const raw = localStorage.getItem(DISMISS_KEY);
        if (!raw) return null;
        const d = JSON.parse(raw);
        if (Date.now() > d.until) { localStorage.removeItem(DISMISS_KEY); return null; }
        return d;
    } catch { return null; }
}

function saveDismiss(action_type: string) {
    try {
        localStorage.setItem(DISMISS_KEY, JSON.stringify({
            action_type,
            until: Date.now() + DISMISS_TTL,
        }));
    } catch { }
}

// ── Estilo por prioridade ─────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
    high: {
        dot: "bg-destructive",
        pulse: true,
        border: "border-destructive/40",
        headerBg: "bg-destructive/8",
        badge: "bg-destructive/10 text-destructive",
        label: "Ação urgente",
        btn: "bg-destructive hover:bg-destructive/90 text-white",
    },
    medium: {
        dot: "bg-primary",
        pulse: true,
        border: "border-primary/40",
        headerBg: "bg-primary/5",
        badge: "bg-primary/10 text-primary",
        label: "Recomendado",
        btn: "bg-primary hover:bg-primary/90 text-primary-foreground",
    },
    low: {
        dot: "bg-success",
        pulse: false,
        border: "border-success/40",
        headerBg: "bg-success/5",
        badge: "bg-success/10 text-success",
        label: "Tudo certo",
        btn: "bg-success hover:bg-success/90 text-white",
    },
} as const;

// ── Widget ────────────────────────────────────────────────────────────────────

export function FloatingCoachWidget() {
    const router = useRouter();
    const pathname = usePathname();

    const [open, setOpen] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [prevPathname, setPrevPathname] = useState(pathname);

    const { data, isLoading, refetch } = useQuery<NextAction>({
        queryKey: ["next-action"],
        queryFn: () => apiClient.get("/analytics/student/next-action").then(r => r.data),
        staleTime: 10 * 60 * 1000,  // considera fresco por 10 min
        refetchInterval: 15 * 60 * 1000,  // refetch automático a cada 15 min
        refetchOnWindowFocus: true,       // atualiza quando volta à aba
    });

    // Checa dismiss quando a ação muda
    useEffect(() => {
        if (!data) return;
        const d = getDismissed();
        setDismissed(!!d && d.action_type === data.action_type);
    }, [data?.action_type]);

    // Quando o aluno navega (aceitou uma sugestão), fecha o card e refetch após 3s
    useEffect(() => {
        if (pathname === prevPathname) return;
        setPrevPathname(pathname);
        setOpen(false);
        const t = setTimeout(() => refetch(), 3000);
        return () => clearTimeout(t);
    }, [pathname]);

    useEffect(() => {
        const handler = () => {
            setDismissed(false);
            setOpen(true); // abre automaticamente ao clicar no botão
            refetch();
        };
        window.addEventListener("coach:show", handler);
        return () => window.removeEventListener("coach:show", handler);
    }, [refetch]);

    const handleDismiss = () => {
        if (!data) return;
        saveDismiss(data.action_type);
        setDismissed(true);
        setOpen(false);
    };

    const handleAccept = () => {
        if (!data) return;
        setOpen(false);
        const params = new URLSearchParams(data.cta_params).toString();
        router.push(params ? `${data.cta_url}?${params}` : data.cta_url);
    };

    if (isLoading || dismissed || !data) return null;

    const cfg = PRIORITY_CONFIG[data.priority];

    return (
        <div className="fixed bottom-28 right-4 lg:bottom-6 lg:right-6 flex flex-col items-end gap-3 pointer-events-none">

            {/* ── Card expandido ──────────────────────────────────────────── */}
            {open && (
                <div className={cn(
                    "w-80 rounded-2xl border shadow-2xl shadow-black/30 overflow-hidden pointer-events-auto",
                    "animate-in slide-in-from-bottom-3 fade-in duration-200",
                    "bg-card/98 backdrop-blur-md",
                    cfg.border,
                )}>
                    {/* Header */}
                    <div className={cn(
                        "flex items-center justify-between px-4 py-2.5 border-b border-border/60",
                        cfg.headerBg,
                    )}>
                        <div className="flex items-center gap-2">
                            <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold text-foreground">Mentor Inteligente</span>
                            <span className={cn(
                                "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider",
                                cfg.badge,
                            )}>
                                {cfg.label}
                            </span>
                        </div>
                        <button
                            onClick={() => setOpen(false)}
                            className="h-6 w-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-4">
                        <div className="flex items-start gap-3 mb-4">
                            {/* Ícone da ação */}
                            <div className="h-10 w-10 rounded-xl bg-muted border border-border flex items-center justify-center text-xl shrink-0 shadow-sm">
                                {data.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground leading-snug mb-1">
                                    {data.title}
                                </p>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {data.message}
                                </p>
                            </div>
                        </div>

                        {/* CTAs */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleAccept}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl",
                                    "text-xs font-semibold transition-all duration-150 active:scale-95",
                                    cfg.btn,
                                )}
                            >
                                {data.cta_label}
                                <ArrowRight className="h-3 w-3" />
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap"
                            >
                                Agora não
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Botão flutuante ─────────────────────────────────────────── */}
            <button
                data-onboarding="coach"
                onClick={() => setOpen(v => !v)}
                className={cn(
                    "relative h-14 w-14 rounded-full shadow-xl shadow-black/30 pointer-events-auto",
                    "bg-card border-2 flex items-center justify-center",
                    "transition-all duration-200 hover:scale-105 active:scale-95",
                    open
                        ? "border-primary shadow-primary/20"
                        : cfg.border,
                )}
                title="Assistente IA"
            >
                <Brain className={cn(
                    "h-6 w-6 transition-colors duration-200",
                    open ? "text-primary" : "text-foreground",
                )} />

                {/* Badge de prioridade */}
                {!open && (
                    <span className="absolute -top-0.5 -right-0.5">
                        <span className="relative flex h-3.5 w-3.5">
                            {cfg.pulse && (
                                <span className={cn(
                                    "animate-ping absolute inline-flex h-full w-full rounded-full opacity-50",
                                    cfg.dot,
                                )} />
                            )}
                            <span className={cn(
                                "relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-card",
                                cfg.dot,
                            )} />
                        </span>
                    </span>
                )}
            </button>
        </div>
    );
}