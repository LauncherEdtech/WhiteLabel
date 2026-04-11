// frontend/src/components/onboarding/OnboardingTour.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
    Target, HelpCircle, Calendar,
    Brain, BarChart3, Trophy, X,
    ChevronRight, ArrowRight, GraduationCap,
    Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { apiClient } from "@/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/authStore";
import { AUTH_KEYS } from "@/lib/hooks/useAuth";

// ── Step definitions ──────────────────────────────────────────────────────────

interface TourStep {
    id: string;
    route: string;
    target: string | null;
    title: string;
    description: string;
    icon: React.ReactNode;
    cta: string;
    position?: "top" | "bottom" | "center";
}

const STEPS: TourStep[] = [
    {
        id: "welcome",
        route: "/dashboard",
        target: null,
        title: "Sua aprovação começa aqui!",
        description: "Em menos de 2 minutos você vai conhecer tudo que a plataforma oferece. Cada feature foi criada para te aproximar da aprovação.",
        icon: <GraduationCap className="h-10 w-10 text-primary" />,
        cta: "Começar tour",
        position: "center",
    },
    {
        id: "metrics",
        route: "/dashboard",
        target: "[data-onboarding='metrics']",
        title: "Seu progresso em tempo real",
        description: "Acompanhe questões respondidas, taxa de acerto, tempo de estudo e aulas assistidas. Esses números crescem conforme você estuda.",
        icon: <Target className="h-5 w-5 text-primary" />,
        cta: "Próximo",
        position: "bottom",
    },
    {
        id: "mission",
        route: "/dashboard",
        target: "[data-onboarding='mission']",
        title: "Missão semanal",
        description: "Toda semana você recebe missões personalizadas — seguir o cronograma e melhorar nas disciplinas fracas. Complete e suba de patente!",
        icon: <Sparkles className="h-5 w-5 text-primary" />,
        cta: "Próximo",
        position: "bottom",
    },
    {
        id: "questions",
        route: "/questions",
        target: "[data-onboarding='questions']",
        title: "Banco de questões",
        description: "Milhares de questões organizadas por disciplina, tópico e dificuldade. Filtre e pratique no seu ritmo — questões erradas entram em revisão automática.",
        icon: <HelpCircle className="h-5 w-5 text-primary" />,
        cta: "Próximo",
        position: "bottom",
    },
    {
        id: "schedule",
        route: "/schedule",
        target: "[data-onboarding='schedule']",
        title: "Cronograma inteligente",
        description: "A IA organiza seus estudos automaticamente baseado no seu desempenho e disponibilidade. Ele se adapta quando você fica para trás ou melhora.",
        icon: <Calendar className="h-5 w-5 text-primary" />,
        cta: "Próximo",
        position: "bottom",
    },
    {
        id: "coach",
        route: "/dashboard",
        target: "[data-onboarding='coach']",
        title: "Seu mentor inteligente",
        description: "Ficou perdido ou sem saber o que fazer? Clique aqui a qualquer momento. A IA analisa seu contexto e te diz exatamente qual é o próximo passo.",
        icon: <Brain className="h-5 w-5 text-primary" />,
        cta: "Próximo",
        position: "top",
    },
    {
        id: "analytics",
        route: "/analytics",
        target: "[data-onboarding='analytics']",
        title: "Análise de desempenho",
        description: "Veja seu desempenho por disciplina, identifique pontos fracos e acompanhe sua evolução ao longo do tempo com insights gerados por IA.",
        icon: <BarChart3 className="h-5 w-5 text-primary" />,
        cta: "Próximo",
        position: "bottom",
    },
    {
        id: "hall-of-fame",
        route: "/hall-of-fame",
        target: "[data-onboarding='hall-of-fame']",
        title: "Mural de Honra",
        description: "Conquiste badges, suba de patente e apareça no ranking da turma. Cada questão respondida te aproxima do topo — e da aprovação!",
        icon: <Trophy className="h-5 w-5 text-primary" />,
        cta: "Concluir tour 🎉",
        position: "bottom",
    },
];

// ── Spotlight hook ────────────────────────────────────────────────────────────

