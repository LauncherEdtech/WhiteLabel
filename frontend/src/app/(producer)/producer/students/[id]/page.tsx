// frontend/src/app/(producer)/producer/students/[id]/page.tsx
"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import {
  ChevronLeft, User, Target, Clock,
  BookOpen, TrendingUp, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { formatRelative } from "@/lib/utils/date";

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "student", "dashboard", id],
    queryFn: () => analyticsApi.studentDashboard(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse max-w-3xl">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 rounded-xl" />
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
    );
  }

  if (!data) return null;

  const { student, questions, time_studied, lesson_progress, discipline_performance, insights } = data;

  const hasRisk = questions.overall_accuracy < 40 ||
    time_studied.weekly_progress_percent < 20;

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/producer/students">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold text-foreground">
              {student.name}
            </h1>
            {hasRisk && (
              <Badge variant="warning" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Atenção necessária
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            icon: <Target className="h-4 w-4" />, label: "Acerto geral", value: `${questions.overall_accuracy}%`,
            color: questions.overall_accuracy >= 60 ? "success" : "destructive" as any
          },
          { icon: <BookOpen className="h-4 w-4" />, label: "Questões", value: questions.total_answered, color: "primary" as any },
          { icon: <Clock className="h-4 w-4" />, label: "Esta semana", value: `${Math.round(time_studied.week_minutes)}min`, color: "secondary" as any },
          { icon: <TrendingUp className="h-4 w-4" />, label: "Aulas", value: `${lesson_progress.total_watched}/${lesson_progress.total_available}`, color: "warning" as any },
        ].map(({ icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-3">
              <div className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center mb-2",
                `bg-${color}/10 text-${color}`
              )}>
                {icon}
              </div>
              <p className="text-xl font-display font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Meta semanal */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-foreground">Meta semanal</p>
            <span className={cn(
              "text-sm font-semibold",
              time_studied.weekly_progress_percent >= 80 ? "text-success" :
                time_studied.weekly_progress_percent >= 40 ? "text-warning" : "text-destructive"
            )}>
              {time_studied.weekly_progress_percent}%
            </span>
          </div>
          <ProgressBar
            value={time_studied.weekly_progress_percent}
            color={time_studied.weekly_progress_percent >= 80 ? "success" :
              time_studied.weekly_progress_percent >= 40 ? "warning" : "destructive"}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {Math.round(time_studied.week_minutes)}min de {time_studied.weekly_goal_minutes}min
          </p>
        </CardContent>
      </Card>

      {/* Performance por disciplina */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance por disciplina</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {discipline_performance.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aluno ainda não respondeu questões.
            </p>
          ) : discipline_performance.map((d: any) => (
            <div key={d.discipline} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">{d.discipline}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={
                    d.performance_label === "forte" ? "success" :
                      d.performance_label === "regular" ? "warning" : "destructive"
                  } className="text-xs">
                    {d.performance_label}
                  </Badge>
                  <span className={cn(
                    "text-sm font-bold",
                    d.performance_label === "forte" ? "text-success" :
                      d.performance_label === "regular" ? "text-warning" : "text-destructive"
                  )}>
                    {d.accuracy_rate}%
                  </span>
                </div>
              </div>
              <ProgressBar
                value={d.accuracy_rate}
                color={d.performance_label === "forte" ? "success" :
                  d.performance_label === "regular" ? "warning" : "destructive"}
                size="sm"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Insights do aluno */}
      {insights?.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Insights deste aluno</p>
          {insights.map((insight: any, i: number) => (
            <Card key={i} className={cn(
              "border-l-4",
              insight.type === "weakness" ? "border-l-destructive" :
                insight.type === "motivation" ? "border-l-success" : "border-l-warning"
            )}>
              <CardContent className="p-3 flex items-start gap-2">
                <span className="text-lg">{insight.icon}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{insight.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{insight.message}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}