// frontend/src/app/(student)/simulados/[id]/result/page.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useAttemptResult } from "@/lib/hooks/useSimulados";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { DifficultyBadge } from "@/components/shared/DifficultyBadge";
import { cn } from "@/lib/utils/cn";
import { Trophy, XCircle, CheckCircle2, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { formatSeconds } from "@/lib/utils/format";

export default function SimuladoResultPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const attemptId = searchParams.get("attempt") || "";
    const [expandedAnswers, setExpandedAnswers] = useState(false);

    const { data, isLoading } = useAttemptResult(attemptId);

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
        );
    }

    if (!data) return null;

    const { score, by_discipline, answers } = data;
    const passed = score.passed;

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
            {/* Score principal */}
            <Card className={cn("border-2", passed ? "border-success/50" : "border-destructive/30")}>
                <CardContent className="p-8 text-center space-y-4">
                    <div className={cn(
                        "h-20 w-20 rounded-2xl flex items-center justify-center mx-auto",
                        passed ? "bg-success/10" : "bg-destructive/10"
                    )}>
                        {passed
                            ? <Trophy className="h-10 w-10 text-success" />
                            : <XCircle className="h-10 w-10 text-destructive" />
                        }
                    </div>

                    <div>
                        <p className={cn("font-display text-5xl font-bold", passed ? "text-success" : "text-destructive")}>
                            {score.score_percent}%
                        </p>
                        <p className="text-muted-foreground mt-1">
                            {passed ? "Parabéns! Você foi aprovado!" : "Continue praticando!"}
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-2">
                        <div className="text-center">
                            <p className="text-2xl font-display font-bold text-success">{score.correct_answers}</p>
                            <p className="text-xs text-muted-foreground">Acertos</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-display font-bold text-destructive">{score.wrong_answers}</p>
                            <p className="text-xs text-muted-foreground">Erros</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-display font-bold text-muted-foreground">{score.skipped}</p>
                            <p className="text-xs text-muted-foreground">Puladas</p>
                        </div>
                    </div>

                    {data.attempt.total_time_seconds && (
                        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                            <Clock className="h-4 w-4" />
                            Tempo: {formatSeconds(data.attempt.total_time_seconds)}
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Por disciplina */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Desempenho por disciplina</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {by_discipline.map((d: { discipline: string; correct: number; total: number; accuracy_rate: number }) => (
                        <div key={d.discipline} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-foreground font-medium">{d.discipline}</span>
                                <span className={cn(
                                    "font-semibold",
                                    d.accuracy_rate >= 70 ? "text-success" :
                                        d.accuracy_rate >= 50 ? "text-warning" : "text-destructive"
                                )}>
                                    {d.correct}/{d.total} ({d.accuracy_rate}%)
                                </span>
                            </div>
                            <ProgressBar
                                value={d.accuracy_rate}
                                color={d.accuracy_rate >= 70 ? "success" : d.accuracy_rate >= 50 ? "warning" : "destructive"}
                            />
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Gabarito detalhado */}
            <Card>
                <button
                    onClick={() => setExpandedAnswers(!expandedAnswers)}
                    className="w-full p-5 flex items-center justify-between"
                >
                    <CardTitle className="text-base">Gabarito detalhado</CardTitle>
                    {expandedAnswers ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {expandedAnswers && (
                    <CardContent className="pt-0 space-y-4">
                        {answers.map((answer: {
                            question_id: string; statement: string; discipline: string;
                            difficulty: string; is_correct: boolean; chosen_key: string;
                            correct_key: string; correct_justification: string | null;
                            distractor_justification: string | null; skipped: boolean;
                            alternatives: { key: string; text: string }[];
                        }, i: number) => (
                            <div
                                key={answer.question_id}
                                className={cn(
                                    "p-4 rounded-xl border",
                                    answer.is_correct ? "border-success/30 bg-success/5" :
                                        answer.skipped ? "border-border" : "border-destructive/30 bg-destructive/5"
                                )}
                            >
                                <div className="flex items-start gap-2 mb-2">
                                    <span className="text-xs font-bold text-muted-foreground">Q{i + 1}</span>
                                    {answer.is_correct
                                        ? <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                                        : <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                    }
                                    <p className="text-sm text-foreground leading-relaxed">{answer.statement}</p>
                                </div>

                                <div className="flex items-center gap-2 mb-2">
                                    <Badge variant={answer.is_correct ? "success" : "destructive"} className="text-xs">
                                        {answer.skipped ? "Pulada" : answer.is_correct ? "Correta" : `Marcou ${answer.chosen_key?.toUpperCase()}`}
                                    </Badge>
                                    {!answer.is_correct && !answer.skipped && (
                                        <Badge variant="outline" className="text-xs">
                                            Correta: {answer.correct_key?.toUpperCase()}
                                        </Badge>
                                    )}
                                </div>

                                {answer.distractor_justification && (
                                    <p className="text-xs text-muted-foreground bg-destructive/10 p-2 rounded-lg mb-2">
                                        <strong className="text-destructive">Seu erro:</strong> {answer.distractor_justification}
                                    </p>
                                )}
                                {answer.correct_justification && (
                                    <p className="text-xs text-muted-foreground bg-success/10 p-2 rounded-lg">
                                        <strong className="text-success">Por que ({answer.correct_key?.toUpperCase()}) está correta:</strong>{" "}
                                        {answer.correct_justification}
                                    </p>
                                )}
                            </div>
                        ))}
                    </CardContent>
                )}
            </Card>

            <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => router.push("/simulados")}>
                    Outros simulados
                </Button>
                <Button className="flex-1" onClick={() => router.push("/questions")}>
                    Praticar questões
                </Button>
            </div>
        </div>
    );
}