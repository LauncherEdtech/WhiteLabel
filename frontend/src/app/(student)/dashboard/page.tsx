// frontend/src/app/(student)/dashboard/page.tsx
"use client";

import { useStudentDashboard } from "@/lib/hooks/useAnalytics";
import { useAuthStore } from "@/lib/stores/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Target, BookOpen, Clock, TrendingUp,
    CheckCircle2, AlertCircle, Lightbulb,
    ChevronRight, Calendar, BarChart3,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type { Insight, ScheduleItem, DisciplinePerformance } from "@/types/api";

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

            {/* Meta semanal */}
            <Card>
                <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-sm font-medium text-foreground">
                                Missão semanal
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {Math.round(time_studied.week_minutes)}min de{" "}
                                {time_studied.weekly_goal_minutes}min
                            </p>
                        </div>
                        <span
                            className={cn(
                                "text-sm font-semibold",
                                time_studied.weekly_progress_percent >= 80
                                    ? "text-success"
                                    : time_studied.weekly_progress_percent >= 40
                                        ? "text-warning"
                                        : "text-destructive"
                            )}
                        >
                            {time_studied.weekly_progress_percent}%
                        </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full rounded-full bg-primary transition-all duration-700"
                            style={{
                                width: `${Math.min(time_studied.weekly_progress_percent, 100)}%`,
                            }}
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Pendências do dia */}
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
                                Ver tudo <ChevronRight className="h-3 w-3" />
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
                                {discipline_performance.slice(0, 4).map((d) => (
                                    <DisciplineRow key={d.discipline} discipline={d} />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Insights da IA */}
            {insights.length > 0 && (
                <div>
                    <h2 className="font-display font-semibold text-base text-foreground mb-3 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-warning" />
                        Insights para você
                    </h2>
                    <div className="grid sm:grid-cols-3 gap-3 stagger">
                        {insights.map((insight, i) => (
                            <InsightCard key={i} insight={insight} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function MetricCard({
    icon,
    label,
    value,
    sub,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    sub: string;
    color: "primary" | "secondary" | "warning" | "success";
}) {
    const colorMap = {
        primary: "bg-primary/10 text-primary",
        secondary: "bg-secondary/10 text-secondary",
        warning: "bg-warning/10 text-warning",
        success: "bg-success/10 text-success",
    };

    return (
        <Card className="animate-fade-in">
            <CardContent className="p-4">
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-3", colorMap[color])}>
                    {icon}
                </div>
                <p className="text-2xl font-display font-bold text-foreground">
                    {value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>
            </CardContent>
        </Card>
    );
}

function PendingItem({ item }: { item: ScheduleItem }) {
    const typeConfig = {
        lesson: { label: "Aula", color: "bg-primary/10 text-primary" },
        questions: { label: "Questões", color: "bg-secondary/10 text-secondary" },
        review: { label: "Revisão", color: "bg-warning/10 text-warning" },
        simulado: { label: "Simulado", color: "bg-destructive/10 text-destructive" },
    };

    const config = typeConfig[item.type] || typeConfig.lesson;

    return (
        <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors">
            <span
                className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-md shrink-0",
                    config.color
                )}
            >
                {config.label}
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                    {item.lesson?.title || item.subject?.name || "Item de estudo"}
                </p>
                <p className="text-xs text-muted-foreground">
                    {item.estimated_minutes}min
                    {item.subject && ` • ${item.subject.name}`}
                </p>
            </div>
            {item.status === "done" && (
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            )}
        </div>
    );
}

function DisciplineRow({ discipline }: { discipline: DisciplinePerformance }) {
    const labelConfig = {
        forte: "text-success",
        regular: "text-warning",
        fraco: "text-destructive",
    };

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{
                            backgroundColor:
                                discipline.performance_label === "forte"
                                    ? "hsl(var(--success))"
                                    : discipline.performance_label === "regular"
                                        ? "hsl(var(--warning))"
                                        : "hsl(var(--destructive))",
                        }}
                    />
                    <span className="text-sm text-foreground truncate max-w-[140px]">
                        {discipline.discipline}
                    </span>
                </div>
                <span
                    className={cn(
                        "text-sm font-semibold",
                        labelConfig[discipline.performance_label]
                    )}
                >
                    {discipline.accuracy_rate}%
                </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                        width: `${discipline.accuracy_rate}%`,
                        backgroundColor:
                            discipline.performance_label === "forte"
                                ? "hsl(var(--success))"
                                : discipline.performance_label === "regular"
                                    ? "hsl(var(--warning))"
                                    : "hsl(var(--destructive))",
                    }}
                />
            </div>
        </div>
    );
}

function InsightCard({ insight }: { insight: Insight }) {
    const borderColor = {
        motivation: "border-l-primary",
        weakness: "border-l-destructive",
        next_step: "border-l-warning",
        alert: "border-l-destructive",
        warning: "border-l-warning",
        positive: "border-l-success",
        suggestion: "border-l-secondary",
    };

    return (
        <Card
            className={cn(
                "border-l-4 animate-fade-in",
                borderColor[insight.type] || "border-l-primary"
            )}
        >
            <CardContent className="p-4">
                <div className="flex items-start gap-2">
                    <span className="text-xl">{insight.icon}</span>
                    <div>
                        <p className="text-sm font-semibold text-foreground">
                            {insight.title}
                        </p>
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
            <div className="h-20 bg-muted rounded-xl" />
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
            <p className="font-medium text-foreground">
                Erro ao carregar o dashboard
            </p>
            <p className="text-sm text-muted-foreground">
                Verifique sua conexão e tente novamente.
            </p>
        </div>
    );
}