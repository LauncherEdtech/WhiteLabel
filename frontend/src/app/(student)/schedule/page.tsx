// frontend/src/app/(student)/schedule/page.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { coursesApi } from "@/lib/api/courses";
import { useSchedule, useGenerateSchedule, useCheckinItem } from "@/lib/hooks/useSchedule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import {
    Calendar, CheckCircle2, XCircle, BookOpen,
    HelpCircle, RotateCcw, Zap, Clock,
    ChevronDown, ChevronUp, Play,
} from "lucide-react";
import type { ScheduleDay, ScheduleItem } from "@/types/api";
import { useToast } from "@/components/ui/toaster";

export default function SchedulePage() {
    const toast = useToast();
    const [selectedCourseId, setSelectedCourseId] = useState<string>("");
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

    const { data: courses } = useQuery({
        queryKey: ["courses"],
        queryFn: () => coursesApi.list(),
    });

    // Seleciona o primeiro curso automaticamente
    const courseId = selectedCourseId || courses?.[0]?.id || "";

    const {
        data: scheduleData,
        isLoading,
        refetch,
    } = useSchedule(courseId, 14);

    const generateSchedule = useGenerateSchedule();
    const checkinItem = useCheckinItem();

    const handleGenerate = async () => {
        if (!courseId) return;
        try {
            await generateSchedule.mutateAsync({ courseId });
            toast.success("Cronograma gerado!", "Seu plano de estudos está pronto.");
            refetch();
        } catch {
            toast.error("Erro ao gerar cronograma");
        }
    };

    const handleCheckin = async (
        itemId: string,
        completed: boolean,
        difficulty?: "easy" | "ok" | "hard"
    ) => {
        try {
            await checkinItem.mutateAsync({ itemId, completed, perceived_difficulty: difficulty });
            toast.success(completed ? "Concluído! ✓" : "Marcado como não feito");
        } catch {
            toast.error("Erro ao registrar check-in");
        }
    };

    const toggleDay = (date: string) => {
        setExpandedDays((prev) => {
            const next = new Set(prev);
            next.has(date) ? next.delete(date) : next.add(date);
            return next;
        });
    };

    const days: ScheduleDay[] = scheduleData?.days || [];
    const schedule = scheduleData?.schedule;

    return (
        <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">
                        Cronograma
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Seu plano de estudos inteligente
                    </p>
                </div>
                {courseId && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerate}
                        loading={generateSchedule.isPending}
                    >
                        <RotateCcw className="h-4 w-4" />
                        {schedule ? "Reorganizar" : "Gerar"}
                    </Button>
                )}
            </div>

            {/* Seletor de curso */}
            {courses && courses.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {courses.map((course) => (
                        <button
                            key={course.id}
                            onClick={() => setSelectedCourseId(course.id)}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border transition-all",
                                courseId === course.id
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border text-muted-foreground hover:border-primary"
                            )}
                        >
                            {course.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Stats do cronograma */}
            {schedule && (
                <div className="grid grid-cols-3 gap-3">
                    <Card>
                        <CardContent className="p-4 text-center">
                            <p className="font-display text-2xl font-bold text-foreground">
                                {schedule.stats.done_items}
                            </p>
                            <p className="text-xs text-muted-foreground">Concluídos</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 text-center">
                            <p className="font-display text-2xl font-bold text-warning">
                                {schedule.stats.overdue_items}
                            </p>
                            <p className="text-xs text-muted-foreground">Atrasados</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 text-center">
                            <p className="font-display text-2xl font-bold text-primary">
                                {schedule.stats.completion_rate}%
                            </p>
                            <p className="text-xs text-muted-foreground">Progresso</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Estado vazio */}
            {!isLoading && !schedule && courseId && (
                <Card>
                    <CardContent className="py-16 flex flex-col items-center gap-4">
                        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <Zap className="h-8 w-8 text-primary" />
                        </div>
                        <div className="text-center">
                            <p className="font-semibold text-foreground">
                                Nenhum cronograma ainda
                            </p>
                            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                                Gere seu cronograma inteligente baseado na sua disponibilidade e pontos fracos.
                            </p>
                        </div>
                        <Button onClick={handleGenerate} loading={generateSchedule.isPending}>
                            <Zap className="h-4 w-4" />
                            Gerar cronograma
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Lista de dias */}
            {isLoading ? (
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="space-y-3">
                    {days.map((day) => (
                        <DayCard
                            key={day.date}
                            day={day}
                            isExpanded={expandedDays.has(day.date) || day.is_today}
                            onToggle={() => toggleDay(day.date)}
                            onCheckin={handleCheckin}
                            isCheckinLoading={checkinItem.isPending}
                        />
                    ))}
                </div>
            )}

            {/* Nota da IA */}
            {schedule?.ai_notes && (
                <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="p-4">
                        <p className="text-xs font-semibold text-primary mb-1">
                            💡 Nota do seu cronograma
                        </p>
                        <p className="text-xs text-foreground leading-relaxed">
                            {schedule.ai_notes}
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function DayCard({
    day,
    isExpanded,
    onToggle,
    onCheckin,
    isCheckinLoading,
}: {
    day: ScheduleDay;
    isExpanded: boolean;
    onToggle: () => void;
    onCheckin: (id: string, completed: boolean, diff?: "easy" | "ok" | "hard") => void;
    isCheckinLoading: boolean;
}) {
    const dateObj = new Date(day.date + "T12:00:00");
    const dayName = dateObj.toLocaleDateString("pt-BR", { weekday: "long" });
    const dateStr = dateObj.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
    });

    return (
        <Card
            className={cn(
                "transition-all duration-200",
                day.is_today && "border-primary/50 shadow-sm",
                day.is_past && !day.is_today && "opacity-70"
            )}
        >
            {/* Header do dia */}
            <button
                onClick={onToggle}
                className="w-full p-4 flex items-center gap-4 text-left"
            >
                <div
                    className={cn(
                        "h-12 w-12 rounded-xl flex flex-col items-center justify-center shrink-0",
                        day.is_today ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                >
                    <span className="text-xs font-medium capitalize">
                        {dayName.slice(0, 3)}
                    </span>
                    <span className="font-display text-lg font-bold leading-none">
                        {dateObj.getDate()}
                    </span>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground capitalize">
                            {day.is_today ? "Hoje" : dayName}
                        </p>
                        {day.is_today && (
                            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-medium">
                                hoje
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {day.pending_count} pendente{day.pending_count !== 1 ? "s" : ""} •{" "}
                        {day.total_minutes}min
                    </p>
                </div>

                {/* Progress ring */}
                <div className="relative h-10 w-10 shrink-0">
                    <svg className="h-10 w-10 -rotate-90" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="16" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                        <circle
                            cx="20" cy="20" r="16" fill="none"
                            stroke="hsl(var(--primary))" strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 16}`}
                            strokeDashoffset={`${2 * Math.PI * 16 * (1 - day.completion_rate / 100)}`}
                            className="transition-all duration-500"
                        />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-foreground">
                        {Math.round(day.completion_rate)}%
                    </span>
                </div>

                {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
            </button>

            {/* Items do dia */}
            {isExpanded && day.items.length > 0 && (
                <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                    {day.items.map((item) => (
                        <ScheduleItemRow
                            key={item.id}
                            item={item}
                            onCheckin={onCheckin}
                            isLoading={isCheckinLoading}
                        />
                    ))}
                </div>
            )}
        </Card>
    );
}

function ScheduleItemRow({
    item,
    onCheckin,
    isLoading,
}: {
    item: ScheduleItem;
    onCheckin: (id: string, completed: boolean, diff?: "easy" | "ok" | "hard") => void;
    isLoading: boolean;
}) {
    const [showDifficultyPicker, setShowDifficultyPicker] = useState(false);

    const typeConfig = {
        lesson: { icon: <BookOpen className="h-4 w-4" />, color: "text-primary bg-primary/10" },
        questions: { icon: <HelpCircle className="h-4 w-4" />, color: "text-secondary bg-secondary/10" },
        review: { icon: <RotateCcw className="h-4 w-4" />, color: "text-warning bg-warning/10" },
        simulado: { icon: <Play className="h-4 w-4" />, color: "text-destructive bg-destructive/10" },
    };

    const config = typeConfig[item.type] || typeConfig.lesson;

    if (item.status === "done") {
        return (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                        {item.lesson?.title || item.subject?.name || "Item concluído"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {item.estimated_minutes}min
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", config.color)}>
                    {config.icon}
                </div>

                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                        {item.lesson?.title || item.subject?.name || "Item de estudo"}
                    </p>
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 inline mr-0.5" />
                            {item.estimated_minutes}min
                        </p>
                        {item.subject && (
                            <span
                                className="text-xs px-1.5 py-0.5 rounded text-white"
                                style={{ backgroundColor: item.subject.color }}
                            >
                                {item.subject.name}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        onClick={() => setShowDifficultyPicker(!showDifficultyPicker)}
                        disabled={isLoading}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-success hover:bg-success/10 transition-colors disabled:opacity-50"
                        title="Marcar como concluído"
                    >
                        <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => onCheckin(item.id, false)}
                        disabled={isLoading}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        title="Não fiz"
                    >
                        <XCircle className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Seletor de dificuldade */}
            {showDifficultyPicker && (
                <div className="flex gap-2 pl-11 animate-fade-in">
                    <p className="text-xs text-muted-foreground self-center">
                        Dificuldade:
                    </p>
                    {(["easy", "ok", "hard"] as const).map((d) => (
                        <button
                            key={d}
                            onClick={() => {
                                onCheckin(item.id, true, d);
                                setShowDifficultyPicker(false);
                            }}
                            className={cn(
                                "text-xs px-2.5 py-1 rounded-lg border font-medium transition-all",
                                d === "easy" && "border-success/30 text-success hover:bg-success/10",
                                d === "ok" && "border-warning/30 text-warning hover:bg-warning/10",
                                d === "hard" && "border-destructive/30 text-destructive hover:bg-destructive/10"
                            )}
                        >
                            {d === "easy" ? "Fácil" : d === "ok" ? "Normal" : "Difícil"}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}