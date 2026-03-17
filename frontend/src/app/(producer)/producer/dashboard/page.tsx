// frontend/src/app/(producer)/producer/dashboard/page.tsx
"use client";

import { useProducerOverview } from "@/lib/hooks/useAnalytics";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import {
    Users, TrendingUp, AlertTriangle,
    BarChart3, ChevronRight, Target,
    UserX, BookOpen,
} from "lucide-react";
import Link from "next/link";
import type { Insight } from "@/types/api";

export default function ProducerDashboardPage() {
    const { data, isLoading } = useProducerOverview();
    const { data: studentsData } = useQuery({
        queryKey: ["producer", "students", { per_page: 5 }],
        queryFn: () => analyticsApi.producerStudents({ per_page: 5 }),
    });

    if (isLoading) return <ProducerDashboardSkeleton />;
    if (!data) return null;

    const { overview, at_risk_students, class_discipline_performance, insights } = data;

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                    Dashboard
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Visão geral da sua turma
                </p>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
                <MetricCard
                    icon={<Users className="h-5 w-5" />}
                    label="Total de alunos"
                    value={String(overview.total_students)}
                    color="primary"
                />
                <MetricCard
                    icon={<TrendingUp className="h-5 w-5" />}
                    label="Engajamento (7d)"
                    value={`${overview.engagement_rate}%`}
                    sub={`${overview.active_last_7_days} ativos`}
                    color="success"
                />
                <MetricCard
                    icon={<AlertTriangle className="h-5 w-5" />}
                    label="Em risco"
                    value={String(overview.at_risk_count)}
                    sub="risco de abandono"
                    color={overview.at_risk_count > 0 ? "warning" : "success"}
                />
                <MetricCard
                    icon={<Target className="h-5 w-5" />}
                    label="Disciplinas"
                    value={String(class_discipline_performance.length)}
                    sub="com dados"
                    color="secondary"
                />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Alunos em risco */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                                <AlertTriangle className="h-4 w-4 inline mr-2 text-warning" />
                                Alunos em risco
                            </CardTitle>
                            <Link href="/producer/students" className="text-xs text-primary hover:underline flex items-center gap-1">
                                Ver todos <ChevronRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {at_risk_students.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-6">
                                <TrendingUp className="h-8 w-8 text-success" />
                                <p className="text-sm text-muted-foreground">
                                    Nenhum aluno em risco no momento.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {at_risk_students.slice(0, 4).map((student: {
                                    id: string; name: string; email: string;
                                    risk_score: number; risk_level: string; risk_reasons: string[]
                                }) => (
                                    <div key={student.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border">
                                        <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                                            <span className="text-xs font-semibold text-warning">
                                                {student.name.charAt(0)}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">
                                                {student.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {student.risk_reasons[0]}
                                            </p>
                                        </div>
                                        <span className={cn(
                                            "text-xs font-medium px-2 py-0.5 rounded-md",
                                            student.risk_level === "alto"
                                                ? "bg-destructive/10 text-destructive"
                                                : "bg-warning/10 text-warning"
                                        )}>
                                            {student.risk_level}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Performance por disciplina */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                            <BarChart3 className="h-4 w-4 inline mr-2 text-primary" />
                            Performance da turma
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {class_discipline_performance.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-6">
                                <BookOpen className="h-8 w-8 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                    Nenhum dado ainda. Aguarde os alunos responderem questões.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {class_discipline_performance.slice(0, 5).map((d: {
                                    discipline: string; accuracy_rate: number; performance_label: string; total_attempts: number
                                }) => (
                                    <div key={d.discipline} className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-foreground truncate max-w-[160px]">
                                                {d.discipline}
                                            </span>
                                            <span className={cn(
                                                "text-sm font-semibold",
                                                d.performance_label === "forte" ? "text-success" :
                                                    d.performance_label === "regular" ? "text-warning" : "text-destructive"
                                            )}>
                                                {d.accuracy_rate}%
                                            </span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${d.accuracy_rate}%`,
                                                    backgroundColor: d.performance_label === "forte"
                                                        ? "hsl(var(--success))"
                                                        : d.performance_label === "regular"
                                                            ? "hsl(var(--warning))"
                                                            : "hsl(var(--destructive))",
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Insights */}
            {insights?.length > 0 && (
                <div>
                    <h2 className="font-display font-semibold text-base text-foreground mb-3">
                        💡 Insights da turma
                    </h2>
                    <div className="grid sm:grid-cols-3 gap-3 stagger">
                        {insights.map((insight: Insight, i: number) => (
                            <Card key={i} className={cn(
                                "border-l-4",
                                insight.type === "alert" ? "border-l-destructive" :
                                    insight.type === "warning" ? "border-l-warning" :
                                        insight.type === "positive" ? "border-l-success" : "border-l-primary"
                            )}>
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-2">
                                        <span className="text-xl">{insight.icon}</span>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.message}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Lista rápida de alunos */}
            {studentsData?.students?.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                                <Users className="h-4 w-4 inline mr-2 text-primary" />
                                Alunos recentes
                            </CardTitle>
                            <Link href="/producer/students" className="text-xs text-primary hover:underline flex items-center gap-1">
                                Ver todos <ChevronRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="space-y-2">
                            {studentsData.students.map((student: {
                                id: string; name: string; email: string;
                                accuracy_rate: number; total_answered: number; is_at_risk: boolean
                            }) => (
                                <Link
                                    key={student.id}
                                    href={`/producer/students/${student.id}`}
                                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors"
                                >
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <span className="text-xs font-semibold text-primary">
                                            {student.name.charAt(0)}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{student.name}</p>
                                        <p className="text-xs text-muted-foreground">{student.total_answered} questões</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className={cn(
                                            "text-sm font-semibold",
                                            student.accuracy_rate >= 70 ? "text-success" :
                                                student.accuracy_rate >= 50 ? "text-warning" : "text-destructive"
                                        )}>
                                            {student.accuracy_rate}%
                                        </p>
                                        {student.is_at_risk && (
                                            <span className="text-xs text-warning">⚠ risco</span>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, sub, color }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    sub?: string;
    color: "primary" | "secondary" | "warning" | "success";
}) {
    const colorMap = {
        primary: "bg-primary/10 text-primary",
        secondary: "bg-secondary/10 text-secondary",
        warning: "bg-warning/10 text-warning",
        success: "bg-success/10 text-success",
    };
    return (
        <Card>
            <CardContent className="p-4">
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-3", colorMap[color])}>
                    {icon}
                </div>
                <p className="text-2xl font-display font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                {sub && <p className="text-xs text-muted-foreground/70">{sub}</p>}
            </CardContent>
        </Card>
    );
}

function ProducerDashboardSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="h-8 w-40 bg-muted rounded" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-28 bg-muted rounded-xl" />
                ))}
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="h-64 bg-muted rounded-xl" />
                <div className="h-64 bg-muted rounded-xl" />
            </div>
        </div>
    );
}