// frontend/src/app/(student)/dashboard/page.tsx
"use client";

import { useState } from "react";
import { useStudentDashboard } from "@/lib/hooks/useAnalytics";
import { useAuthStore } from "@/lib/stores/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Brain } from "lucide-react";
import {
    Target, BookOpen, Clock, TrendingUp,
    CheckCircle2, AlertCircle, Lightbulb,
    ChevronRight, ChevronDown, Calendar, BarChart3,
    AlertTriangle, ListChecks, Play, HelpCircle,
    RotateCcw, FileText,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type {
    Insight, ScheduleItem, DisciplinePerformance,
    WeeklyMission, WeeklyMissionItem, WeeklyMissionPendingItem,
} from "@/types/api";

export default function DashboardPage() {
    const { user } = useAuthStore();
    const { data, isLoading, error } = useStudentDashboard();
    const queryClient = useQueryClient();

    const showCoach = () => {
        localStorage.removeItem("coach_widget_dismiss");
        queryClient.invalidateQueries({ queryKey: ["next-action"] });
        window.dispatchEvent(new Event("coach:show"));
    };

    if (isLoading) return <DashboardSkeleton />;
    if (error || !data) return <DashboardError />;

    const {
        questions,
        time_studied,
        lesson_progress,
        discipline_performance,
        todays_pending,
        weekly_mission,
        insights,
    } = data;

    return (
        <div className="space-y-4 lg:space-y-6 animate-fade-in">

            {/* Header — mobile compacto */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-xl lg:text-2xl font-bold text-foreground">
                        Dashboard
                    </h1>
                    <p className="text-xs lg:text-sm text-muted-foreground mt-0.5">
                        Acompanhe seu progresso de hoje
                    </p>
                </div>
                <button
                    onClick={showCoach}
                    title="Ver sugestão do Mentor Inteligente"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-primary/40 px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
                >
                    <Brain className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Mentor Inteligente</span>
                </button>
            </div>

            {/* Cards de métricas — mobile: 2x2, desktop: 1x4 */}
            <div data-onboarding="metrics" className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                <MetricCard
                    icon={<Target className="h-4 w-4 lg:h-5 lg:w-5" />}
                    label="Acerto geral"
                    value={`${questions.overall_accuracy}%`}
                    sub={`${questions.total_correct}/${questions.total_answered}`}
                    color="primary"
                />
                <MetricCard
                    icon={<BookOpen className="h-4 w-4 lg:h-5 lg:w-5" />}
                    label="Questões hoje"
                    value={String(questions.today.answered)}
                    sub={`${questions.today.accuracy}% acerto`}
                    color="secondary"
                />
                <MetricCard
                    icon={<Clock className="h-4 w-4 lg:h-5 lg:w-5" />}
                    label="Tempo hoje"
                    value={`${Math.round(time_studied.today_minutes)}min`}
                    sub={`${Math.round(time_studied.week_minutes)}min semana`}
                    color="warning"
                />
                <MetricCard
                    icon={<TrendingUp className="h-4 w-4 lg:h-5 lg:w-5" />}
                    label="Aulas"
                    value={`${lesson_progress.total_watched}`}
                    sub={`de ${lesson_progress.total_available}`}
                    color="success"
                />
            </div>

            {/* Missão Semanal */}
            <div data-onboarding="mission">
                <WeeklyMissionCard mission={weekly_mission} />
            </div>

            {/* Grid: Pendências + Desempenho */}
            <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
                <Card>
                    <CardHeader className="pb-2 lg:pb-3 px-4 pt-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm lg:text-base">
                                <Calendar className="h-3.5 w-3.5 lg:h-4 lg:w-4 inline mr-1.5 text-primary" />
                                Pendências de hoje
                            </CardTitle>
                            <Link href="/schedule" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                                Ver <ChevronRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0 px-4 pb-4">
                        {todays_pending.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-4 text-center">
                                <CheckCircle2 className="h-7 w-7 text-success" />
                                <p className="text-sm font-medium text-foreground">Tudo em dia!</p>
                                <p className="text-xs text-muted-foreground">Nenhuma pendência.</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {todays_pending.slice(0, 4).map((item) => (
                                    <PendingItem key={item.id} item={item} />
                                ))}
                                {todays_pending.length > 4 && (
                                    <p className="text-xs text-muted-foreground text-center pt-1">
                                        +{todays_pending.length - 4} itens
                                    </p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2 lg:pb-3 px-4 pt-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm lg:text-base">
                                <BarChart3 className="h-3.5 w-3.5 lg:h-4 lg:w-4 inline mr-1.5 text-primary" />
                                Desempenho
                            </CardTitle>
                            <Link href="/analytics" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                                Ver <ChevronRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0 px-4 pb-4">
                        {discipline_performance.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-4 text-center">
                                <BarChart3 className="h-7 w-7 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground">
                                    Responda questões para ver seu desempenho.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2 lg:space-y-3">
                                {discipline_performance.slice(0, 5).map((d) => (
                                    <DisciplineBar key={d.discipline} discipline={d} />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Insights */}
            {insights.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2 lg:mb-3">
                        <Lightbulb className="h-4 w-4 text-warning" />
                        <h2 className="text-sm font-semibold text-foreground">Mentor inteligente</h2>
                    </div>
                    <div className="space-y-2 lg:space-y-3">
                        {insights.map((insight, i) => (
                            <InsightCard key={i} insight={insight} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// MISSÃO SEMANAL
// ══════════════════════════════════════════════════════════════════════════════

function WeeklyMissionCard({ mission }: { mission: WeeklyMission | undefined }) {
    if (!mission) return null;

    const { has_schedule, items, total_items, completed_items } = mission;
    const allDone = total_items > 0 && completed_items >= total_items;

    return (
        <Card className={cn(
            "border transition-colors",
            allDone ? "border-success/40 bg-success/5" : "border-border"
        )}>
            <CardContent className="p-3 lg:p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "h-7 w-7 rounded-md flex items-center justify-center shrink-0",
                            allDone ? "bg-success/15" : "bg-primary/10"
                        )}>
                            {allDone
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                : <ListChecks className="h-3.5 w-3.5 text-primary" />
                            }
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground leading-none">
                                Missão semanal
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {allDone
                                    ? "Todas concluídas 🏆"
                                    : total_items === 0
                                        ? "Sem missões esta semana"
                                        : `${completed_items} de ${total_items} concluída${total_items !== 1 ? "s" : ""}`
                                }
                            </p>
                        </div>
                    </div>
                    {total_items > 0 && (
                        <span className={cn(
                            "text-xs font-bold px-2 py-0.5 rounded-full shrink-0",
                            allDone
                                ? "bg-success/15 text-success"
                                : completed_items === 0
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-primary/10 text-primary"
                        )}>
                            {completed_items}/{total_items}
                        </span>
                    )}
                </div>

                {!has_schedule && (
                    <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg bg-muted/50 border border-dashed border-border">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p className="text-xs text-muted-foreground flex-1">
                            Crie um cronograma para acompanhar sua evolução.
                        </p>
                        <Link href="/schedule">
                            <Button size="sm" variant="outline" className="h-6 text-xs px-2 shrink-0">
                                Criar
                            </Button>
                        </Link>
                    </div>
                )}

                {items.length > 0 && (
                    <div className="relative">
                        <div
                            className="space-y-1.5 overflow-y-auto"
                            style={{
                                maxHeight: "224px",
                                scrollbarWidth: "thin",
                                scrollbarColor: "hsl(var(--border)) transparent",
                            }}
                        >
                            {items.map((item, i) => (
                                <MissionItem key={i} item={item} />
                            ))}
                        </div>
                        {items.length > 4 && (
                            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ScheduleMissionItem({ item }: { item: WeeklyMissionItem }) {
    const [open, setOpen] = useState(false);
    const pct = item.progress_pct ?? 0;
    const done = item.done ?? false;
    const pending = item.pending_items ?? [];

    const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const TYPE_LABEL: Record<string, string> = {
        lesson: "Aula", questions: "Questões", review: "Revisão", simulado: "Simulado",
    };
    const TYPE_ICON: Record<string, React.ReactNode> = {
        lesson: <Play className="h-3 w-3 text-primary" />,
        questions: <HelpCircle className="h-3 w-3 text-secondary" />,
        review: <RotateCcw className="h-3 w-3 text-warning" />,
        simulado: <FileText className="h-3 w-3 text-destructive" />,
    };

    const byDate = pending.reduce<Record<string, WeeklyMissionPendingItem[]>>((acc, p) => {
        if (!acc[p.scheduled_date]) acc[p.scheduled_date] = [];
        acc[p.scheduled_date].push(p);
        return acc;
    }, {});

    return (
        <div className={cn(
            "rounded-lg border transition-colors overflow-hidden",
            done ? "bg-success/5 border-success/20" : "bg-card border-border"
        )}>
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center gap-3 p-2.5 hover:bg-accent/50 transition-colors text-left"
            >
                <div className={cn(
                    "h-6 w-6 rounded flex items-center justify-center shrink-0",
                    done ? "bg-success/15" : "bg-primary/10"
                )}>
                    {done
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        : <Calendar className="h-3.5 w-3.5 text-primary" />
                    }
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                        <span className="text-xs text-muted-foreground shrink-0">
                            {item.completed}/{item.total}
                        </span>
                    </div>
                    <div className="mt-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                        <div
                            className={cn("h-full rounded-full transition-all duration-500",
                                done ? "bg-success" : "bg-primary"
                            )}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
                <ChevronDown className={cn(
                    "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
                    open && "rotate-180"
                )} />
            </button>

            {open && (
                <div className="border-t border-border bg-muted/30 px-2.5 py-2 space-y-2">
                    {pending.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">
                            Nenhuma atividade pendente esta semana. 🎯
                        </p>
                    ) : (
                        <>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
                                Pendentes esta semana
                            </p>
                            {Object.entries(byDate).map(([date, dayItems]) => {
                                const d = new Date(date + "T12:00:00");
                                const dayName = DAY_NAMES[d.getDay()];
                                const dayNum = d.getDate();
                                return (
                                    <div key={date}>
                                        <p className="text-[10px] text-muted-foreground/60 px-1 mb-1">
                                            {dayName} {dayNum}
                                        </p>
                                        {dayItems.map(p => (
                                            <Link key={p.id} href="/schedule" className="block">
                                                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors">
                                                    <div className="h-5 w-5 rounded bg-background flex items-center justify-center shrink-0">
                                                        {TYPE_ICON[p.item_type] ?? <Calendar className="h-3 w-3 text-muted-foreground" />}
                                                    </div>
                                                    <p className="text-xs text-foreground flex-1 truncate">
                                                        {p.lesson?.title ?? p.subject?.name ?? TYPE_LABEL[p.item_type] ?? p.item_type}
                                                    </p>
                                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                                        {p.estimated_minutes}min
                                                    </span>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                );
                            })}
                            {(item.total ?? 0) - (item.completed ?? 0) > pending.length && (
                                <Link href="/schedule">
                                    <p className="text-[10px] text-primary text-center pt-1 hover:underline">
                                        Ver todos no cronograma →
                                    </p>
                                </Link>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function DisciplineClusterItem({ item }: { item: WeeklyMissionItem }) {
    const [open, setOpen] = useState(false);
    const disciplines = item.disciplines ?? [];
    const urgentCount = disciplines.filter(d => d.urgent).length;

    return (
        <div className={cn(
            "rounded-lg border overflow-hidden transition-colors",
            item.done ? "bg-success/5 border-success/20"
                : urgentCount > 0 ? "bg-destructive/5 border-destructive/15"
                    : "bg-warning/5 border-warning/15"
        )}>
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center gap-3 p-2.5 hover:bg-accent/50 transition-colors text-left"
            >
                <div className={cn(
                    "h-6 w-6 rounded flex items-center justify-center shrink-0",
                    urgentCount > 0 ? "bg-destructive/15" : "bg-warning/15"
                )}>
                    <AlertTriangle className={cn(
                        "h-3.5 w-3.5",
                        urgentCount > 0 ? "text-destructive" : "text-warning"
                    )} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                        <span className={cn(
                            "text-xs font-bold shrink-0",
                            urgentCount > 0 ? "text-destructive" : "text-warning"
                        )}>
                            {disciplines.length} disc.
                        </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        {urgentCount > 0
                            ? `${urgentCount} crítica${urgentCount !== 1 ? "s" : ""} — abaixo de 40%`
                            : "Melhorando — meta: 60% de acerto"}
                    </p>
                </div>
                <ChevronDown className={cn(
                    "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
                    open && "rotate-180"
                )} />
            </button>

            {open && (
                <div className="border-t border-border bg-muted/30 px-2.5 py-2 space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1.5">
                        Disciplinas para melhorar
                    </p>
                    {disciplines.map((disc, i) => {
                        const pct = Math.min(
                            Math.round((disc.current_accuracy / disc.target_accuracy) * 100),
                            100
                        );
                        return (
                            <Link key={i} href="/questions" className="block">
                                <div className="px-2 py-2 rounded-md hover:bg-accent transition-colors">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-xs text-foreground font-medium truncate flex-1">
                                            {disc.discipline}
                                        </p>
                                        <span className={cn(
                                            "text-xs font-bold shrink-0 ml-2",
                                            disc.urgent ? "text-destructive" : "text-warning"
                                        )}>
                                            {disc.current_accuracy}%
                                            <span className="text-muted-foreground font-normal"> → {disc.target_accuracy}%</span>
                                        </span>
                                    </div>
                                    <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                        <div
                                            className={cn("h-full rounded-full transition-all duration-500",
                                                disc.urgent ? "bg-destructive" : "bg-warning"
                                            )}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function MissionItem({ item }: { item: WeeklyMissionItem }) {
    if (item.type === "schedule") return <ScheduleMissionItem item={item} />;
    if (item.type === "discipline_cluster") return <DisciplineClusterItem item={item} />;
    return null;
}

function MetricCard({ icon, label, value, sub, color }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    sub?: string;
    color: "primary" | "secondary" | "success" | "warning";
}) {
    const colors = {
        primary: "bg-primary/10 text-primary",
        secondary: "bg-secondary/10 text-secondary",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
    };
    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-3 lg:p-4">
                <div className={cn("h-8 w-8 lg:h-9 lg:w-9 rounded-lg flex items-center justify-center mb-2 lg:mb-3", colors[color])}>
                    {icon}
                </div>
                <p className="font-display text-xl lg:text-2xl font-bold text-foreground leading-none">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
                {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{sub}</p>}
            </CardContent>
        </Card>
    );
}

function PendingItem({ item }: { item: ScheduleItem }) {
    const typeLabel: Record<string, string> = {
        lesson: "Aula", questions: "Questões", review: "Revisão", simulado: "Simulado",
    };

    const fullTitle = item.lesson?.title ?? item.subject?.name ?? typeLabel[item.type] ?? item.type;

    // Limita caracteres só no mobile (< 1024px)
    const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;
    const title = isMobile && fullTitle.length > 40
        ? fullTitle.slice(0, 40) + "..."
        : fullTitle;

    return (
        <Link href="/schedule" className="block">
            <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-accent transition-colors">
                <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="h-3 w-3 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">
                        {title}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                        {typeLabel[item.type]} · {item.estimated_minutes}min
                    </p>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            </div>
        </Link>
    );
}

function DisciplineBar({ discipline }: { discipline: DisciplinePerformance }) {
    const color =
        discipline.performance_label === "forte"
            ? "hsl(var(--success))"
            : discipline.performance_label === "regular"
                ? "hsl(var(--warning))"
                : "hsl(var(--destructive))";
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <span className="text-xs text-foreground font-medium truncate max-w-[65%]">
                    {discipline.discipline}
                </span>
                <span className="text-xs font-bold" style={{ color }}>
                    {discipline.accuracy_rate}%
                </span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${discipline.accuracy_rate}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
}

function InsightCard({ insight }: { insight: Insight }) {
    const borderColor: Record<string, string> = {
        motivation: "border-l-primary",
        weakness: "border-l-destructive",
        next_step: "border-l-warning",
        alert: "border-l-destructive",
        warning: "border-l-warning",
        positive: "border-l-success",
        suggestion: "border-l-secondary",
    };
    return (
        <Card className={cn("border-l-4 animate-fade-in", borderColor[insight.type] || "border-l-primary")}>
            <CardContent className="p-3 lg:p-4">
                <div className="flex items-start gap-2">
                    <span className="text-lg lg:text-xl">{insight.icon}</span>
                    <div>
                        <p className="text-xs lg:text-sm font-semibold text-foreground">{insight.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{insight.message}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-4 lg:space-y-6 animate-pulse">
            <div className="h-8 w-40 bg-muted rounded-lg" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                {[...Array(4)].map((_, i) => <div key={i} className="h-24 lg:h-28 bg-muted rounded-xl" />)}
            </div>
            <div className="h-32 bg-muted rounded-xl" />
            <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
                <div className="h-48 lg:h-64 bg-muted rounded-xl" />
                <div className="h-48 lg:h-64 bg-muted rounded-xl" />
            </div>
        </div>
    );
}

function DashboardError() {
    return (
        <div className="flex flex-col items-center gap-3 py-20">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="font-medium text-foreground">Erro ao carregar o dashboard</p>
            <p className="text-sm text-muted-foreground">Verifique sua conexão e tente novamente.</p>
        </div>
    );
}