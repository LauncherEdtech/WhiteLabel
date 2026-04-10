// frontend/src/app/(student)/dashboard/page.tsx
"use client";

import { useStudentDashboard } from "@/lib/hooks/useAnalytics";
import { useAuthStore } from "@/lib/stores/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Target, BookOpen, Clock, TrendingUp,
    CheckCircle2, AlertCircle, Lightbulb,
    ChevronRight, Calendar, BarChart3,
    AlertTriangle, Zap, ListChecks,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type {
    Insight, ScheduleItem, DisciplinePerformance, WeeklyMission, WeeklyMissionItem,
} from "@/types/api";

export default function DashboardPage() {
    const { user } = useAuthStore();
    const { data, isLoading, error } = useStudentDashboard();

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
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                    Dashboard
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Acompanhe seu progresso de hoje
                </p>
            </div>

            {/* Cards de métricas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
                <MetricCard
                    icon={<Target className="h-5 w-5" />}
                    label="Acerto geral"
                    value={`${questions.overall_accuracy}%`}
                    sub={`${questions.total_correct} de ${questions.total_answered}`}
                    color="primary"
                />
                <MetricCard
                    icon={<BookOpen className="h-5 w-5" />}
                    label="Questões hoje"
                    value={String(questions.today.answered)}
                    sub={`${questions.today.accuracy}% de acerto`}
                    color="secondary"
                />
                <MetricCard
                    icon={<Clock className="h-5 w-5" />}
                    label="Tempo hoje"
                    value={`${Math.round(time_studied.today_minutes)}min`}
                    sub={`${Math.round(time_studied.week_minutes)}min esta semana`}
                    color="warning"
                />
                <MetricCard
                    icon={<TrendingUp className="h-5 w-5" />}
                    label="Aulas assistidas"
                    value={`${lesson_progress.total_watched}`}
                    sub={`de ${lesson_progress.total_available} disponíveis`}
                    color="success"
                />
            </div>

            {/* Missão Semanal — baseada em tarefas */}
            <WeeklyMissionCard mission={weekly_mission} />

            {/* Grid: Pendências + Desempenho */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Pendências de hoje */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                                <Calendar className="h-4 w-4 inline mr-2 text-primary" />
                                Pendências de hoje
                            </CardTitle>
                            <Link
                                href="/schedule"
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                                Cronograma <ChevronRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {todays_pending.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-6 text-center">
                                <CheckCircle2 className="h-8 w-8 text-success" />
                                <p className="text-sm font-medium text-foreground">
                                    Tudo em dia!
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Nenhuma pendência para hoje.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
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

                {/* Desempenho por disciplina */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                                <BarChart3 className="h-4 w-4 inline mr-2 text-primary" />
                                Desempenho
                            </CardTitle>
                            <Link
                                href="/analytics"
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                                Detalhes <ChevronRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {discipline_performance.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-6 text-center">
                                <BarChart3 className="h-8 w-8 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                    Responda questões para ver seu desempenho.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
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
                    <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="h-4 w-4 text-warning" />
                        <h2 className="text-sm font-semibold text-foreground">
                            Análise inteligente
                        </h2>
                    </div>
                    <div className="space-y-3">
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
// MISSÃO SEMANAL — card de tarefas
// ══════════════════════════════════════════════════════════════════════════════

function WeeklyMissionCard({ mission }: { mission: WeeklyMission | undefined }) {
    // Fallback seguro: API ainda sem o campo (deploy gradual)
    if (!mission) return null;

    const { has_schedule, items, total_items, completed_items } = mission;
    const allDone = total_items > 0 && completed_items >= total_items;

    return (
        <Card className={cn(
            "border transition-colors",
            allDone
                ? "border-success/40 bg-success/5"
                : "border-border"
        )}>
            <CardContent className="p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center",
                            allDone ? "bg-success/15" : "bg-primary/10"
                        )}>
                            {allDone
                                ? <CheckCircle2 className="h-4 w-4 text-success" />
                                : <ListChecks className="h-4 w-4 text-primary" />
                            }
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground leading-none">
                                Missão semanal
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {allDone
                                    ? "Todas as missões concluídas! 🏆"
                                    : total_items === 0
                                        ? "Sem missões esta semana"
                                        : `${completed_items} de ${total_items} concluída${total_items > 1 ? "s" : ""}`
                                }
                            </p>
                        </div>
                    </div>

                    {/* Badge de progresso */}
                    {total_items > 0 && (
                        <span className={cn(
                            "text-xs font-bold px-2.5 py-1 rounded-full",
                            allDone
                                ? "bg-success/15 text-success"
                                : "bg-primary/10 text-primary"
                        )}>
                            {completed_items}/{total_items}
                        </span>
                    )}
                </div>

                {/* Sem cronograma: CTA */}
                {!has_schedule && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/60 border border-dashed border-border mb-3">
                        <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground">
                                Você ainda não tem um cronograma
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Crie um para acompanhar sua evolução semana a semana.
                            </p>
                        </div>
                        <Link href="/schedule">
                            <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs">
                                Criar <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                        </Link>
                    </div>
                )}

                {/* Lista de missões */}
                {items.length > 0 ? (
                    <div className="space-y-2.5">
                        {items.map((item, i) => (
                            <MissionItem key={i} item={item} />
                        ))}
                    </div>
                ) : has_schedule ? (
                    <div className="flex items-center gap-2 py-3 text-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <p className="text-xs text-muted-foreground">
                            Nenhuma missão pendente esta semana.
                        </p>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}

function MissionItem({ item }: { item: WeeklyMissionItem }) {
    if (item.type === "schedule") {
        const pct = item.progress_pct ?? 0;
        const done = item.done ?? false;

        return (
            <Link href="/schedule" className="block group">
                <div className={cn(
                    "p-3 rounded-lg border transition-colors group-hover:border-primary/30",
                    done ? "bg-success/5 border-success/20" : "bg-card border-border"
                )}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {done
                                ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                                : <Calendar className="h-4 w-4 text-primary shrink-0" />
                            }
                            <span className={cn(
                                "text-xs font-medium",
                                done ? "text-success" : "text-foreground"
                            )}>
                                {item.title}
                            </span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                            {item.completed}/{item.total}
                        </span>
                    </div>

                    {/* Barra de progresso */}
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                            className={cn(
                                "h-full rounded-full transition-all duration-500",
                                done ? "bg-success" : pct >= 60 ? "bg-primary" : "bg-primary/70"
                            )}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {done ? "Semana concluída! 🎯" : `${pct}% concluído`}
                    </p>
                </div>
            </Link>
        );
    }

    if (item.type === "discipline_accuracy") {
        const current = item.current_accuracy ?? 0;
        const target = item.target_accuracy ?? 60;
        const urgent = item.urgent ?? false;
        // Progresso: 0% (entrada) → 100% (atingiu 60%)
        const pct = Math.min(Math.round((current / target) * 100), 100);

        return (
            <Link href="/questions" className="block group">
                <div className={cn(
                    "p-3 rounded-lg border transition-colors group-hover:border-primary/30",
                    urgent
                        ? "bg-destructive/5 border-destructive/20"
                        : "bg-warning/5 border-warning/20"
                )}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className={cn(
                                "h-4 w-4 shrink-0",
                                urgent ? "text-destructive" : "text-warning"
                            )} />
                            <span className="text-xs font-medium text-foreground">
                                {item.title}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <span className={cn(
                                "text-xs font-bold",
                                urgent ? "text-destructive" : "text-warning"
                            )}>
                                {current}%
                            </span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                                {target}%
                            </span>
                        </div>
                    </div>

                    {/* Barra de progresso */}
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                            className={cn(
                                "h-full rounded-full transition-all duration-500",
                                urgent ? "bg-destructive" : "bg-warning"
                            )}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {urgent
                            ? `Acerto crítico — pratique questões de ${item.discipline}`
                            : `Melhorando — meta: ${target}% de acerto`
                        }
                    </p>
                </div>
            </Link>
        );
    }

    return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Sub-componentes existentes (mantidos intactos)
// ══════════════════════════════════════════════════════════════════════════════

function MetricCard({
    icon, label, value, sub, color,
}: {
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
            <CardContent className="p-4">
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-3", colors[color])}>
                    {icon}
                </div>
                <p className="font-display text-2xl font-bold text-foreground leading-none">
                    {value}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
                {sub && (
                    <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{sub}</p>
                )}
            </CardContent>
        </Card>
    );
}

function PendingItem({ item }: { item: ScheduleItem }) {
    const typeLabel = {
        lesson: "Aula",
        questions: "Questões",
        review: "Revisão",
        simulado: "Simulado",
    };

    return (
        <Link href="/schedule" className="block">
            <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors">
                <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                        {item.lesson?.title ?? item.subject?.name ?? typeLabel[item.type] ?? item.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
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
                <span
                    className="text-xs font-bold"
                    style={{ color }}
                >
                    {discipline.accuracy_rate}%
                </span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                        width: `${discipline.accuracy_rate}%`,
                        backgroundColor: color,
                    }}
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
            <CardContent className="p-4">
                <div className="flex items-start gap-2">
                    <span className="text-xl">{insight.icon}</span>
                    <div>
                        <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {insight.message}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="h-8 w-40 bg-muted rounded-lg" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-28 bg-muted rounded-xl" />
                ))}
            </div>
            <div className="h-40 bg-muted rounded-xl" />
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="h-64 bg-muted rounded-xl" />
                <div className="h-64 bg-muted rounded-xl" />
            </div>
        </div>
    );
}

function DashboardError() {
    return (
        <div className="flex flex-col items-center gap-3 py-20">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="font-medium text-foreground">Erro ao carregar o dashboard</p>
            <p className="text-sm text-muted-foreground">
                Verifique sua conexão e tente novamente.
            </p>
        </div>
    );
}