function useSpotlight(selector: string | null) {
    const [rect, setRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        if (!selector) { setRect(null); return; }

        const update = () => {
            const el = document.querySelector(selector);
            if (el) {
                // Scroll element into view if needed
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                setTimeout(() => {
                    const updated = document.querySelector(selector);
                    if (updated) setRect(updated.getBoundingClientRect());
                }, 300);
            }
        };

        update();
        const t1 = setTimeout(update, 400);
        const t2 = setTimeout(update, 900);
        const t3 = setTimeout(update, 1500);

        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
        };
    }, [selector]);

    return rect;
}

// ── Tooltip positioning ───────────────────────────────────────────────────────

function getTooltipPos(
    rect: DOMRect,
    position: string,
    vw: number,
    vh: number,
): { top: number; left: number; width: number } {
    const W = 300;
    const GAP = 14;
    const PAD = 12;

    let top: number;
    const left = Math.max(PAD, Math.min(rect.left + rect.width / 2 - W / 2, vw - W - PAD));

    if (position === "top" || rect.top > vh * 0.6) {
        top = rect.top - GAP - 220; // 220 = estimated tooltip height
    } else {
        top = rect.bottom + GAP;
    }

    top = Math.max(PAD, Math.min(top, vh - 240));

    return { top, left, width: W };
}

// ── Main component ────────────────────────────────────────────────────────────

interface OnboardingTourProps {
    initialStep?: number;
    onComplete: () => void;
}

