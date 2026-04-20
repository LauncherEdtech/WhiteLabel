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
  ChevronLeft, Target, BookOpen, TrendingUp,
  AlertTriangle, CheckCircle2, ListChecks,
  Sparkles, GraduationCap, Calendar, ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { WeeklyMission, WeeklyMissionItem } from "@/types/api";

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

  const { student, questions, lesson_progress, discipline_performance, insights, weekly_mission } = data;

  const hasRisk = questions.overall_accuracy < 40 ||
    (weekly_mission?.total_items > 0 && weekly_mission.completed_items === 0);

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

      {/* Métricas rápidas — sem minutos, só o essencial */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            icon: <Target className="h-4 w-4" />,
            label: "Acerto geral",
            value: `${questions.overall_accuracy}%`,
            color: questions.overall_accuracy >= 60 ? "success" : "destructive" as any,
          },
          {
            icon: <BookOpen className="h-4 w-4" />,
            label: "Questões",
            value: questions.total_answered,
            color: "primary" as any,
          },
          {
            icon: <TrendingUp className="h-4 w-4" />,
            label: "Aulas",
            value: `${lesson_progress.total_watched}/${lesson_progress.total_available}`,
            color: "warning" as any,
          },
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

      {/* Missão semanal — visão do produtor */}
      <ProducerWeeklyMissionCard mission={weekly_mission} />

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

// ══════════════════════════════════════════════════════════════════════════════
// MISSÃO SEMANAL — VISÃO DO PRODUTOR
// ══════════════════════════════════════════════════════════════════════════════

function ProducerWeeklyMissionCard({ mission }: { mission: WeeklyMission | undefined }) {
  if (!mission) return null;

  const { has_schedule, schedule_source_type, items, total_items, completed_items } = mission;
  const allDone = total_items > 0 && completed_items >= total_items;
  const pct = total_items > 0 ? Math.round((completed_items / total_items) * 100) : 0;

  const scheduleItem = items.find(i => i.type === "schedule");
  const disciplineItem = items.find(i => i.type === "discipline_cluster");

  return (
    <Card className={cn(
      "border transition-colors",
      allDone ? "border-success/40 bg-success/5" : "border-border"
    )}>
      <CardContent className="p-4 space-y-3">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
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
                {!has_schedule
                  ? "Aluno sem cronograma ativo"
                  : allDone
                    ? "Todas as tarefas concluídas"
                    : total_items === 0
                      ? "Sem tarefas esta semana"
                      : `${completed_items} de ${total_items} tarefa${total_items !== 1 ? "s" : ""} concluída${total_items !== 1 ? "s" : ""}`
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Badge tipo do cronograma */}
            {has_schedule && schedule_source_type && (
              <ScheduleSourceBadge sourceType={schedule_source_type} />
            )}
            {/* Contador */}
            {total_items > 0 && (
              <span className={cn(
                "text-xs font-bold px-2 py-0.5 rounded-full",
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
        </div>

        {/* Barra de progresso geral */}
        {has_schedule && total_items > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Progresso das tarefas</span>
              <span className={cn(
                "text-xs font-semibold",
                pct >= 80 ? "text-success" : pct >= 40 ? "text-warning" : "text-destructive"
              )}>
                {pct}%
              </span>
            </div>
            <ProgressBar
              value={pct}
              color={pct >= 80 ? "success" : pct >= 40 ? "warning" : "destructive"}
              size="sm"
            />
          </div>
        )}

        {/* Sem cronograma */}
        {!has_schedule && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border border-dashed border-border">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              Este aluno ainda não criou um cronograma de estudos.
            </p>
          </div>
        )}

        {/* Tarefas do cronograma */}
        {scheduleItem && (
          <ProducerScheduleBlock item={scheduleItem} />
        )}

        {/* Disciplinas a melhorar */}
        {disciplineItem && (
          <ProducerDisciplineBlock item={disciplineItem} />
        )}
      </CardContent>
    </Card>
  );
}

function ScheduleSourceBadge({ sourceType }: { sourceType: "ai" | "producer_template" }) {
  const isProducer = sourceType === "producer_template";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full",
      isProducer
        ? "bg-secondary/15 text-secondary"
        : "bg-primary/10 text-primary"
    )}>
      {isProducer
        ? <><GraduationCap className="h-3 w-3" /> Seu cronograma</>
        : <><Sparkles className="h-3 w-3" /> Gerado pela IA</>
      }
    </span>
  );
}

function ProducerScheduleBlock({ item }: { item: WeeklyMissionItem }) {
  const [open, setOpen] = useState(false);
  const pct = item.progress_pct ?? 0;
  const done = item.done ?? false;
  const pending = item.pending_items ?? [];

  const TYPE_LABEL: Record<string, string> = {
    lesson: "Aula", questions: "Questões", review: "Revisão", simulado: "Simulado",
  };

  const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const byDate = pending.reduce<Record<string, typeof pending>>((acc, p) => {
    if (!acc[p.scheduled_date]) acc[p.scheduled_date] = [];
    acc[p.scheduled_date].push(p);
    return acc;
  }, {});

  return (
    <div className={cn(
      "rounded-lg border overflow-hidden",
      done ? "bg-success/5 border-success/20" : "bg-muted/30 border-border"
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
              {item.completed}/{item.total} tarefas
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
        <div className="border-t border-border bg-background/50 px-2.5 py-2 space-y-2">
          {pending.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              Sem pendências esta semana.
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
                      <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md">
                        <p className="text-xs text-foreground flex-1 truncate">
                          {p.lesson?.title ?? p.subject?.name ?? TYPE_LABEL[p.item_type] ?? p.item_type}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {p.estimated_minutes}min
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ProducerDisciplineBlock({ item }: { item: WeeklyMissionItem }) {
  const [open, setOpen] = useState(false);
  const disciplines = item.disciplines ?? [];
  const urgentCount = disciplines.filter(d => d.urgent).length;

  return (
    <div className={cn(
      "rounded-lg border overflow-hidden",
      urgentCount > 0 ? "bg-destructive/5 border-destructive/15" : "bg-warning/5 border-warning/15"
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
        <div className="border-t border-border bg-background/50 px-2.5 py-2 space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1.5">
            Disciplinas para melhorar
          </p>
          {disciplines.map((disc, i) => {
            const pct = Math.min(
              Math.round((disc.current_accuracy / disc.target_accuracy) * 100),
              100
            );
            return (
              <div key={i} className="px-2 py-2 rounded-md">
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
            );
          })}
        </div>
      )}
    </div>
  );
}