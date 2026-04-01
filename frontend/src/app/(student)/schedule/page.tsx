"use client";
// frontend/src/app/(student)/schedule/page.tsx

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { scheduleApi } from "@/lib/api/schedule";
import { apiClient } from "@/lib/api/client";
import { studentScheduleTemplateApi } from "@/lib/api/producer-schedule";
import { ProducerTemplateChoice, buildQuestionsUrl } from "@/components/schedule/ProducerTemplateChoice";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toaster";
import {
  Calendar, CheckCircle2, Clock, BookOpen,
  HelpCircle, RefreshCw, Sparkles, ClipboardList,
  AlertTriangle, Target, ChevronRight, RotateCcw,
  Play, ArrowRight,
} from "lucide-react";

const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// ── Redirecionamento inteligente por tipo de item ─────────────────────────────
// Suporta question_filters do cronograma do produtor
function buildItemUrl(item: any, courseId: string): string {
  switch (item.item_type) {
    case "lesson":
      if (item.lesson?.id) return `/courses/${courseId}/lessons/${item.lesson.id}`;
      return `/courses/${courseId}`;

    case "review":
      // Revisão com filtros pré-setados pelo produtor
      if (item.question_filters) {
        return buildQuestionsUrl(item.question_filters, item.subject?.id);
      }
      if (item.lesson?.id) return `/courses/${courseId}/lessons/${item.lesson.id}`;
      if (item.subject?.id) return `/questions?subject_id=${item.subject.id}&previously_wrong=true`;
      return `/questions`;

    case "questions":
      // Questões com filtros pré-setados pelo produtor
      if (item.question_filters) {
        return buildQuestionsUrl(item.question_filters, item.subject?.id);
      }
      if (item.subject?.id) return `/questions?subject_id=${item.subject.id}&not_answered=true`;
      return `/questions`;

    case "simulado":
      return `/simulados`;

    default:
      return `/questions`;
  }
}

function itemActionLabel(item: any): string {
  switch (item.item_type) {
    case "lesson": return "Assistir aula";
    case "review": return item.lesson?.id ? "Revisar aula" : "Praticar revisão";
    case "questions": return "Responder questões";
    case "simulado": return "Fazer simulado";
    default: return "Iniciar";
  }
}

// ── Wizard de criação de cronograma IA ───────────────────────────────────────