export function OnboardingTour({ initialStep = 0, onComplete }: OnboardingTourProps) {
    const router = useRouter();
    const pathname = usePathname();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    const [step, setStep] = useState(initialStep);
    const [navigating, setNavigating] = useState(false);
    const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
    const [vh, setVh] = useState(typeof window !== "undefined" ? window.innerHeight : 800);

    const current = STEPS[step];
    const isWelcome = current.position === "center";
    const isLast = step === STEPS.length - 1;

    const rect = useSpotlight(!navigating && !isWelcome ? current.target : null);
    const PADDING = 14;

    // Viewport resize
    useEffect(() => {
        const handle = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
        window.addEventListener("resize", handle);
        return () => window.removeEventListener("resize", handle);
    }, []);

    // Navigate when step changes
    useEffect(() => {
        if (!current.route) return;
        if (pathname === current.route) { setNavigating(false); return; }
        setNavigating(true);
        router.push(current.route);
    }, [step]);

    useEffect(() => {
        if (current.route && pathname === current.route) {
            setTimeout(() => setNavigating(false), 200);
        }
    }, [pathname, current.route]);

    const completeOnboarding = useCallback(async () => {
        try { await apiClient.post("/auth/onboarding/complete"); } catch { }
    }, []);

    // Substituir handleNext inteiro:
    const handleNext = useCallback(async () => {
        if (isLast) {
            await completeOnboarding();
            // Atualiza authStore optimisticamente — evita o tour reaparecer
            const currentUser = useAuthStore.getState().user;
            if (currentUser) {
                useAuthStore.getState().setUser({
                    ...currentUser,
                    settings: {
                        ...((currentUser as any).settings || {}),
                        onboarding: { completed: true },
                    },
                } as any);
            }
            queryClient.invalidateQueries({ queryKey: AUTH_KEYS.me });
            localStorage.removeItem("coach_widget_dismiss");
            queryClient.invalidateQueries({ queryKey: ["next-action"] });
            window.dispatchEvent(new Event("coach:show"));
            onComplete();
        } else {
            setStep(s => s + 1);
        }
    }, [isLast, onComplete, queryClient, completeOnboarding]);

    // Substituir handleSkip inteiro:
    const handleSkip = useCallback(async () => {
        try {
            await apiClient.post("/auth/onboarding/skip");
        } catch { }
        // Atualiza authStore optimisticamente
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
            useAuthStore.getState().setUser({
                ...currentUser,
                settings: {
                    ...((currentUser as any).settings || {}),
                    onboarding: { skipped: true },
                },
            } as any);
        }
        queryClient.invalidateQueries({ queryKey: AUTH_KEYS.me });
        onComplete();
    }, [onComplete, queryClient]);

    // ── Progress dots ─────────────────────────────────────────────────────────
    const ProgressDots = ({ size = "md" }: { size?: "sm" | "md" }) => (
        <div className="flex items-center justify-center gap-1">
            {STEPS.map((_, i) => (
                <div key={i} className={cn(
                    "rounded-full transition-all duration-300",
                    size === "sm"
                        ? (i === step ? "w-3 h-1 bg-primary" : "w-1 h-1 bg-muted")
                        : (i === step ? "w-6 h-2 bg-primary" : "w-2 h-2 bg-muted")
                )} />
            ))}
        </div>
    );

    // ── Welcome modal ─────────────────────────────────────────────────────────
    if (isWelcome) {
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
                    {/* Icon */}
                    <div className="flex justify-center">
                        <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
                            <GraduationCap className="h-10 w-10 text-primary" />
                        </div>
                    </div>

                    {/* Text */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-primary uppercase tracking-widest">
                            Tour da plataforma
                        </p>
                        <h1 className="font-display text-xl font-bold text-foreground">
                            {user?.name?.split(" ")[0]
                                ? `${user.name.split(" ")[0]}, sua aprovação começa aqui!`
                                : "Sua aprovação começa aqui!"}
                        </h1>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Em menos de 2 minutos você vai conhecer tudo que a plataforma oferece.
                        </p>
                    </div>

                    {/* Progress */}
                    <ProgressDots size="md" />

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={handleNext}
                            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                        >
                            Começar tour <ArrowRight className="h-4 w-4" />
                        </button>
                        <button
                            onClick={handleSkip}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
                        >
                            Pular — já conheço a plataforma
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Spotlight + Tooltip steps ─────────────────────────────────────────────
    const ready = rect && !navigating;
    const tooltipPos = ready ? getTooltipPos(rect, current.position || "bottom", vw, vh) : null;

    return (
        <>
            {/* Skip button — always visible */}
            {!navigating && (
                <button
                    onClick={handleSkip}
                    className="fixed top-4 right-4 z-[10000] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/90 border border-border text-xs text-muted-foreground hover:text-foreground backdrop-blur-sm transition-colors shadow-lg"
                >
                    <X className="h-3 w-3" />
                    Pular tour
                </button>
            )}

            {/* Loading overlay while navigating */}
            {navigating && (
                <div className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                    <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    <p className="text-sm text-muted-foreground">Carregando...</p>
                </div>
            )}

            {/* SVG overlay with spotlight hole */}
            {ready && (
                <svg
                    className="fixed inset-0 z-[9998] cursor-pointer"
                    width={vw}
                    height={vh}
                    onClick={handleNext}
                    style={{ pointerEvents: "all" }}
                >
                    <defs>
                        <mask id="onboarding-spotlight">
                            <rect width={vw} height={vh} fill="white" />
                            <rect
                                x={rect.left - PADDING}
                                y={rect.top - PADDING}
                                width={rect.width + PADDING * 2}
                                height={rect.height + PADDING * 2}
                                rx="10"
                                fill="black"
                            />
                        </mask>
                    </defs>
                    {/* Dark overlay */}
                    <rect
                        width={vw}
                        height={vh}
                        fill="rgba(0,0,0,0.78)"
                        mask="url(#onboarding-spotlight)"
                    />
                    {/* Highlight border */}
                    <rect
                        x={rect.left - PADDING}
                        y={rect.top - PADDING}
                        width={rect.width + PADDING * 2}
                        height={rect.height + PADDING * 2}
                        rx="10"
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="1.5"
                        strokeDasharray="5 3"
                    />
                </svg>
            )}

            {/* Tooltip card */}
            {ready && tooltipPos && (
                <div
                    className="fixed z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-200"
                    style={{ top: tooltipPos.top, left: tooltipPos.left, width: tooltipPos.width }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
                        {/* Top accent */}
                        <div className="h-0.5 bg-primary" />

                        <div className="p-4 space-y-3">
                            {/* Header */}
                            <div className="flex items-start gap-2">
                                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                    {current.icon}
                                </div>
                                <p className="text-sm font-semibold text-foreground leading-snug flex-1">
                                    {current.title}
                                </p>
                            </div>

                            {/* Description */}
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {current.description}
                            </p>

                            {/* Footer */}
                            <div className="flex items-center justify-between gap-2 pt-1">
                                <ProgressDots size="sm" />

                                <button
                                    onClick={handleNext}
                                    className={cn(
                                        "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0",
                                        isLast
                                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                            : "bg-primary/10 text-primary hover:bg-primary/20"
                                    )}
                                >
                                    {current.cta}
                                    {!isLast && <ChevronRight className="h-3 w-3" />}
                                </button>
                            </div>

                            <p className="text-[10px] text-muted-foreground/60 text-center">
                                {step + 1} de {STEPS.length} · clique em qualquer lugar para avançar
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}