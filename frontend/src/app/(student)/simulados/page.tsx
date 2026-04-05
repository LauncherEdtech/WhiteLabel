// frontend/src/app/(student)/simulados/page.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import {
  Trophy, XCircle, ClipboardList, Clock,
  ChevronRight, Play, BarChart2, Target, Timer, CheckCircle2,
} from "lucide-react";
import { formatSeconds } from "@/lib/utils/format";
import Link from "next/link";
import type { Simulado } from "@/types/api";

function calcStats(simulados: Simulado[]) {
  const completed = simulados.filter(
    s => s.my_attempt?.status === "completed" || s.my_attempt?.status === "timed_out"
  );
  const totalQuestionsAnswered = completed.reduce((acc, s) => acc + (s.my_attempt?.total_questions || 0), 0);
  const totalCorrect = completed.reduce((acc, s) => acc + (s.my_attempt?.correct_answers || 0), 0);
  const totalTimeSeconds = completed.reduce((acc, s) => acc + (s.my_attempt?.total_time_seconds || 0), 0);
  const avgAccuracy = totalQuestionsAnswered > 0 ? Math.round((totalCorrect / totalQuestionsAnswered) * 100) : 0;
  const avgTimePerQuestion = totalQuestionsAnswered > 0 ? Math.round(totalTimeSeconds / totalQuestionsAnswered) : 0;
  return { totalSimulados: simulados.length, completedSimulados: completed.length, totalQuestionsAnswered, totalCorrect, avgAccuracy, avgTimePerQuestion };
}

export default function SimuladosPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["simulados"],
    queryFn: async () => {
      const res = await apiClient.get<{ simulados: Simulado[] }>("/simulados/");
      return res.data.simulados;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
        </div>
        {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }

  const simulados = data || [];
  const stats = calcStats(simulados);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Simulados</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Teste seus conhecimentos com tempo limitado</p>
      </div>

      {/* ── Cards de stats macro ── */}
      {simulados.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className={cn(
                  "font-display text-2xl font-bold",
                  stats.avgAccuracy >= 60 ? "text-success" : stats.avgAccuracy > 0 ? "text-warning" : "text-muted-foreground"
                )}>
                  {stats.avgAccuracy}%
                </p>
                <p className="text-xs font-medium text-foreground">Taxa de acerto</p>
                <p className="text-xs text-muted-foreground">{stats.totalCorrect} de {stats.totalQuestionsAnswered} corretas</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Timer className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-display text-2xl font-bold text-foreground">
                  {stats.avgTimePerQuestion > 0 ? `${stats.avgTimePerQuestion}s` : "--"}
                </p>
                <p className="text-xs font-medium text-foreground">Tempo médio</p>
                <p className="text-xs text-muted-foreground">por questão</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="h-9 w-9 rounded-lg bg-warning/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="font-display text-2xl font-bold text-foreground">{stats.completedSimulados}</p>
                <p className="text-xs font-medium text-foreground">Simulados feitos</p>
                <p className="text-xs text-muted-foreground">de {stats.totalSimulados} disponíveis</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="h-9 w-9 rounded-lg bg-secondary/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="font-display text-2xl font-bold text-foreground">{stats.totalQuestionsAnswered}</p>
                <p className="text-xs font-medium text-foreground">Questões respondidas</p>
                <p className="text-xs text-muted-foreground">{stats.totalCorrect} acertos</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Lista de simulados ── */}
      {simulados.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3">
            <ClipboardList className="h-12 w-12 text-muted-foreground" />
            <p className="font-semibold text-foreground">Nenhum simulado disponível</p>
            <p className="text-sm text-muted-foreground">O produtor ainda não criou simulados para este curso.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {simulados.map((simulado) => (
            <SimuladoCard key={simulado.id} simulado={simulado} />
          ))}
        </div>
      )}
    </div>
  );
}

function SimuladoCard({ simulado }: { simulado: Simulado }) {
  const attempt = simulado.my_attempt;
  const isCompleted = attempt?.status === "completed" || attempt?.status === "timed_out";
  const isInProgress = attempt?.status === "in_progress";

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
            isCompleted
              ? attempt!.score_percent >= 60 ? "bg-success/10" : "bg-destructive/10"
              : "bg-primary/10"
          )}>
            {isCompleted ? (
              attempt!.score_percent >= 60
                ? <Trophy className="h-6 w-6 text-success" />
                : <XCircle className="h-6 w-6 text-destructive" />
            ) : (
              <ClipboardList className="h-6 w-6 text-primary" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">{simulado.title}</p>
            {simulado.description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{simulado.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <ClipboardList className="h-3 w-3" />{simulado.total_questions} questões
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />{simulado.time_limit_minutes}min
              </span>
              {isCompleted && attempt?.total_time_seconds && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <BarChart2 className="h-3 w-3" />
                  ~{Math.round(attempt.total_time_seconds / attempt.total_questions)}s/questão
                </span>
              )}
              {simulado.is_ai_generated && (
                <span className="text-xs bg-secondary/10 text-secondary px-1.5 py-0.5 rounded-md font-medium">IA</span>
              )}
            </div>
            {isCompleted && attempt && (
              <p className="text-xs text-muted-foreground mt-1">
                ⏱ Tempo total: {formatSeconds(attempt.total_time_seconds || 0)}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {isCompleted && (
              <div className="text-right">
                <p className={cn(
                  "font-display text-xl font-bold",
                  attempt!.score_percent >= 60 ? "text-success" : "text-destructive"
                )}>
                  {attempt!.score_percent}%
                </p>
                <p className="text-xs text-muted-foreground">{attempt!.correct_answers}/{attempt!.total_questions}</p>
              </div>
            )}
            <Link href={`/simulados/${simulado.id}`}>
              <Button size="sm" variant={isCompleted ? "outline" : "default"}>
                {isInProgress ? (
                  <><Play className="h-3 w-3" />Continuar</>
                ) : isCompleted ? (
                  <>Ver resultado<ChevronRight className="h-3 w-3" /></>
                ) : (
                  <><Play className="h-3 w-3" />Iniciar</>
                )}
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}