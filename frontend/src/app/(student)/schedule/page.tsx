"use client";
// frontend/src/app/(student)/schedule/page.tsx

import { useState, useEffect } from "react";
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
  Play, ArrowRight, List, LayoutGrid, CalendarDays,
  ChevronLeft,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos e constantes
// ─────────────────────────────────────────────────────────────────────────────

type ViewMode = "list" | "blocks" | "calendar";
const VIEW_STORAGE_KEY = "concurso-schedule-view";
const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const TYPE_CONFIG: Record<string, { color: string; dot: string; label: string; icon: any }> = {
  lesson: { color: "bg-primary/10 text-primary border-primary/20", dot: "bg-primary", label: "Aula", icon: BookOpen },
  questions: { color: "bg-warning/10 text-warning border-warning/20", dot: "bg-warning", label: "Questões", icon: HelpCircle },
  review: { color: "bg-secondary/10 text-secondary border-secondary/20", dot: "bg-secondary", label: "Revisão", icon: RotateCcw },
  simulado: { color: "bg-destructive/10 text-destructive border-destructive/20", dot: "bg-destructive", label: "Simulado", icon: ClipboardList },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildItemUrl(item: any, courseId: string): string {
  switch (item.item_type) {
    case "lesson":
      return item.lesson?.id ? `/courses/${courseId}/lessons/${item.lesson.id}` : `/courses/${courseId}`;
    case "review":
      if (item.question_filters) return buildQuestionsUrl(item.question_filters, item.subject?.id);
      if (item.lesson?.id) return `/courses/${courseId}/lessons/${item.lesson.id}`;
      if (item.subject?.name) return `/questions?${new URLSearchParams({ discipline: item.subject.name, previously_wrong: "true" })}`;
      return "/questions";
    case "questions":
      if (item.question_filters) return buildQuestionsUrl(item.question_filters, item.subject?.id);
      if (item.subject?.name) return `/questions?${new URLSearchParams({ discipline: item.subject.name, not_answered: "true" })}`;
      return "/questions";
    case "simulado": return "/simulados";
    default: return "/questions";
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

function resolveTitle(item: any): string {
  return (
    item.template_item_title
    || item.lesson?.title
    || (item.item_type === "questions" ? `Questões — ${item.subject?.name || "Geral"}` : null)
    || (item.item_type === "review" ? `Revisão — ${item.subject?.name || "Geral"}` : null)
    || (item.item_type === "simulado" ? "Simulado de verificação" : null)
    || "Estudar"
  );
}

function parseDayMeta(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  const sub = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  if (diff === 0) return { label: "Hoje", sub, isToday: true };
  if (diff === 1) return { label: "Amanhã", sub, isToday: false };
  return { label: DAYS_PT[d.getDay()], sub, isToday: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle de visualização
// ─────────────────────────────────────────────────────────────────────────────

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const opts: { key: ViewMode; Icon: any; label: string }[] = [
    { key: "list", Icon: List, label: "Lista" },
    { key: "blocks", Icon: LayoutGrid, label: "Blocos" },
    { key: "calendar", Icon: CalendarDays, label: "Calendário" },
  ];
  return (
    <div className="flex items-center gap-0.5 p-1 rounded-xl bg-muted border border-border">
      {opts.map(({ key, Icon, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          title={label}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
            view === key
              ? "bg-background text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Item individual (compartilhado entre views)
// ─────────────────────────────────────────────────────────────────────────────

function ScheduleItemRow({ item, courseId, onCheckin, onUncheckin, loading }: {
  item: any; courseId: string;
  onCheckin: (id: string, completed: boolean) => void;
  onUncheckin: (id: string) => void;
  loading: boolean;
}) {
  const router = useRouter();
  const isDone = item.status === "done";
  const isSkipped = item.status === "skipped";
  const isDoneOrSkipped = isDone || isSkipped;
  const cfg = TYPE_CONFIG[item.item_type] || TYPE_CONFIG.lesson;
  const Icon = cfg.icon;
  const title = resolveTitle(item);

  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-xl border transition-all",
      isDone && "bg-success/5 border-success/20 opacity-70",
      isSkipped && "bg-muted/30 border-border opacity-50",
      !isDoneOrSkipped && "bg-background border-border hover:border-primary/20",
    )}>
      <button
        onClick={() => {
          if (isDone) onUncheckin(item.id);
          else if (!isSkipped) onCheckin(item.id, true);
        }}
        disabled={loading || isSkipped}
        title={isDone ? "Desfazer check-in" : "Marcar como concluído"}
        className={cn(
          "h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
          isDone && "bg-success border-success hover:bg-destructive hover:border-destructive group",
          isSkipped && "bg-muted border-muted cursor-not-allowed",
          !isDoneOrSkipped && "border-border hover:border-success hover:bg-success/10",
        )}
      >
        {isDone && (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-white group-hover:hidden" />
            <RotateCcw className="h-3.5 w-3.5 text-white hidden group-hover:block" />
          </>
        )}
      </button>

      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", cfg.color)}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", isDoneOrSkipped && "line-through text-muted-foreground")}>{title}</p>
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
        {item.template_item_notes && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1.5">
            📌 {item.template_item_notes}
          </p>
        )}
        {item.priority_reason && !item.template_item_notes && (
          <p className="text-xs text-muted-foreground mt-1 italic">💡 {item.priority_reason}</p>
        )}
        {!isDoneOrSkipped && (
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => router.push(buildItemUrl(item, courseId))}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Play className="h-3 w-3" />{itemActionLabel(item)}<ArrowRight className="h-3 w-3" />
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

// ─────────────────────────────────────────────────────────────────────────────
// View: Lista (padrão)
// ─────────────────────────────────────────────────────────────────────────────

function ScheduleListView({ days, courseId, onCheckin, onUncheckin, loading }: {
  days: any[]; courseId: string;
  onUncheckin: (id: string) => void;
  onCheckin: (id: string, completed: boolean) => void; loading: boolean;
}) {
  if (days.length === 0) return null;
  return (
    <div className="space-y-4">
      {days.map(({ date: dateStr, items }: any) => {
        const { label, sub, isToday } = parseDayMeta(dateStr);
        const pendingCount = items.filter((i: any) => i.status === "pending").length;
        const doneCount = items.filter((i: any) => i.status === "done").length;
        return (
          <div key={dateStr}>
            <div className="flex items-center gap-3 mb-2">
              <div className={cn(
                "h-10 w-10 rounded-xl flex flex-col items-center justify-center shrink-0 text-xs font-bold",
                isToday ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
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
                <ScheduleItemRow key={item.id} item={item} courseId={courseId}
                  onCheckin={onCheckin} onUncheckin={onUncheckin} loading={loading} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// View: Blocos
// ─────────────────────────────────────────────────────────────────────────────

function ScheduleBlocksView({ days, courseId, onCheckin, onUncheckin, loading }: {
  days: any[]; courseId: string;
  onUncheckin: (id: string) => void;
  onCheckin: (id: string, completed: boolean) => void; loading: boolean;
}) {
  const router = useRouter();
  if (days.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {days.map(({ date: dateStr, items }: any) => {
        const { label, sub, isToday } = parseDayMeta(dateStr);
        const doneCount = items.filter((i: any) => i.status === "done").length;
        const pendingCount = items.filter((i: any) => i.status === "pending").length;

        return (
          <Card key={dateStr} className={cn(
            "overflow-hidden transition-all",
            isToday && "border-primary/50 shadow-sm",
          )}>
            {/* Cabeçalho do card */}
            <div className={cn(
              "px-4 py-3 flex items-center justify-between",
              isToday ? "bg-primary text-primary-foreground" : "bg-muted/40",
            )}>
              <div>
                <p className="text-sm font-bold">{label}</p>
                <p className={cn("text-xs", isToday ? "opacity-80" : "text-muted-foreground")}>{sub}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {pendingCount > 0 && (
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    isToday ? "bg-white/20 text-white" : "bg-background text-muted-foreground border",
                  )}>
                    {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
                  </span>
                )}
                <span className={cn("text-xs", isToday ? "opacity-70" : "text-muted-foreground")}>
                  {doneCount}/{items.length}
                </span>
              </div>
            </div>

            {/* Itens como chips compactos */}
            <CardContent className="p-3 space-y-2">
              {items.map((item: any) => {
                const cfg = TYPE_CONFIG[item.item_type] || TYPE_CONFIG.lesson;
                const Icon = cfg.icon;
                const isDone = item.status === "done";
                const isSkipped = item.status === "skipped";
                const isDoneOrSkipped = isDone || isSkipped;

                return (
                  <div key={item.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border text-xs transition-all",
                      isDone && "opacity-50 line-through border-success/20 bg-success/5",
                      isSkipped && "opacity-40 border-border bg-muted/20",
                      !isDoneOrSkipped && "border-border bg-background hover:border-primary/30",
                    )}
                  >
                    {/* Check button */}
                    <button
                      onClick={() => {
                        if (isDone) onUncheckin(item.id);
                        else if (!isSkipped) onCheckin(item.id, true);
                      }}
                      disabled={loading || isSkipped}
                      title={isDone ? "Desfazer check-in" : "Marcar como concluído"}
                      className={cn(
                        "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all group",
                        isDone && "bg-success border-success hover:bg-destructive hover:border-destructive",
                        isSkipped && "bg-muted border-muted cursor-not-allowed",
                        !isDoneOrSkipped && "border-border hover:border-success",
                      )}
                    >
                      {isDone && (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-white group-hover:hidden" />
                          <RotateCcw className="h-3 w-3 text-white hidden group-hover:block" />
                        </>
                      )}
                    </button>

                    {/* Ícone de tipo */}
                    <div className={cn("h-6 w-6 rounded flex items-center justify-center shrink-0 border", cfg.color)}>
                      <Icon className="h-3 w-3" />
                    </div>

                    {/* Título + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-foreground">{resolveTitle(item)}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />{item.estimated_minutes}min
                        {item.subject?.name && (
                          <><span>·</span><span className="truncate">{item.subject.name}</span></>
                        )}
                      </div>
                    </div>

                    {/* Ação rápida */}
                    {!isDoneOrSkipped && (
                      <button
                        onClick={() => router.push(buildItemUrl(item, courseId))}
                        className="shrink-0 text-primary hover:text-primary/80"
                        title={itemActionLabel(item)}
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// View: Calendário
// ─────────────────────────────────────────────────────────────────────────────

function ScheduleCalendarView({ days, courseId, onCheckin, onUncheckin, loading }: {
  days: any[]; courseId: string;
  onUncheckin: (id: string) => void;
  onCheckin: (id: string, completed: boolean) => void; loading: boolean;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(
    today.toISOString().split("T")[0]
  );

  // Mapa: dateStr → items
  const itemsByDate: Record<string, any[]> = {};
  for (const { date, items } of days) {
    itemsByDate[date] = items;
  }

  // Constrói a grade do mês (semanas × 7 dias)
  const firstDay = new Date(viewYear, viewMonth, 1);
  // Brasil: semana começa no domingo (0)
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Grade de células: null = dia vazio (padding), number = dia do mês
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Preenche até múltiplo de 7
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const todayStr = today.toISOString().split("T")[0];
  const selectedItems = selectedDate ? (itemsByDate[selectedDate] || []) : [];
  const { label: selectedLabel, sub: selectedSub } = selectedDate
    ? parseDayMeta(selectedDate)
    : { label: "", sub: "" };

  return (
    <div className="space-y-4">
      {/* Cabeçalho do mês */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth}
          className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-foreground">
          {MONTHS_PT[viewMonth]} {viewYear}
        </p>
        <button onClick={nextMonth}
          className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Grade do calendário */}
      <div className="border border-border rounded-xl overflow-hidden">
        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 bg-muted/40 border-b border-border">
          {DAYS_PT.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Células dos dias */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) return (
              <div key={`empty-${idx}`} className="min-h-[60px] bg-muted/10 border-r border-b border-border last:border-r-0" />
            );

            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayItems = itemsByDate[dateStr] || [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const hasPending = dayItems.some(i => i.status === "pending");
            const hasDone = dayItems.some(i => i.status === "done");

            // Tipos únicos para mostrar dots
            const typeDots = [...new Set(dayItems.map(i => i.item_type))].slice(0, 3);

            return (
              <button key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={cn(
                  "min-h-[60px] p-1.5 border-r border-b border-border last:border-r-0",
                  "flex flex-col items-start gap-1 text-left transition-colors",
                  isSelected && "bg-primary/5",
                  !isSelected && "hover:bg-muted/40",
                  idx % 7 === 6 && "border-r-0",
                )}
              >
                {/* Número do dia */}
                <span className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold",
                  isToday && "bg-primary text-primary-foreground",
                  isSelected && !isToday && "bg-muted text-foreground",
                  !isToday && !isSelected && "text-foreground",
                )}>
                  {day}
                </span>

                {/* Dots por tipo */}
                {typeDots.length > 0 && (
                  <div className="flex items-center gap-0.5 flex-wrap">
                    {typeDots.map(type => (
                      <div key={type}
                        className={cn("h-1.5 w-1.5 rounded-full", TYPE_CONFIG[type]?.dot || "bg-muted")} />
                    ))}
                    {dayItems.length > 3 && (
                      <span className="text-[9px] text-muted-foreground">+{dayItems.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Indicador de progresso */}
                {dayItems.length > 0 && (
                  <span className={cn(
                    "text-[9px] font-medium",
                    hasPending ? "text-primary" : hasDone ? "text-success" : "text-muted-foreground",
                  )}>
                    {dayItems.filter(i => i.status === "done").length}/{dayItems.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={cn("h-2 w-2 rounded-full", cfg.dot)} />
            {cfg.label}
          </div>
        ))}
      </div>

      {/* Painel do dia selecionado */}
      {selectedDate && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-border">
            <div className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
              selectedDate === todayStr ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}>
              {selectedLabel.slice(0, 3)}
            </div>
            <div>
              <p className="text-sm font-semibold">{selectedLabel}</p>
              <p className="text-xs text-muted-foreground">{selectedSub}</p>
            </div>
            {selectedItems.length === 0 && (
              <p className="ml-auto text-xs text-muted-foreground italic">Sem atividades agendadas</p>
            )}
          </div>

          {selectedItems.length > 0 && (
            <div className="space-y-2">
              {selectedItems.map((item: any) => (
                <ScheduleItemRow key={item.id} item={item} courseId={courseId}
                  onCheckin={onCheckin} onUncheckin={onUncheckin} loading={loading} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal: ScheduleView
// ─────────────────────────────────────────────────────────────────────────────

function ScheduleView({ courseId, onDelete }: { courseId: string; onDelete?: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  // Persiste a view escolhida
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode) || "list";
  });

  const handleViewChange = (v: ViewMode) => {
    setView(v);
    localStorage.setItem(VIEW_STORAGE_KEY, v);
  };

  // Calendário precisa de mais dias
  const daysToFetch = view === "calendar" ? 42 : 14;

  const { data, isLoading } = useQuery({
    queryKey: ["schedule", courseId, daysToFetch],
    queryFn: () => scheduleApi.get(courseId, daysToFetch),
    enabled: !!courseId,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const checkinMutation = useMutation({
    mutationFn: ({ itemId, completed }: { itemId: string; completed: boolean }) =>
      scheduleApi.checkin(itemId, { completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule", courseId] });
    },
    onError: () => toast.error("Erro ao marcar item"),
  });

  const uncheckinMutation = useMutation({
    mutationFn: (itemId: string) =>
      apiClient.delete(`/schedule/checkin/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule", courseId] });
      toast.success("Check-in desfeito.");
    },
    onError: () => toast.error("Erro ao desfazer check-in"),
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
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
      ))}
    </div>
  );

  const days = data?.days || [];
  const stats = data?.stats;
  const isProducerTemplate = data?.schedule?.source_type === "producer_template";
  const daysUntilExam = stats?.target_date
    ? Math.max(0, Math.round(
      (new Date(stats.target_date + "T12:00:00").getTime() - Date.now()) / 86_400_000
    ))
    : null;

  const checkinProps = {
    courseId,
    onCheckin: (id: string, completed: boolean) =>
      checkinMutation.mutate({ itemId: id, completed }),
    onUncheckin: (id: string) => uncheckinMutation.mutate(id),
    loading: checkinMutation.isPending || uncheckinMutation.isPending,
  };

  return (
    <div data-onboarding="schedule" className="space-y-5 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Cronograma</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isProducerTemplate
              ? "Cronograma adaptado à sua disponibilidade"
              : "Adaptativo · atualiza com seu desempenho"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewToggle view={view} onChange={handleViewChange} />
          {!isProducerTemplate && (
            <Button variant="outline" size="sm"
              onClick={() => reorganizeMutation.mutate()}
              disabled={reorganizeMutation.isPending}>
              <RefreshCw className="h-4 w-4" />
              Reorganizar
            </Button>
          )}
          <Button variant="ghost" size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => { if (confirm("Deletar o cronograma?")) deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}>
            Deletar
          </Button>
        </div>
      </div>

      {/* Aviso de template */}
      {isProducerTemplate && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <Calendar className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground">
            As <strong className="text-foreground">datas</strong> foram ajustadas para os seus dias de estudo.
          </p>
        </div>
      )}

      {/* Cards de stats */}
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
              <p className={cn("text-2xl font-bold",
                stats.abandonment_risk > 0.6 ? "text-destructive" :
                  stats.abandonment_risk > 0.3 ? "text-warning" : "text-success")}>
                {stats.abandonment_risk > 0.6 ? "Alto" : stats.abandonment_risk > 0.3 ? "Médio" : "Baixo"}
              </p>
              <p className="text-xs text-muted-foreground">Risco abandono</p>
            </CardContent></Card>
          )}
        </div>
      )}

      {/* Alerta abandono */}
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

      {/* Nota da IA */}
      {!isProducerTemplate && stats?.ai_notes && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
          <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">{stats.ai_notes}</p>
        </div>
      )}

      {/* Conteúdo vazio */}
      {days.length === 0 && (
        <Card><CardContent className="py-12 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-foreground">Nenhum item nos próximos {daysToFetch} dias</p>
          <p className="text-sm text-muted-foreground mt-1">
            {isProducerTemplate
              ? "Você concluiu os itens programados. Parabéns!"
              : "Clique em Reorganizar para gerar novos itens."}
          </p>
        </CardContent></Card>
      )}

      {/* Visualizações */}
      {days.length > 0 && view === "list" && <ScheduleListView days={days} {...checkinProps} />}
      {days.length > 0 && view === "blocks" && <ScheduleBlocksView days={days} {...checkinProps} />}
      {days.length > 0 && view === "calendar" && <ScheduleCalendarView days={days} {...checkinProps} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wizard de criação
// ─────────────────────────────────────────────────────────────────────────────

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
    <div data-onboarding="schedule" className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">Cronograma Inteligente</h1>
        <p className="text-muted-foreground text-sm">Configure seu plano adaptativo, ele aprende com seu desempenho</p>
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
                className={cn("h-12 rounded-xl text-xs font-semibold transition-all border-2",
                  days.includes(d) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50")}>
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
            {[2, 3, 4, 5, 6, 7, 8].map(h => (
              <button key={h} onClick={() => setHours(h)}
                className={cn("py-2 rounded-xl text-sm font-medium border-2 transition-all",
                  hours === h ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50")}>
                {h}h
              </button>
            ))}
            <div className={cn("col-span-1 flex items-center rounded-xl border-2 px-2 transition-all",
              ![2, 3, 4, 5, 6, 7, 8].includes(hours) ? "border-primary" : "border-border")}>
              <input type="number" min={2} max={24} placeholder="+"
                value={![2, 3, 4, 5, 6, 7, 8].includes(hours) ? hours : ""}
                onChange={e => { const v = Number(e.target.value); if (v >= 2) setHours(v); }}
                className="w-full bg-transparent text-sm text-center focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Voltar</Button>
            <Button className="flex-1" disabled={hours < 2} onClick={() => setStep(3)}>
              Continuar <ChevronRight className="h-4 w-4" />
            </Button>
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
                className={cn("py-4 rounded-xl text-sm font-medium border-2 transition-all",
                  startTime === time ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50")}>
                {label}
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
            <p className="text-sm text-muted-foreground">O cronograma se comprime automaticamente conforme o prazo se aproxima</p>
          </div>
          <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
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

// ─────────────────────────────────────────────────────────────────────────────
// Tela inicial (escolha entre template e IA)
// ─────────────────────────────────────────────────────────────────────────────

function ScheduleStartView({ courseId, onGenerated }: { courseId: string; onGenerated: () => void }) {
  const [forceAI, setForceAI] = useState(false);
  const queryClient = useQueryClient();

  const { data: templateData, isLoading: templateLoading } = useQuery({
    queryKey: ["course-template", courseId],
    queryFn: () => studentScheduleTemplateApi.getCourseTemplate(courseId),
    enabled: !forceAI,
  });

  if (templateLoading && !forceAI) return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="h-32 rounded-xl bg-muted animate-pulse" />
      <div className="h-14 rounded-xl bg-muted animate-pulse" />
    </div>
  );

  const hasPublishedTemplate = !forceAI && !!templateData?.template;

  if (!hasPublishedTemplate || forceAI) {
    return <ScheduleWizard courseId={courseId} onGenerated={onGenerated} />;
  }

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

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [courseId, setCourseId] = useState<string | null>(null);
  const [hasSchedule, setHasSchedule] = useState<boolean | null>(null);
  const queryClient = useQueryClient();

  const { data: coursesData } = useQuery({
    queryKey: ["courses"],
    queryFn: () => apiClient.get("/courses/").then(r => r.data),
  });

  const courses = coursesData?.courses || [];

  useEffect(() => {
    if (courses.length > 0 && !courseId) {
      setCourseId(courses[0].id);
    }
  }, [courses, courseId]);

  const resetScheduleCheck = (newCourseId: string) => {
    setCourseId(newCourseId);
    setHasSchedule(null);
  };

  const { isLoading: checkLoading } = useQuery({
    queryKey: ["schedule-check", courseId],
    queryFn: async () => {
      if (!courseId) return null;
      const data = await scheduleApi.get(courseId, 7);
      setHasSchedule(!!data?.schedule);
      return data;
    },
    enabled: !!courseId && hasSchedule === null,
    refetchOnWindowFocus: false,
  });

  if (!courseId || checkLoading || hasSchedule === null) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {courses.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {courses.map((c: any) => (
            <button key={c.id} onClick={() => resetScheduleCheck(c.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border-2",
                courseId === c.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:border-primary/50",
              )}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {!hasSchedule && (
        <ScheduleStartView courseId={courseId} onGenerated={() => setHasSchedule(true)} />
      )}

      {hasSchedule && (
        <ScheduleView courseId={courseId} onDelete={() => setHasSchedule(false)} />
      )}
    </div>
  );
}