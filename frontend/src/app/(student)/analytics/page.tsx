// frontend/src/app/(student)/analytics/page.tsx
"use client";

import { useStudentDashboard } from "@/lib/hooks/useAnalytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";
import { BarChart3, Target, Clock, BookOpen, Share2 } from "lucide-react";
import type { DisciplinePerformance } from "@/types/api";


function formatStudyTime(minutes: number): string {
    const totalMin = Math.round(minutes);
    if (totalMin < 1) return "0min";
    const h = Math.floor(totalMin / 60);
    const min = totalMin % 60;
    if (h === 0) return `${min}min`;
    if (min === 0) return `${h}h`;
    return `${h}h ${min}min`;
}

export default function AnalyticsPage() {
    const { data, isLoading } = useStudentDashboard();

    if (isLoading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-8 w-48 bg-muted rounded" />
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-32 bg-muted rounded-xl" />
                ))}
            </div>
        );
    }

    if (!data) return null;

    const { questions, time_studied, lesson_progress, discipline_performance } = data;

    const strongDisciplines = discipline_performance.filter(d => d.performance_label === "forte");
    const weakDisciplines = discipline_performance.filter(d => d.performance_label === "fraco");
    const regularDisciplines = discipline_performance.filter(d => d.performance_label === "regular");

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="font-display text-2xl font-bold text-foreground">Desempenho</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Análise completa do seu progresso</p>
            </div>


            {/* ── Cápsula de Estudos ── */}
            <Link href="/study-capsule">
                <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/20 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Share2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">Cápsula de Estudos</p>
                            <p className="text-xs text-muted-foreground">Veja seu resumo mensal e compartilhe nas redes</p>
                        </div>
                    </div>
                    <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        Abrir →
                    </span>
                </div>
            </Link>

            {/* Resumo geral */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { icon: <Target className="h-5 w-5" />, label: "Acerto geral", value: `${questions.overall_accuracy}%`, color: "primary" },
                    { icon: <BarChart3 className="h-5 w-5" />, label: "Total respondidas", value: String(questions.total_answered), color: "secondary" },
                    { icon: <Clock className="h-5 w-5" />, label: "Horas estudadas", value: formatStudyTime(time_studied.week_minutes), color: "warning" },
                    { icon: <BookOpen className="h-5 w-5" />, label: "Aulas assistidas", value: `${lesson_progress.total_watched}/${lesson_progress.total_available}`, color: "success" },
                ].map(({ icon, label, value, color }) => (
                    <Card key={label}>
                        <CardContent className="p-4">
                            <div className={cn(
                                "h-9 w-9 rounded-lg flex items-center justify-center mb-3",
                                `bg-${color}/10 text-${color}`
                            )}>
                                {icon}
                            </div>
                            <p className="text-2xl font-display font-bold text-foreground">{value}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Tabs por performance */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Desempenho por disciplina</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <Tabs defaultValue="all">
                        <TabsList className="mb-4">
                            <TabsTrigger value="all">Todas ({discipline_performance.length})</TabsTrigger>
                            <TabsTrigger value="weak" className="text-destructive">
                                Fracas ({weakDisciplines.length})
                            </TabsTrigger>
                            <TabsTrigger value="strong" className="text-success">
                                Fortes ({strongDisciplines.length})
                            </TabsTrigger>
                        </TabsList>

                        {[
                            { key: "all", disciplines: discipline_performance },
                            { key: "weak", disciplines: weakDisciplines },
                            { key: "strong", disciplines: strongDisciplines },
                        ].map(({ key, disciplines }) => (
                            <TabsContent key={key} value={key} className="space-y-4">
                                {disciplines.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        Nenhuma disciplina nesta categoria ainda.
                                    </p>
                                ) : (
                                    disciplines.map((d: DisciplinePerformance) => (
                                        <DisciplineDetail key={d.discipline} discipline={d} />
                                    ))
                                )}
                            </TabsContent>
                        ))}
                    </Tabs>
                </CardContent>
            </Card>

            {/* Meta semanal */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Missão semanal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            {Math.round(time_studied.week_minutes)}min estudados
                        </span>
                        <span className="font-medium text-foreground">
                            Missão: {time_studied.weekly_goal_minutes}min
                        </span>
                    </div>
                    <ProgressBar
                        value={time_studied.weekly_progress_percent}
                        showPercent
                        color={time_studied.weekly_progress_percent >= 80 ? "success" : "primary"}
                        size="md"
                    />
                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="p-3 rounded-lg bg-muted text-center">
                            <p className="text-lg font-display font-bold text-foreground">
                                {formatStudyTime(time_studied.today_minutes)}
                            </p>
                            <p className="text-xs text-muted-foreground">Hoje</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted text-center">
                            <p className="text-lg font-display font-bold text-foreground">
                                {time_studied.weekly_goal_hours}h
                            </p>
                            <p className="text-xs text-muted-foreground">Missão/semana</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function DisciplineDetail({ discipline }: { discipline: DisciplinePerformance }) {
    const labelVariant = {
        forte: "success" as const,
        regular: "warning" as const,
        fraco: "destructive" as const,
    };

    return (
        <div className="space-y-2 p-3 rounded-xl border border-border hover:border-primary/20 transition-colors">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">{discipline.discipline}</span>
                    <Badge variant={labelVariant[discipline.performance_label]}>
                        {discipline.performance_label}
                    </Badge>
                </div>
                <span className={cn(
                    "font-display text-lg font-bold",
                    discipline.performance_label === "forte" ? "text-success" :
                        discipline.performance_label === "regular" ? "text-warning" : "text-destructive"
                )}>
                    {discipline.accuracy_rate}%
                </span>
            </div>

            <ProgressBar
                value={discipline.accuracy_rate}
                color={discipline.performance_label === "forte" ? "success" :
                    discipline.performance_label === "regular" ? "warning" : "destructive"}
            />

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{discipline.total_answered} questões</span>
                <span className="text-success">{discipline.correct} acertos</span>
                <span className="text-destructive">{discipline.wrong} erros</span>
                {discipline.avg_response_time_seconds > 0 && (
                    <span><Clock className="h-3 w-3 inline" /> {Math.round(discipline.avg_response_time_seconds)}s/questão</span>
                )}
            </div>
        </div>
    );
}