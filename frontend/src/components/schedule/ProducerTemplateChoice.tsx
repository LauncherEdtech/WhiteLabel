"use client";
// frontend/src/components/schedule/ProducerTemplateChoice.tsx
//
// Componente exibido ao aluno quando um curso possui cronograma do produtor.
// Aparece ANTES de gerar o cronograma IA, dando a escolha ao aluno.
//
// USO na página de cronograma do aluno:
//   Substitua o bloco de "Sem cronograma" por este componente.
//   Veja as instruções de integração no final deste arquivo.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Calendar, Sparkles, BookOpen, HelpCircle, RotateCcw,
    CheckCircle2, Clock, ChevronDown, ChevronUp, ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toaster";
import { studentScheduleTemplateApi } from "@/lib/api/producer-schedule";
import type { ProducerScheduleTemplate, TemplateItemType } from "@/types/producer-schedule";

// ── Props ─────────────────────────────────────────────────────────────────

interface ProducerTemplateChoiceProps {
    courseId: string;
    /** Chamado quando aluno adota o template do produtor */
    onAdopted: () => void;
    /** Chamado quando aluno opta por cronograma IA (se permitido) */
    onChooseAI: () => void;
}

// ── Labels ────────────────────────────────────────────────────────────────

const ITEM_ICONS: Record<TemplateItemType, any> = {
    lesson: BookOpen,
    questions: HelpCircle,
    review: RotateCcw,
    simulado: Calendar,
};
const ITEM_LABELS: Record<TemplateItemType, string> = {
    lesson: "Aula",
    questions: "Questões",
    review: "Revisão",
    simulado: "Simulado",
};
const ITEM_COLORS: Record<TemplateItemType, string> = {
    lesson: "bg-blue-500/10 text-blue-600",
    questions: "bg-orange-500/10 text-orange-600",
    review: "bg-purple-500/10 text-purple-600",
    simulado: "bg-green-500/10 text-green-600",
};

// ═════════════════════════════════════════════════════════════════════════════
// Componente
// ═════════════════════════════════════════════════════════════════════════════

export function ProducerTemplateChoice({
    courseId,
    onAdopted,
    onChooseAI,
}: ProducerTemplateChoiceProps) {
    const toast = useToast();
    const qc = useQueryClient();
    const [previewOpen, setPreviewOpen] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ["course-template", courseId],
        queryFn: () => studentScheduleTemplateApi.getCourseTemplate(courseId),
    });

    const adoptMut = useMutation({
        mutationFn: () => studentScheduleTemplateApi.adoptTemplate(courseId),
        onSuccess: () => {
            toast.success("Cronograma do professor adotado!");
            qc.invalidateQueries({ queryKey: ["schedule", courseId] });
            qc.invalidateQueries({ queryKey: ["schedule-check", courseId] });
            onAdopted();
        },
        onError: () => toast.error("Erro ao adotar cronograma"),
    });

    if (isLoading) {
        return (
            <div className="space-y-3">
                <div className="h-32 rounded-xl bg-muted animate-pulse" />
                <div className="h-12 rounded-xl bg-muted animate-pulse" />
            </div>
        );
    }

    const template = data?.template;
    const allowCustom = data?.allow_custom ?? true;

    // Sem template publicado → vai direto para geração IA
    if (!template) {
        return null; // Renderiza nada; a página exibirá o botão de gerar cronograma IA normal
    }

    return (
        <div className="space-y-4 animate-fade-in">
            <div>
                <h2 className="text-lg font-semibold text-foreground">Escolha seu cronograma</h2>
                <p className="text-sm text-muted-foreground">
                    Seu professor criou um cronograma para este curso.
                </p>
            </div>

            {/* Card: Cronograma do Professor */}
            <Card className="border-primary/30 bg-primary/5 overflow-hidden">
                <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10">
                                <Calendar className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">
                                    {template.title}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {template.total_days} dias · {template.items_count ?? 0} atividades
                                </p>
                            </div>
                        </div>
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-xs shrink-0">
                            Recomendado
                        </Badge>
                    </div>

                    {template.description && (
                        <p className="text-xs text-muted-foreground">{template.description}</p>
                    )}

                    {/* Preview dos primeiros dias */}
                    {template.days && template.days.length > 0 && (
                        <div>
                            <button
                                onClick={() => setPreviewOpen((v) => !v)}
                                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                            >
                                {previewOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                {previewOpen ? "Ocultar prévia" : "Ver estrutura do cronograma"}
                            </button>

                            {previewOpen && (
                                <div className="mt-2 space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                    {template.days.slice(0, 7).map((day) => (
                                        <div key={day.day_number} className="flex items-start gap-2">
                                            <span className="text-xs text-muted-foreground w-10 shrink-0 pt-0.5">
                                                Dia {day.day_number}
                                            </span>
                                            <div className="flex flex-wrap gap-1">
                                                {day.items.map((item) => {
                                                    const Icon = ITEM_ICONS[item.item_type];
                                                    return (
                                                        <span
                                                            key={item.id}
                                                            className={cn(
                                                                "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
                                                                ITEM_COLORS[item.item_type]
                                                            )}
                                                        >
                                                            <Icon className="h-3 w-3" />
                                                            {item.title ?? ITEM_LABELS[item.item_type]}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                    {template.days.length > 7 && (
                                        <p className="text-xs text-muted-foreground text-center pt-1">
                                            + {template.days.length - 7} dias...
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <Button
                        className="w-full gap-2"
                        onClick={() => adoptMut.mutate()}
                        disabled={adoptMut.isPending}
                    >
                        <CheckCircle2 className="h-4 w-4" />
                        {adoptMut.isPending ? "Adotando..." : "Seguir cronograma do professor"}
                    </Button>
                </CardContent>
            </Card>

            {/* Opção: Cronograma IA próprio */}
            {allowCustom && (
                <button
                    onClick={onChooseAI}
                    className="w-full flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/30 transition-all group"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-muted">
                            <Sparkles className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-medium text-foreground">
                                Criar meu próprio cronograma
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Gerado por IA com base no seu ritmo e performance
                            </p>
                        </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
            )}
        </div>
    );
}


export function buildQuestionsUrl(
    filters?: {
        tags?: string[];
        difficulty?: string;
        quantity?: number;
    } | null,
    subjectId?: string
): string {
    const params = new URLSearchParams();
    if (subjectId) params.set("subject_id", subjectId);
    if (filters?.difficulty) params.set("difficulty", filters.difficulty);
    if (filters?.quantity) params.set("quantity", String(filters.quantity));
    if (filters?.tags?.length) params.set("tags", filters.tags.join(","));
    const qs = params.toString();
    return `/questions${qs ? `?${qs}` : ""}`;
}