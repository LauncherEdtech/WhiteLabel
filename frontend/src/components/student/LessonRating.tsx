// frontend/src/components/student/LessonRating.tsx
// Componente de avaliação de aula — estrelas + comentário opcional.
// Exibido na página da aula após o check-in.
"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { useTrack } from "@/lib/hooks/useTrack";
import { cn } from "@/lib/utils/cn";
import { Star, Send } from "lucide-react";

interface LessonRatingProps {
    lessonId: string;
}

export function LessonRating({ lessonId }: LessonRatingProps) {
    const toast = useToast();
    const queryClient = useQueryClient();
    const track = useTrack();
    const [stars, setStars] = useState(0);
    const [hovered, setHovered] = useState(0);
    const [comment, setComment] = useState("");
    const [submitted, setSubmitted] = useState(false);

    // Busca avaliação existente
    const { data: existing } = useQuery({
        queryKey: ["lesson-rating", lessonId],
        queryFn: () => apiClient.get(`/gamification/ratings/lessons/${lessonId}/mine`).then(r => r.data),
    });

    const existingRating = existing?.rating;

    const submitMutation = useMutation({
        // ── TRACK: lesson_rated ───────────────────────────────────────────────
        // Disparado ANTES da request — captura intenção mesmo se a API falhar.
        // Inclui has_comment como sinal: alunos que escrevem texto têm
        // engajamento muito mais alto que os que só clicam estrelas.
        mutationFn: () => {
            const trimmedComment = comment.trim();
            track({
                event_type: "lesson_rated",
                feature_name: "aulas",
                target_id: lessonId,
                metadata: {
                    stars,
                    has_comment: trimmedComment.length > 0,
                    comment_length: trimmedComment.length,
                },
            });
            return apiClient.post(`/gamification/ratings/lessons/${lessonId}`, {
                rating: stars,
                comment: trimmedComment || null,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lesson-rating", lessonId] });
            toast.success("Avaliação enviada!", "Obrigado pelo seu feedback.");
            setSubmitted(true);
        },
        onError: () => toast.error("Erro ao enviar avaliação"),
    });

    // Já avaliou anteriormente
    if (existingRating && !submitted) {
        return (
            <div className="p-4 rounded-xl bg-muted/30 border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Sua avaliação</p>
                <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={cn(
                            "h-5 w-5",
                            s <= existingRating.stars ? "fill-warning text-warning" : "text-muted-foreground"
                        )} />
                    ))}
                    <span className="text-sm text-muted-foreground ml-2">{existingRating.stars}/5</span>
                </div>
                {existingRating.comment && (
                    <p className="text-xs text-muted-foreground mt-2 italic">"{existingRating.comment}"</p>
                )}
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="p-4 rounded-xl bg-success/5 border border-success/20 text-center">
                <p className="text-sm font-medium text-success">✓ Avaliação enviada!</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={cn(
                            "h-4 w-4",
                            s <= stars ? "fill-warning text-warning" : "text-muted-foreground"
                        )} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 rounded-xl border border-border bg-background space-y-3">
            <p className="text-sm font-medium text-foreground">Como foi esta aula?</p>

            {/* Estrelas */}
            <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                    <button
                        key={s}
                        onClick={() => setStars(s)}
                        onMouseEnter={() => setHovered(s)}
                        onMouseLeave={() => setHovered(0)}
                        className="transition-transform hover:scale-110"
                    >
                        <Star className={cn(
                            "h-7 w-7 transition-colors",
                            s <= (hovered || stars)
                                ? "fill-warning text-warning"
                                : "text-muted-foreground hover:text-warning"
                        )} />
                    </button>
                ))}
                {stars > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">
                        {["", "Muito ruim", "Ruim", "Regular", "Boa", "Excelente!"][stars]}
                    </span>
                )}
            </div>

            {/* Comentário (aparece após selecionar estrelas) */}
            {stars > 0 && (
                <div className="space-y-2">
                    <textarea
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        placeholder="Deixe um comentário opcional... (ex: o conteúdo foi muito rápido, precisava de mais exemplos)"
                        className="w-full h-20 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                        maxLength={1000}
                    />
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{comment.length}/1000</span>
                        <Button
                            size="sm"
                            onClick={() => submitMutation.mutate()}
                            loading={submitMutation.isPending}
                            disabled={stars === 0}
                        >
                            <Send className="h-3.5 w-3.5" />
                            Enviar avaliação
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}