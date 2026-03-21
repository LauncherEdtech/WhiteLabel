// frontend/src/app/(student)/schedule/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { scheduleApi } from "@/lib/api/schedule";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toaster";
import {
  Calendar, CheckCircle2, Clock, BookOpen,
  HelpCircle, RefreshCw, ChevronRight, Sparkles
} from "lucide-react";

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// ── Wizard de configuração ────────────────────────────────────────────────────
function ScheduleWizard({ courseId, onGenerated }: { courseId: string; onGenerated: () => void }) {
  const [step, setStep] = useState(1);
  const [days, setDays] = useState([0, 1, 2, 3, 4]);
  const [hours, setHours] = useState(2);
  const [startTime, setStartTime] = useState("19:00");
  const toast = useToast();
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      await scheduleApi.updateAvailability({ days, hours_per_day: hours, preferred_start_time: startTime });
      await scheduleApi.generate(courseId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule", courseId] });
      toast.success("Cronograma criado!", "Seu plano de estudos personalizado está pronto.");
      onGenerated();
    },
    onError: () => toast.error("Erro ao gerar cronograma"),
  });

  const toggleDay = (d: number) => {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  };

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">Cronograma Inteligente</h1>
        <p className="text-muted-foreground text-sm">
          Responda 3 perguntas rápidas para criar seu plano personalizado
        </p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2 justify-center">
        {[1, 2, 3].map(s => (
          <div key={s} className={cn(
            "h-2 rounded-full transition-all",
            s <= step ? "bg-primary w-8" : "bg-muted w-4"
          )} />
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📅 Quais dias você pode estudar?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-7 gap-2">
              {DAYS.map((day, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={cn(
                    "p-2 rounded-lg text-xs font-medium transition-all border-2",
                    days.includes(i)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {days.length} dias selecionados
            </p>
            <Button className="w-full" onClick={() => setStep(2)} disabled={days.length === 0}>
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">⏱️ Quantas horas por dia?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6, 8, 10].map(h => (
                <button
                  key={h}
                  onClick={() => setHours(h)}
                  className={cn(
                    "p-3 rounded-xl text-sm font-bold transition-all border-2",
                    hours === h
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:border-primary/50"
                  )}
                >
                  {h}h
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Total: {days.length * hours}h/semana
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Voltar</Button>
              <Button className="flex-1" onClick={() => setStep(3)}>
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🌅 Qual seu horário preferido?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "🌅 Manhã", time: "07:00" },
                { label: "☀️ Tarde", time: "13:00" },
                { label: "🌆 Fim de tarde", time: "17:00" },
                { label: "🌙 Noite", time: "19:00" },
                { label: "🌛 Madrugada", time: "22:00" },
                { label: "🕐 Personalizado", time: startTime },
              ].map(({ label, time }) => (
                <button
                  key={time}
                  onClick={() => setStartTime(time)}
                  className={cn(
                    "p-3 rounded-xl text-sm font-medium transition-all border-2 text-left",
                    startTime === time
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:border-primary/50"
                  )}
                >
                  {label}
                  <span className="block text-xs opacity-70">{time}</span>
                </button>
              ))}
            </div>

            {/* Resumo */}
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <p className="text-xs font-medium text-foreground">📋 Resumo do seu plano:</p>
              <p className="text-xs text-muted-foreground">
                • {days.map(d => DAYS[d]).join(", ")}
              </p>
              <p className="text-xs text-muted-foreground">
                • {hours}h por dia · {days.length * hours}h por semana
              </p>
              <p className="text-xs text-muted-foreground">
                • Início às {startTime}
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Voltar</Button>
              <Button
                className="flex-1"
                loading={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                <Sparkles className="h-4 w-4" />
                Gerar Cronograma
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Visualização do cronograma ────────────────────────────────────────────────
function ScheduleView({ courseId, onDelete }: { courseId: string; onDelete?: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["schedule", courseId],
    queryFn: () => scheduleApi.get(courseId, 14),
    enabled: !!courseId,
  });

  const checkinMutation = useMutation({
    mutationFn: ({ itemId, completed }: { itemId: string; completed: boolean }) =>
      scheduleApi.checkin(itemId, { completed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedule", courseId] }),
    onError: () => toast.error("Erro ao marcar item"),
  });

  const reorganizeMutation = useMutation({
    mutationFn: () => apiClient.post("/schedule/reorganize", { course_id: courseId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule", courseId] });
      toast.success("Cronograma reorganizado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => scheduleApi.delete(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule", courseId] });
      queryClient.invalidateQueries({ queryKey: ["schedule-check", courseId] });
      toast.success("Cronograma removido!", "Você pode criar um novo agora.");
      onDelete?.();
    },
    onError: () => toast.error("Erro ao deletar cronograma"),
  });

  if (isLoading) return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
      ))}
    </div>
  );

  const days = data?.days || [];
  const stats = data?.stats;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Cronograma</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Seu plano de estudos adaptativo
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => reorganizeMutation.mutate()}
            loading={reorganizeMutation.isPending}
          >
            <RefreshCw className="h-4 w-4" />
            Reorganizar
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => {
              if (confirm("Deletar o cronograma atual? Você poderá criar um novo.")) {
                deleteMutation.mutate();
              }
            }}
            loading={deleteMutation.isPending}
            className="text-destructive hover:text-destructive"
          >
            Deletar
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{stats.completion_rate ?? 0}%</p>
              <p className="text-xs text-muted-foreground">Conclusão</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.pending_today ?? 0}</p>
              <p className="text-xs text-muted-foreground">Pendentes hoje</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-success">{stats.completed_items ?? 0}</p>
              <p className="text-xs text-muted-foreground">Concluídos</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dias */}
      {days.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum item no cronograma.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {days.map((day: any) => (
            <div key={day.date}>
              <div className="flex items-center gap-3 mb-3">
                <h3 className={cn(
                  "font-display font-semibold text-sm",
                  day.is_today ? "text-primary" : "text-muted-foreground"
                )}>
                  {day.is_today ? "📌 Hoje" : new Date(day.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" })}
                </h3>
                {day.completion_rate > 0 && (
                  <Badge variant={day.completion_rate === 100 ? "success" : "outline"} className="text-xs">
                    {day.completion_rate}%
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                {day.items?.map((item: any) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all",
                      item.status === "completed"
                        ? "bg-success/5 border-success/20 opacity-60"
                        : "bg-card border-border hover:border-primary/30"
                    )}
                  >
                    <button
                      onClick={() => checkinMutation.mutate({
                        itemId: item.id,
                        completed: item.status !== "completed"
                      })}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                        item.status === "completed"
                          ? "border-success bg-success"
                          : "border-border hover:border-primary"
                      )}
                    >
                      {item.status === "completed" && (
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      )}
                    </button>

                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                      item.item_type === "lesson" ? "bg-primary/10" : "bg-warning/10"
                    )}>
                      {item.item_type === "lesson"
                        ? <BookOpen className="h-4 w-4 text-primary" />
                        : <HelpCircle className="h-4 w-4 text-warning" />
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        item.status === "completed" && "line-through text-muted-foreground"
                      )}>
                        {item.lesson?.title || item.subject?.name || (item.item_type === "questions" ? "Praticar questões" : "Estudar")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.item_type === "lesson" ? "📖 Aula" : "❓ Questões"} · {item.estimated_minutes}min
                        {item.priority_reason && ` · ${item.priority_reason}`}
                      </p>
                    </div>

                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function SchedulePage() {
  const [courseId, setCourseId] = useState<string | null>(null);
  const [hasSchedule, setHasSchedule] = useState<boolean | null>(null);
  const queryClient = useQueryClient();

  // Carrega cursos matriculados
  const { data: coursesData } = useQuery({
    queryKey: ["courses"],
    queryFn: () => apiClient.get("/courses/").then(r => r.data),
  });

  const courses = coursesData?.courses || [];

  // Seleciona primeiro curso automaticamente
  useEffect(() => {
    if (courses.length > 0 && !courseId) {
      setCourseId(courses[0].id);
    }
  }, [courses, courseId]);

  // Verifica se já tem cronograma
  useQuery({
    queryKey: ["schedule-check", courseId],
    queryFn: async () => {
      if (!courseId) return null;
      const data = await scheduleApi.get(courseId, 7);
      setHasSchedule(!!data?.schedule);
      return data;
    },
    enabled: !!courseId,
  });

  if (!courseId || hasSchedule === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!hasSchedule) {
    return (
      <ScheduleWizard
        courseId={courseId}
        onGenerated={() => {
          setHasSchedule(true);
          queryClient.invalidateQueries({ queryKey: ["schedule", courseId] });
        }}
      />
    );
  }

  return <ScheduleView
    courseId={courseId}
    onDelete={() => setHasSchedule(false)}
  />;
}