function ScheduleWizard({ courseId, onGenerated }: { courseId: string; onGenerated: () => void }) {
  const [step, setStep] = useState(1);
  const [days, setDays] = useState([0, 1, 2, 3, 4]);
  const [hours, setHours] = useState(2);
  const [startTime, setStartTime] = useState("19:00");
  const [targetDate, setTargetDate] = useState("");
  const toast = useToast();
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      await scheduleApi.updateAvailability({ days, hours_per_day: hours, preferred_start_time: startTime });
      await scheduleApi.generate(courseId, targetDate || undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule", courseId] });
      queryClient.invalidateQueries({ queryKey: ["schedule-check", courseId] });
      toast.success("Cronograma criado!", "Seu plano adaptativo está pronto.");
      onGenerated();
    },
    onError: () => toast.error("Erro ao gerar cronograma"),
  });

  const toggleDay = (d: number) =>
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">Cronograma Inteligente</h1>
        <p className="text-muted-foreground text-sm">
          Configure seu plano adaptativo — ele aprende com seu desempenho
        </p>
      </div>

      <div className="flex items-center gap-2 justify-center">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={cn("h-2 rounded-full transition-all", s <= step ? "bg-primary w-8" : "bg-muted w-2")} />
        ))}
      </div>

      {step === 1 && (
        <Card><CardContent className="p-6 space-y-4">
          <div>
            <p className="font-semibold text-foreground">Quais dias você estuda?</p>
            <p className="text-sm text-muted-foreground mt-0.5">Selecione pelo menos 1 dia</p>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS_PT.map((label, d) => (
              <button key={d} onClick={() => toggleDay(d)}
                className={cn(
                  "h-12 rounded-xl text-xs font-semibold transition-all border-2",
                  days.includes(d) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"
                )}>
                {label}
              </button>
            ))}
          </div>
          <Button className="w-full" onClick={() => setStep(2)} disabled={days.length === 0}>
            Continuar <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent></Card>
      )}

      {step === 2 && (
        <Card><CardContent className="p-6 space-y-4">
          <div>
            <p className="font-semibold text-foreground">Quantas horas por dia?</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Atual: <strong className="text-primary">{hours}h/dia · {days.length * hours}h/semana</strong>
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[0.5, 1, 1.5, 2, 3, 4, 5, 6].map(h => (
              <button key={h} onClick={() => setHours(h)}
                className={cn(
                  "py-2 rounded-xl text-sm font-medium border-2 transition-all",
                  hours === h ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"
                )}>
                {h}h
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Voltar</Button>
            <Button className="flex-1" onClick={() => setStep(3)}>Continuar <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardContent></Card>
      )}

      {step === 3 && (
        <Card><CardContent className="p-6 space-y-4">
          <div>
            <p className="font-semibold text-foreground">Qual seu horário preferido?</p>
            <p className="text-sm text-muted-foreground">Usado para notificações e sugestões</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Manhã", time: "08:00" },
              { label: "Tarde", time: "14:00" },
              { label: "Noite", time: "19:00" },
              { label: "Madrugada", time: "22:00" },
            ].map(({ label, time }) => (
              <button key={time} onClick={() => setStartTime(time)}
                className={cn(
                  "py-3 rounded-xl text-sm font-medium border-2 transition-all",
                  startTime === time ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"
                )}>
                {label}
                <span className="block text-xs opacity-70">{time}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Voltar</Button>
            <Button className="flex-1" onClick={() => setStep(4)}>Continuar <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardContent></Card>
      )}

      {step === 4 && (
        <Card><CardContent className="p-6 space-y-4">
          <div>
            <p className="font-semibold text-foreground">Data da sua prova? (opcional)</p>
            <p className="text-sm text-muted-foreground">
              O cronograma se comprime automaticamente conforme o prazo se aproxima
            </p>
          </div>
          <input
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="p-3 rounded-lg bg-muted/40 space-y-1">
            <p className="text-xs font-medium text-foreground">📋 Resumo do seu plano:</p>
            <p className="text-xs text-muted-foreground">• {days.map(d => DAYS_PT[d]).join(", ")}</p>
            <p className="text-xs text-muted-foreground">• {hours}h/dia · {days.length * hours}h/semana</p>
            <p className="text-xs text-muted-foreground">• Início às {startTime}</p>
            {targetDate && (
              <p className="text-xs text-primary font-medium">
                • Prova: {new Date(targetDate + "T12:00:00").toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>Voltar</Button>
            <Button className="flex-1" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              <Sparkles className="h-4 w-4" />
              {saveMutation.isPending ? "Gerando..." : "Gerar Cronograma"}
            </Button>
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}

// ── Tela inicial: escolha entre template do professor ou cronograma IA ────────
// Exibida quando o aluno ainda não tem cronograma para o curso.
// Fluxo:
//   1. Consulta se há template publicado para o curso
//   2. Se sim → exibe ProducerTemplateChoice (adotar ou criar próprio)
//   3. Se não (ou se aluno escolheu "criar próprio") → exibe ScheduleWizard

function ScheduleStartView({ courseId, onGenerated }: { courseId: string; onGenerated: () => void }) {
  const [forceAI, setForceAI] = useState(false);
  const queryClient = useQueryClient();

  const { data: templateData, isLoading: templateLoading } = useQuery({
    queryKey: ["course-template", courseId],
    queryFn: () => studentScheduleTemplateApi.getCourseTemplate(courseId),
    enabled: !forceAI,
  });

  // Enquanto carrega, exibe skeleton
  if (templateLoading && !forceAI) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="h-32 rounded-xl bg-muted animate-pulse" />
        <div className="h-14 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  const hasPublishedTemplate = !forceAI && !!templateData?.template;

  // Sem template publicado → vai direto para o wizard de criação IA
  if (!hasPublishedTemplate || forceAI) {
    return <ScheduleWizard courseId={courseId} onGenerated={onGenerated} />;
  }

  // Tem template → exibe a tela de escolha
  return (
    <div className="max-w-lg mx-auto">
      <ProducerTemplateChoice
        courseId={courseId}
        onAdopted={() => {
          queryClient.invalidateQueries({ queryKey: ["schedule", courseId] });
          queryClient.invalidateQueries({ queryKey: ["schedule-check", courseId] });
          onGenerated();
        }}
        onChooseAI={() => setForceAI(true)}
      />
    </div>
  );
}

// ── Item do cronograma com redirecionamento inteligente ───────────────────────

function ScheduleItemRow({ item, courseId, onCheckin, loading }: {
  item: any;
  courseId: string;
  onCheckin: (id: string, completed: boolean) => void;
  loading: boolean;
}) {
  const router = useRouter();
  const isDone = item.status === "done";
  const isSkipped = item.status === "skipped";
  const isDoneOrSkipped = isDone || isSkipped;

  const typeConfig: Record<string, { icon: any; color: string; label: string }> = {
    lesson: { icon: BookOpen, color: "bg-primary/10 text-primary", label: "Aula" },
    questions: { icon: HelpCircle, color: "bg-warning/10 text-warning", label: "Questões" },
    review: { icon: RotateCcw, color: "bg-secondary/10 text-secondary", label: "Revisão" },
    simulado: { icon: ClipboardList, color: "bg-destructive/10 text-destructive", label: "Simulado" },
  };
  const cfg = typeConfig[item.item_type] || typeConfig.lesson;
  const Icon = cfg.icon;

  // Título: prioridade para título do template do professor, depois título da aula, depois padrão
  const title =
    item.template_item_title
    || item.lesson?.title
    || (item.item_type === "questions" ? `Questões — ${item.subject?.name || "Geral"}` : null)
    || (item.item_type === "review" ? `Revisão — ${item.subject?.name || "Geral"}` : null)
    || (item.item_type === "simulado" ? "Simulado de verificação" : null)
    || "Estudar";

  const destination = buildItemUrl(item, courseId);
  const actionLabel = itemActionLabel(item);

  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-xl border transition-all",
      isDone && "bg-success/5 border-success/20 opacity-70",
      isSkipped && "bg-muted/30 border-border opacity-50",
      !isDoneOrSkipped && "bg-background border-border hover:border-primary/20",
    )}>
      {/* Check button */}
      <button
        onClick={() => !isDoneOrSkipped && onCheckin(item.id, true)}
        disabled={loading || isDoneOrSkipped}
        className={cn(
          "h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
          isDone && "bg-success border-success",
          isSkipped && "bg-muted border-muted",
          !isDoneOrSkipped && "border-border hover:border-success hover:bg-success/10",
        )}
      >
        {isDone && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
      </button>

      {/* Type icon */}
      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", cfg.color)}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", isDoneOrSkipped && "line-through text-muted-foreground")}>
          {title}
        </p>

        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <Badge variant="outline" className="text-[10px] py-0 h-4">{cfg.label}</Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            <Clock className="h-3 w-3" />{item.estimated_minutes}min
          </span>
          {item.subject && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.subject.color }} />
              {item.subject.name}
            </span>
          )}
        </div>

        {/* Nota do professor (template do produtor) */}
        {item.template_item_notes && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1.5">
            📌 {item.template_item_notes}
          </p>
        )}

        {/* Dica da IA (cronograma adaptativo) */}
        {item.priority_reason && !item.template_item_notes && (
          <p className="text-xs text-muted-foreground mt-1 italic">
            💡 {item.priority_reason}
          </p>
        )}

        {/* Filtros aplicados (questões/revisão do template) */}
        {(item.item_type === "questions" || item.item_type === "review") && item.question_filters && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {item.question_filters.difficulty && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                {({ easy: "Fácil", medium: "Médio", hard: "Difícil", expert: "Expert" } as any)[item.question_filters.difficulty] || item.question_filters.difficulty}
              </span>
            )}
            {item.question_filters.quantity && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                {item.question_filters.quantity} questões
              </span>
            )}
            {item.question_filters.tags?.slice(0, 2).map((tag: string) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Botões de ação */}
        {!isDoneOrSkipped && (
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => router.push(destination)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Play className="h-3 w-3" />
              {actionLabel}
              <ArrowRight className="h-3 w-3" />
            </button>

            <span className="text-muted-foreground text-xs">·</span>

            <button
              onClick={() => onCheckin(item.id, false)}
              disabled={loading}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Pular
            </button>
          </div>
        )}
      </div>
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
      toast.success("Cronograma removido.");
      onDelete?.();
    },
  });

  if (isLoading) return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
    </div>
  );

  const days = data?.days || [];
  const stats = data?.stats;
  const isProducerTemplate = data?.schedule?.source_type === "producer_template";

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    const weekday = DAYS_PT[d.getDay()];
    const formatted = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    if (diff === 0) return { label: "Hoje", sub: formatted, isToday: true };
    if (diff === 1) return { label: "Amanhã", sub: formatted, isToday: false };
    return { label: weekday, sub: formatted, isToday: false };
  };

  const daysUntilExam = stats?.target_date
    ? Math.max(0, Math.round((new Date(stats.target_date + "T12:00:00").getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Cronograma</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isProducerTemplate
              ? "Cronograma do professor · adaptado à sua disponibilidade"
              : "Adaptativo · atualiza com seu desempenho"}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Reorganizar só disponível para cronograma IA */}
          {!isProducerTemplate && (
            <Button variant="outline" size="sm" onClick={() => reorganizeMutation.mutate()} disabled={reorganizeMutation.isPending}>
              <RefreshCw className="h-4 w-4" />
              Reorganizar
            </Button>
          )}
          <Button
            variant="ghost" size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => { if (confirm("Deletar o cronograma?")) deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}
          >
            Deletar
          </Button>
        </div>
      </div>

      {/* Badge: cronograma do professor */}
      {isProducerTemplate && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <Calendar className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground">
            Você está seguindo o <strong className="text-foreground">cronograma do professor</strong>.
            As datas foram ajustadas para os seus dias de estudo.
          </p>
        </div>
      )}

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{stats.completion_rate}%</p>
            <p className="text-xs text-muted-foreground">Conclusão</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.pending_today}</p>
            <p className="text-xs text-muted-foreground">Pendentes hoje</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">{stats.completed_items}</p>
            <p className="text-xs text-muted-foreground">Concluídos</p>
          </CardContent></Card>
          {daysUntilExam !== null ? (
            <Card className={cn(daysUntilExam <= 14 && "border-destructive/40")}>
              <CardContent className="p-4 text-center">
                <p className={cn("text-2xl font-bold", daysUntilExam <= 14 ? "text-destructive" : "text-foreground")}>
                  {daysUntilExam}
                </p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Target className="h-3 w-3" />Dias p/ prova
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="p-4 text-center">
              <p className={cn(
                "text-2xl font-bold",
                stats.abandonment_risk > 0.6 ? "text-destructive" :
                  stats.abandonment_risk > 0.3 ? "text-warning" : "text-success"
              )}>
                {stats.abandonment_risk > 0.6 ? "Alto" : stats.abandonment_risk > 0.3 ? "Médio" : "Baixo"}
              </p>
              <p className="text-xs text-muted-foreground">Risco abandono</p>
            </CardContent></Card>
          )}
        </div>
      )}

      {/* Alerta de risco alto (somente cronograma IA) */}
      {!isProducerTemplate && stats?.abandonment_risk > 0.6 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Você está atrasado!</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Clique em Reorganizar para ajustar o plano ao seu ritmo atual.
            </p>
          </div>
        </div>
      )}

      {/* AI notes (somente cronograma IA) */}
      {!isProducerTemplate && stats?.ai_notes && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
          <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">{stats.ai_notes}</p>
        </div>
      )}

      {/* Lista de dias */}
      {days.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-foreground">Nenhum item nos próximos 14 dias</p>
          <p className="text-sm text-muted-foreground mt-1">
            {isProducerTemplate
              ? "Você concluiu os itens programados. Parabéns!"
              : "Clique em Reorganizar para gerar novos itens."}
          </p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {days.map(({ date: dateStr, items }: any) => {
            const { label, sub, isToday } = formatDate(dateStr);
            const pendingCount = items.filter((i: any) => i.status === "pending").length;
            const doneCount = items.filter((i: any) => i.status === "done").length;

            return (
              <div key={dateStr}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex flex-col items-center justify-center shrink-0 text-xs font-bold",
                    isToday ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <span>{label.slice(0, 3)}</span>
                    <span className="text-[10px] font-normal opacity-80">{sub.split(" ")[0]}</span>
                  </div>
                  <div>
                    <p className={cn("text-sm font-semibold", isToday && "text-primary")}>{label}</p>
                    <p className="text-xs text-muted-foreground">{sub} · {doneCount}/{items.length} concluídos</p>
                  </div>
                  {isToday && pendingCount > 0 && (
                    <Badge variant="default" className="ml-auto text-xs">
                      {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2 ml-2 pl-10 border-l-2 border-border">
                  {items.map((item: any) => (
                    <ScheduleItemRow
                      key={item.id}
                      item={item}
                      courseId={courseId}
                      onCheckin={(id, completed) => checkinMutation.mutate({ itemId: id, completed })}
                      loading={checkinMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            );
          })}
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

  const { data: coursesData } = useQuery({
    queryKey: ["courses"],
    queryFn: () => apiClient.get("/courses/").then(r => r.data),
  });

  const courses = coursesData?.courses || [];

  // Seleciona primeiro curso automaticamente
  if (courses.length > 0 && !courseId) setCourseId(courses[0].id);

  const { isLoading: checkLoading } = useQuery({
    queryKey: ["schedule-check", courseId],
    queryFn: async () => {
      if (!courseId) return null;
      const data = await scheduleApi.get(courseId, 7);
      setHasSchedule(!!data?.schedule);
      return data;
    },
    enabled: !!courseId && hasSchedule === null,
  });

  if (!courseId || checkLoading || hasSchedule === null) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Seletor de curso (se houver mais de 1) */}
      {courses.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {courses.map((c: any) => (
            <button key={c.id}
              onClick={() => { setCourseId(c.id); setHasSchedule(null); }}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border-2",
                courseId === c.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:border-primary/50"
              )}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Sem cronograma → tela de escolha (professor ou IA) */}
      {!hasSchedule && (
        <ScheduleStartView
          courseId={courseId}
          onGenerated={() => setHasSchedule(true)}
        />
      )}

      {/* Com cronograma → visualização */}
      {hasSchedule && (
        <ScheduleView
          courseId={courseId}
          onDelete={() => setHasSchedule(false)}
        />
      )}
    </div>
  );
}