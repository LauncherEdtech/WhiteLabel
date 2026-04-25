"use client";
// frontend/src/app/(student)/schedule/page.tsx — v11
//
// v11 — PAUSA CONFIGURÁVEL PELO ALUNO:
//   - Novo passo no wizard (passo 3) para escolher pausa entre atividades
//   - Pausa enviada em scheduleApi.updateAvailability({ break_minutes })
//   - Divisor visual "Pausa X min" exibido entre itens do mesmo dia
//     nas views Lista e Blocos (somente se break_minutes > 0)
//   - Resumo do passo 5 mostra a pausa selecionada
//
// v9 FIX (preservado): calendário dinâmico com daysToFetch por mês
// v8.2 (preservado): badge "Aula longa"

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
  ChevronLeft, Hourglass, Coffee,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos e constantes
// ─────────────────────────────────────────────────────────────────────────────

type ViewMode = "list" | "blocks" | "calendar";
const VIEW_STORAGE_KEY = "concurso-schedule-view";
const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAYS_BACKEND_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

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
// Divisor de pausa entre itens
// ─────────────────────────────────────────────────────────────────────────────

function BreakDivider({ minutes }: { minutes: number }) {
  if (minutes <= 0) return null;
  return (
    <div className="flex items-center gap-2 px-1 py-0.5">
      <div className="h-px flex-1 bg-border" />
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Coffee className="h-3 w-3" />
        {minutes} min de pausa
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
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
// Item individual
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
  const isLongLesson = item.is_long_lesson === true;

  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-xl border transition-all",
      isDone && "bg-success/5 border-success/20 opacity-70",
      isSkipped && "bg-muted/30 border-border opacity-50",
      !isDoneOrSkipped && !isLongLesson && "bg-background border-border hover:border-primary/20",
      !isDoneOrSkipped && isLongLesson && "bg-warning/5 border-warning/30",
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
          {isLongLesson && (
            <span className="text-[10px] font-medium text-warning bg-warning/15 border border-warning/30 rounded px-1.5 py-0 h-4 flex items-center gap-0.5">
              <Hourglass className="h-2.5 w-2.5" />
              Aula longa
            </span>
          )}
        </div>

        {isLongLesson && !isDoneOrSkipped && (
          <p className="text-xs text-warning bg-warning/10 border border-warning/30 rounded px-2 py-1 mt-1.5 flex items-start gap-1.5">
            <Hourglass className="h-3 w-3 mt-0.5 shrink-0" />
            <span>Esta aula é mais longa que sua carga diária. Reserve um tempo extra hoje ou divida em sessões.</span>
          </p>
        )}

        {item.template_item_notes && (
          <p className="text-xs text-warning bg-warning/10 border border-warning/30 rounded px-2 py-1 mt-1.5">
            📌 {item.template_item_notes}
          </p>
        )}
        {item.priority_reason && !item.template_item_notes && !isLongLesson && (
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
// View: Lista (com divisores de pausa entre itens)
// ─────────────────────────────────────────────────────────────────────────────

function ScheduleListView({ days, courseId, onCheckin, onUncheckin, loading, breakMinutes }: {
  days: any[]; courseId: string;
  onUncheckin: (id: string) => void;
  onCheckin: (id: string, completed: boolean) => void;
  loading: boolean;
  breakMinutes: number;
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
            <div className="space-y-0 ml-2 pl-10 border-l-2 border-border">
              {items.map((item: any, idx: number) => (
                <div key={item.id}>
                  <div className="py-1">
                    <ScheduleItemRow
                      item={item} courseId={courseId}
                      onCheckin={onCheckin} onUncheckin={onUncheckin} loading={loading}
                    />
                  </div>
                  {/* Pausa entre itens (exceto após o último) */}
                  {idx < items.length - 1 && (
                    <BreakDivider minutes={breakMinutes} />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// View: Blocos (com divisores de pausa entre itens)
// ─────────────────────────────────────────────────────────────────────────────

function ScheduleBlocksView({ days, courseId, onCheckin, onUncheckin, loading, breakMinutes }: {
  days: any[]; courseId: string;
  onUncheckin: (id: string) => void;
  onCheckin: (id: string, completed: boolean) => void;
  loading: boolean;
  breakMinutes: number;
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
          <Card key={dateStr} className={cn("overflow-hidden transition-all", isToday && "border-primary/50 shadow-sm")}>
            <div className={cn("px-4 py-3 flex items-center justify-between", isToday ? "bg-primary text-primary-foreground" : "bg-muted/40")}>
              <div>
                <p className="text-sm font-bold">{label}</p>
                <p className={cn("text-xs", isToday ? "opacity-80" : "text-muted-foreground")}>{sub}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {pendingCount > 0 && (
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                    isToday ? "bg-white/20 text-white" : "bg-background text-muted-foreground border")}>
                    {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
                  </span>
                )}
                <span className={cn("text-xs", isToday ? "opacity-70" : "text-muted-foreground")}>
                  {doneCount}/{items.length}
                </span>
              </div>
            </div>
            <CardContent className="p-3 space-y-0">
              {items.map((item: any, idx: number) => {
                const cfg = TYPE_CONFIG[item.item_type] || TYPE_CONFIG.lesson;
                const Icon = cfg.icon;
                const isDone = item.status === "done";
                const isSkipped = item.status === "skipped";
                const isDoneOrSkipped = isDone || isSkipped;
                const isLongLesson = item.is_long_lesson === true;
                return (
                  <div key={item.id}>
                    <div className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border text-xs transition-all",
                      isDone && "opacity-50 line-through border-success/20 bg-success/5",
                      isSkipped && "opacity-40 border-border bg-muted/20",
                      !isDoneOrSkipped && !isLongLesson && "border-border bg-background hover:border-primary/30",
                      !isDoneOrSkipped && isLongLesson && "border-warning/30 bg-warning/5",
                    )}>
                      <button
                        onClick={() => {
                          if (isDone) onUncheckin(item.id);
                          else if (!isSkipped) onCheckin(item.id, true);
                        }}
                        disabled={loading || isSkipped}
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
                      <div className={cn("h-6 w-6 rounded flex items-center justify-center shrink-0 border", cfg.color)}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-foreground flex items-center gap-1">
                          {resolveTitle(item)}
                          {isLongLesson && <Hourglass className="h-3 w-3 text-warning shrink-0" />}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />{item.estimated_minutes}min
                          {item.subject?.name && <><span>·</span><span className="truncate">{item.subject.name}</span></>}
                        </div>
                      </div>
                      {!isDoneOrSkipped && (
                        <button onClick={() => router.push(buildItemUrl(item, courseId))} className="shrink-0 text-primary hover:text-primary/80">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {/* Pausa entre itens */}
                    {idx < items.length - 1 && (
                      <BreakDivider minutes={breakMinutes} />
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
// View: Calendário (sem alterações relevantes — breakMinutes não exibido aqui)
// ─────────────────────────────────────────────────────────────────────────────

function ScheduleCalendarView({
  days, courseId, onCheckin, onUncheckin, loading,
  viewYear, viewMonth, onMonthChange, breakMinutes,
}: {
  days: any[]; courseId: string;
  onUncheckin: (id: string) => void;
  onCheckin: (id: string, completed: boolean) => void; loading: boolean;
  viewYear: number; viewMonth: number;
  onMonthChange: (year: number, month: number) => void;
  breakMinutes: number;
}) {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<string | null>(today.toISOString().split("T")[0]);

  const itemsByDate: Record<string, any[]> = {};
  for (const { date, items } of days) {
    itemsByDate[date] = items;
  }

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) onMonthChange(viewYear - 1, 11);
    else onMonthChange(viewYear, viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) onMonthChange(viewYear + 1, 0);
    else onMonthChange(viewYear, viewMonth + 1);
  };

  const todayStr = today.toISOString().split("T")[0];
  const selectedItems = selectedDate ? (itemsByDate[selectedDate] || []) : [];
  const { label: selectedLabel, sub: selectedSub } = selectedDate
    ? parseDayMeta(selectedDate) : { label: "", sub: "" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-foreground">{MONTHS_PT[viewMonth]} {viewYear}</p>
        <button onClick={nextMonth} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/40 border-b border-border">
          {DAYS_PT.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="min-h-[60px] bg-muted/10 border-r border-b border-border last:border-r-0" />;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayItems = itemsByDate[dateStr] || [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const hasPending = dayItems.some((i: any) => i.status === "pending");
            const hasDone = dayItems.some((i: any) => i.status === "done");
            const hasLongLesson = dayItems.some((i: any) => i.is_long_lesson === true);
            const typeDots = [...new Set(dayItems.map((i: any) => i.item_type))].slice(0, 3);
            return (
              <button key={dateStr} onClick={() => setSelectedDate(dateStr)}
                className={cn(
                  "min-h-[60px] p-1.5 border-r border-b border-border last:border-r-0",
                  "flex flex-col items-start gap-1 text-left transition-colors",
                  isSelected && "bg-primary/5",
                  !isSelected && hasLongLesson && "bg-warning/5",
                  !isSelected && !hasLongLesson && "hover:bg-muted/40",
                  idx % 7 === 6 && "border-r-0",
                )}>
                <span className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold",
                  isToday && "bg-primary text-primary-foreground",
                  isSelected && !isToday && "bg-muted text-foreground",
                  !isToday && !isSelected && "text-foreground",
                )}>{day}</span>
                {typeDots.length > 0 && (
                  <div className="flex items-center gap-0.5 flex-wrap">
                    {typeDots.map((type: string) => (
                      <div key={type} className={cn("h-1.5 w-1.5 rounded-full", TYPE_CONFIG[type]?.dot || "bg-muted")} />
                    ))}
                    {hasLongLesson && <Hourglass className="h-2.5 w-2.5 text-warning ml-0.5" />}
                    {dayItems.length > 3 && <span className="text-[9px] text-muted-foreground">+{dayItems.length - 3}</span>}
                  </div>
                )}
                {dayItems.length > 0 && (
                  <span className={cn("text-[9px] font-medium",
                    hasPending ? "text-primary" : hasDone ? "text-success" : "text-muted-foreground")}>
                    {dayItems.filter((i: any) => i.status === "done").length}/{dayItems.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={cn("h-2 w-2 rounded-full", cfg.dot)} />{cfg.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Hourglass className="h-2.5 w-2.5 text-warning" />Aula longa
        </div>
        {breakMinutes > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Coffee className="h-2.5 w-2.5" />{breakMinutes} min pausa
          </div>
        )}
      </div>

      {selectedDate && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-border">
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
              selectedDate === todayStr ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
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
            <div className="space-y-0">
              {selectedItems.map((item: any, idx: number) => (
                <div key={item.id}>
                  <div className="py-1">
                    <ScheduleItemRow item={item} courseId={courseId}
                      onCheckin={onCheckin} onUncheckin={onUncheckin} loading={loading} />
                  </div>
                  {idx < selectedItems.length - 1 && <BreakDivider minutes={breakMinutes} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Banner de cobertura insuficiente
// ─────────────────────────────────────────────────────────────────────────────

interface CoverageGap {
  will_cover_lessons: number; total_lessons: number; coverage_percent: number;
  suggested_hours_per_day: number; current_hours_per_day: number; days_until_exam: number;
}

function CoverageWarningBanner({ coverageGap, courseId, currentDays, onAdjusted }: {
  coverageGap: CoverageGap; courseId: string; currentDays: number[]; onAdjusted: () => void;
}) {
  const toast = useToast();
  const [dismissed, setDismissed] = useState(false);

  const adjustHoursMutation = useMutation({
    mutationFn: async (newHours: number) => {
      await scheduleApi.updateAvailability({ days: currentDays, hours_per_day: newHours });
      await apiClient.post("/schedule/reorganize", { course_id: courseId });
    },
    onSuccess: (_, newHours) => {
      toast.success("Carga horária ajustada!", `Cronograma reorganizado para ${newHours}h/dia.`);
      onAdjusted();
    },
    onError: () => toast.error("Erro ao ajustar carga horária"),
  });

  if (dismissed) return null;
  const { will_cover_lessons, total_lessons, coverage_percent, suggested_hours_per_day, current_hours_per_day } = coverageGap;
  const lessonsNotCovered = total_lessons - will_cover_lessons;

  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-warning/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Sua carga horária não cobre todo o conteúdo até a prova</p>
            <p className="text-xs text-muted-foreground mt-1">
              Com <strong>{current_hours_per_day}h/dia</strong>, você fará{" "}
              <strong className="text-warning">{will_cover_lessons} de {total_lessons} aulas</strong>{" "}
              ({coverage_percent}%). Faltarão <strong>{lessonsNotCovered} aulas</strong>.
            </p>
          </div>
          <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground transition-colors text-xs shrink-0">✕</button>
        </div>
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <Button size="sm" onClick={() => adjustHoursMutation.mutate(suggested_hours_per_day)}
            disabled={adjustHoursMutation.isPending} className="bg-warning text-warning-foreground hover:bg-warning/90">
            <Clock className="h-3.5 w-3.5" />
            {adjustHoursMutation.isPending ? "Ajustando..." : `Aumentar para ${suggested_hours_per_day}h/dia`}
          </Button>
          {current_hours_per_day * 2 < suggested_hours_per_day && (
            <Button size="sm" variant="outline" onClick={() => adjustHoursMutation.mutate(current_hours_per_day * 2)} disabled={adjustHoursMutation.isPending}>
              <Clock className="h-3.5 w-3.5" />Tentar {current_hours_per_day * 2}h/dia
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)} disabled={adjustHoursMutation.isPending} className="text-muted-foreground">
            Manter {current_hours_per_day}h/dia
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ScheduleView principal
// ─────────────────────────────────────────────────────────────────────────────

function ScheduleView({ courseId, onDelete }: { courseId: string; onDelete?: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode) || "list";
  });

  const handleViewChange = (v: ViewMode) => {
    setView(v);
    localStorage.setItem(VIEW_STORAGE_KEY, v);
  };

  const today = new Date();
  const [calendarMonth, setCalendarMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const daysToFetch = (() => {
    if (view !== "calendar") return 14;
    const endOfViewedMonthPlus1 = new Date(calendarMonth.year, calendarMonth.month + 2, 0);
    const diffDays = Math.ceil((endOfViewedMonthPlus1.getTime() - today.getTime()) / 86_400_000);
    return Math.min(800, Math.max(42, diffDays));
  })();

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["schedule", courseId] }); },
    onError: () => toast.error("Erro ao marcar item"),
  });

  const uncheckinMutation = useMutation({
    mutationFn: (itemId: string) => apiClient.delete(`/schedule/checkin/${itemId}`),
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
    <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}</div>
  );

  const days = data?.days || [];
  const stats = data?.stats;
  const isProducerTemplate = data?.schedule?.source_type === "producer_template";

  // v11: lê break_minutes do schedule para exibir nos divisores
  const breakMinutes: number = data?.schedule?.break_minutes ?? stats?.break_minutes ?? 0;

  const daysUntilExam = stats?.target_date
    ? Math.max(0, Math.round((new Date(stats.target_date + "T12:00:00").getTime() - Date.now()) / 86_400_000))
    : null;

  const checkinProps = {
    courseId,
    onCheckin: (id: string, completed: boolean) => checkinMutation.mutate({ itemId: id, completed }),
    onUncheckin: (id: string) => uncheckinMutation.mutate(id),
    loading: checkinMutation.isPending || uncheckinMutation.isPending,
  };

  return (
    <div data-onboarding="schedule" className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Cronograma</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isProducerTemplate ? "Cronograma adaptado à sua disponibilidade" : "Adaptativo · atualiza com seu desempenho"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewToggle view={view} onChange={handleViewChange} />
          {!isProducerTemplate && (
            <Button variant="outline" size="sm" onClick={() => reorganizeMutation.mutate()} disabled={reorganizeMutation.isPending}>
              <RefreshCw className="h-4 w-4" />Reorganizar
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
            onClick={() => { if (confirm("Deletar o cronograma?")) deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}>
            Deletar
          </Button>
        </div>
      </div>

      {isProducerTemplate && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <Calendar className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground">
            As <strong className="text-foreground">datas</strong> foram ajustadas para os seus dias de estudo.
          </p>
        </div>
      )}

      {/* Indicador de pausa ativo */}
      {breakMinutes > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border">
          <Coffee className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Pausa de <strong className="text-foreground">{breakMinutes} min</strong> entre atividades incluída no cálculo do dia.
          </p>
        </div>
      )}

      {data?.coverage_gap && !isProducerTemplate && (
        <CoverageWarningBanner
          coverageGap={data.coverage_gap}
          courseId={courseId}
          currentDays={data.schedule?.days || [0, 1, 2, 3, 4]}
          onAdjusted={() => { queryClient.invalidateQueries({ queryKey: ["schedule", courseId] }); }}
        />
      )}

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
                <p className={cn("text-2xl font-bold", daysUntilExam <= 14 ? "text-destructive" : "text-foreground")}>{daysUntilExam}</p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Target className="h-3 w-3" />Dias p/ prova</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      {!isProducerTemplate && stats?.abandonment_risk > 0.6 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Você está atrasado!</p>
            <p className="text-xs text-muted-foreground mt-0.5">Clique em Reorganizar para ajustar o plano ao seu ritmo atual.</p>
          </div>
        </div>
      )}

      {!isProducerTemplate && stats?.ai_notes && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
          <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">{stats.ai_notes}</p>
        </div>
      )}

      {days.length === 0 && (
        <Card><CardContent className="py-12 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-foreground">Nenhum item nos próximos {daysToFetch} dias</p>
          <p className="text-sm text-muted-foreground mt-1">
            {isProducerTemplate ? "Você concluiu os itens programados. Parabéns!" : "Clique em Reorganizar para gerar novos itens."}
          </p>
        </CardContent></Card>
      )}

      {days.length > 0 && view === "list" && (
        <ScheduleListView days={days} breakMinutes={breakMinutes} {...checkinProps} />
      )}
      {days.length > 0 && view === "blocks" && (
        <ScheduleBlocksView days={days} breakMinutes={breakMinutes} {...checkinProps} />
      )}
      {days.length > 0 && view === "calendar" && (
        <ScheduleCalendarView
          days={days}
          viewYear={calendarMonth.year}
          viewMonth={calendarMonth.month}
          onMonthChange={(year, month) => setCalendarMonth({ year, month })}
          breakMinutes={breakMinutes}
          {...checkinProps}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wizard de criação — v11: 5 passos com pausa entre atividades
// ─────────────────────────────────────────────────────────────────────────────

function ScheduleWizard({ courseId, onGenerated }: { courseId: string; onGenerated: () => void }) {
  const [step, setStep] = useState(1);
  const [days, setDays] = useState([0, 1, 2, 3, 4]);
  const [hours, setHours] = useState(2);
  const [breakMinutes, setBreakMinutes] = useState(0);  // v11
  const [startTime, setStartTime] = useState("19:00");
  const [targetDate, setTargetDate] = useState("");
  const toast = useToast();
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1. Salva disponibilidade (síncrono, rápido)
      await scheduleApi.updateAvailability({
        days,
        hours_per_day: hours,
        preferred_start_time: startTime,
        break_minutes: breakMinutes,  // v11
      });
      // 2. Gera cronograma async: enfileira Celery + polling até "ready" (até 120s)
      await scheduleApi.generateAndWait(courseId, targetDate || undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule", courseId] });
      queryClient.invalidateQueries({ queryKey: ["schedule-check", courseId] });
      toast.success("Cronograma criado!", "Seu plano adaptativo está pronto.");
      onGenerated();
    },
    onError: (err: Error) => toast.error("Erro ao gerar cronograma", err.message),
  });

  const toggleDay = (d: number) =>
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());

  const BREAK_OPTIONS = [
    { value: 0, label: "Sem pausa", sub: "Atividades em sequência" },
    { value: 5, label: "5 min", sub: "Pausa rápida" },
    { value: 10, label: "10 min", sub: "Pausa moderada" },
    { value: 15, label: "15 min", sub: "Pausa longa" },
  ];

  return (
    <div data-onboarding="schedule" className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">Cronograma Inteligente</h1>
        <p className="text-muted-foreground text-sm">Configure seu plano adaptativo, ele aprende com seu desempenho</p>
      </div>

      {/* Progress dots — 5 passos */}
      <div className="flex items-center gap-2 justify-center">
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} className={cn("h-2 rounded-full transition-all", s <= step ? "bg-primary w-8" : "bg-muted w-2")} />
        ))}
      </div>

      {/* Passo 1: Dias */}
      {step === 1 && (
        <Card><CardContent className="p-6 space-y-4">
          <div>
            <p className="font-semibold text-foreground">Quais dias você estuda?</p>
            <p className="text-sm text-muted-foreground mt-0.5">Selecione pelo menos 1 dia</p>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {[
              { value: 0, label: "Seg" }, { value: 1, label: "Ter" }, { value: 2, label: "Qua" },
              { value: 3, label: "Qui" }, { value: 4, label: "Sex" }, { value: 5, label: "Sáb" }, { value: 6, label: "Dom" },
            ].map(({ value, label }) => (
              <button key={value} onClick={() => toggleDay(value)}
                className={cn("h-12 rounded-xl text-xs font-semibold transition-all border-2",
                  days.includes(value) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50")}>
                {label}
              </button>
            ))}
          </div>
          <Button className="w-full" onClick={() => setStep(2)} disabled={days.length === 0}>
            Continuar <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent></Card>
      )}

      {/* Passo 2: Horas */}
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

      {/* Passo 3: Pausa entre atividades (v11 — NOVO) */}
      {step === 3 && (
        <Card><CardContent className="p-6 space-y-4">
          <div>
            <p className="font-semibold text-foreground">Pausa entre atividades?</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              O tempo de pausa é descontado do seu dia — com {hours}h e {breakMinutes} min de pausa,
              você terá{" "}
              <strong className="text-primary">
                {Math.floor(hours * 60 - breakMinutes * 3)} min de estudo efetivo
              </strong>{" "}
              (estimativa com 3 atividades/dia).
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {BREAK_OPTIONS.map(({ value, label, sub }) => (
              <button key={value} onClick={() => setBreakMinutes(value)}
                className={cn(
                  "py-3 px-4 rounded-xl text-left border-2 transition-all",
                  breakMinutes === value
                    ? "bg-primary/10 border-primary"
                    : "bg-background border-border hover:border-primary/50",
                )}>
                <p className={cn("text-sm font-semibold", breakMinutes === value ? "text-primary" : "text-foreground")}>
                  {label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
              </button>
            ))}
          </div>
          {breakMinutes > 0 && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 flex items-start gap-2">
              <Coffee className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              A pausa aparece como um divisor visual entre cada atividade no seu cronograma.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Voltar</Button>
            <Button className="flex-1" onClick={() => setStep(4)}>
              Continuar <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent></Card>
      )}

      {/* Passo 4: Horário preferido */}
      {step === 4 && (
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
            <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>Voltar</Button>
            <Button className="flex-1" onClick={() => setStep(5)}>Continuar <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardContent></Card>
      )}

      {/* Passo 5: Data da prova + resumo */}
      {step === 5 && (
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
            <p className="text-xs text-muted-foreground">• {days.map(d => DAYS_BACKEND_PT[d]).join(", ")}</p>
            <p className="text-xs text-muted-foreground">• {hours}h/dia · {days.length * hours}h/semana</p>
            {/* v11: mostra pausa no resumo */}
            <p className="text-xs text-muted-foreground">
              • {breakMinutes === 0 ? "Sem pausa entre atividades" : `${breakMinutes} min de pausa entre atividades`}
            </p>
            <p className="text-xs text-muted-foreground">• Início às {startTime}</p>
            {targetDate && (
              <p className="text-xs text-primary font-medium">
                • Prova: {new Date(targetDate + "T12:00:00").toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(4)}>Voltar</Button>
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
// Tela inicial e página principal (sem alterações)
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
    // ✅ FIX: data-onboarding aqui também, para o tour encontrar o alvo
    // mesmo durante o loading
    <div data-onboarding="schedule" className="max-w-lg mx-auto space-y-4">
      <div className="h-32 rounded-xl bg-muted animate-pulse" />
      <div className="h-14 rounded-xl bg-muted animate-pulse" />
    </div>
  );

  const hasPublishedTemplate = !forceAI && !!templateData?.template;

  if (!hasPublishedTemplate || forceAI) {
    // ScheduleWizard já tem data-onboarding="schedule" internamente — ok
    return <ScheduleWizard courseId={courseId} onGenerated={onGenerated} />;
  }

  return (
    // ✅ FIX: wrapper com data-onboarding para o tour encontrar o alvo
    // quando o aluno ainda está na tela de escolha (template vs IA)
    <div data-onboarding="schedule" className="max-w-lg mx-auto">
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
    if (courses.length > 0 && !courseId) setCourseId(courses[0].id);
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
      <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
    );
  }

  return (
    <div className="space-y-4">
      {courses.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {courses.map((c: any) => (
            <button key={c.id} onClick={() => resetScheduleCheck(c.id)}
              className={cn("px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border-2",
                courseId === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50")}>
              {c.name}
            </button>
          ))}
        </div>
      )}
      {!hasSchedule && <ScheduleStartView courseId={courseId} onGenerated={() => setHasSchedule(true)} />}
      {hasSchedule && <ScheduleView courseId={courseId} onDelete={() => setHasSchedule(false)} />}
    </div>
  );
}