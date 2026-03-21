// frontend/src/app/(student)/simulados/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSimulado, useStartAttempt, useAnswerSimulado, useFinishAttempt } from "@/lib/hooks/useSimulados";
import { useTimer } from "@/lib/hooks/useTimer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils/cn";
import { secondsToDisplay, isTimeCritical, timerColor } from "@/lib/utils/time";
import { Clock, CheckCircle2, ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

export default function SimuladoPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const { data: simulado, isLoading } = useSimulado(id);
    const startAttempt = useStartAttempt();
    const answerSimulado = useAnswerSimulado();
    const finishAttempt = useFinishAttempt();

    const [attemptId, setAttemptId] = useState<string | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [startTime, setStartTime] = useState<number>(Date.now());
    const [confirmFinish, setConfirmFinish] = useState(false);
    const [started, setStarted] = useState(false);

    const timeLimit = simulado?.time_limit_minutes ? simulado.time_limit_minutes * 60 : 3600;

    const { seconds, start: startTimer } = useTimer({
        initialSeconds: timeLimit,
        autoStart: false,
        onExpire: () => handleFinish(true),
    });

    // Inicia o timer quando o simulado começa
    useEffect(() => {
        if (started) startTimer();
    }, [started]);

    const handleStart = async () => {
        if (!id) return;
        const data = await startAttempt.mutateAsync(id);
        const aid = data.attempt?.id;
        if (aid) {
            setAttemptId(aid);
            setStarted(true);
            setStartTime(Date.now());
        }
    };

    const handleSelect = async (questionId: string, key: string) => {
        if (!attemptId) return;
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        setAnswers((prev) => ({ ...prev, [questionId]: key }));
        setStartTime(Date.now());
        await answerSimulado.mutateAsync({
            attemptId,
            questionId,
            chosenKey: key,
            responseTime: elapsed,
        });
    };

    const handleFinish = async (timedOut = false) => {
        if (!attemptId) return;
        await finishAttempt.mutateAsync(attemptId);
        router.push(`/simulados/${id}/result?attempt=${attemptId}`);
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
        );
    }

    if (!simulado) return null;

    const questions = simulado.questions || [];
    const currentQuestion = questions[currentIndex];
    const answeredCount = Object.keys(answers).length;

    // Tela de lobby
    if (!started) {
        return (
            <div className="max-w-lg mx-auto space-y-6 animate-fade-in pt-8">
                <Card>
                    <CardContent className="p-8 text-center space-y-4">
                        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                            <Flag className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <h1 className="font-display text-2xl font-bold text-foreground">{simulado.title}</h1>
                            {simulado.description && (
                                <p className="text-muted-foreground text-sm mt-1">{simulado.description}</p>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 py-2">
                            <div className="p-3 rounded-lg bg-muted text-center">
                                <p className="font-display text-2xl font-bold text-foreground">{questions.length}</p>
                                <p className="text-xs text-muted-foreground">Questões</p>
                            </div>
                            <div className="p-3 rounded-lg bg-muted text-center">
                                <p className="font-display text-2xl font-bold text-foreground">{simulado.time_limit_minutes}min</p>
                                <p className="text-xs text-muted-foreground">Tempo</p>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Mínimo para aprovação: {Math.round((simulado.settings?.passing_score || 0.6) * 100)}%
                        </p>
                        <Button className="w-full" size="lg" onClick={handleStart} loading={startAttempt.isPending}>
                            Iniciar simulado
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-4 animate-fade-in">
            {/* Header com timer */}
            <div className="flex items-center justify-between py-2">
                <div className="text-sm text-muted-foreground">
                    {currentIndex + 1} / {questions.length}
                </div>
                <div className={cn("flex items-center gap-2 font-display text-xl font-bold tabular-nums", timerColor(seconds))}>
                    <Clock className={cn("h-5 w-5", isTimeCritical(seconds) && "animate-pulse")} />
                    {secondsToDisplay(seconds)}
                </div>
                <Button
                    variant="outline" size="sm"
                    onClick={() => setConfirmFinish(true)}
                    disabled={finishAttempt.isPending}
                >
                    <Flag className="h-4 w-4" />
                    Finalizar
                </Button>
            </div>

            {/* Progress */}
            <Progress value={(answeredCount / questions.length) * 100} className="h-1.5" />

            {/* Questão atual */}
            {currentQuestion && (
                <Card>
                    <CardContent className="p-6 space-y-5">
                        <div className="flex items-center gap-2">
                            {currentQuestion.discipline && (
                                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-md">
                                    {currentQuestion.discipline}
                                </span>
                            )}
                            {answers[currentQuestion.id] && (
                                <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Respondida
                                </span>
                            )}
                        </div>

                        <p className="text-sm text-foreground leading-relaxed font-medium">
                            {currentQuestion.statement}
                        </p>

                        <div className="space-y-2">
                            {currentQuestion.alternatives?.map((alt: { key: string; text: string }) => {
                                const isSelected = answers[currentQuestion.id] === alt.key;
                                return (
                                    <button
                                        key={alt.key}
                                        onClick={() => handleSelect(currentQuestion.id, alt.key)}
                                        className={cn(
                                            "w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-150 active:scale-[0.99]",
                                            isSelected
                                                ? "border-primary bg-primary/5 shadow-sm"
                                                : "border-border hover:border-primary/50 hover:bg-accent"
                                        )}
                                    >
                                        <span className={cn(
                                            "h-6 w-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                                            isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                        )}>
                                            {alt.key.toUpperCase()}
                                        </span>
                                        <span className={cn("text-sm leading-relaxed", isSelected && "text-foreground font-medium")}>
                                            {alt.text}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Navegação */}
            <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0}>
                    <ChevronLeft className="h-4 w-4" /> Anterior
                </Button>

                {/* Mapa de questões */}
                <div className="flex gap-1 flex-wrap justify-center max-w-xs">
                    {questions.map((_: unknown, i: number) => (
                        <button
                            key={i}
                            onClick={() => setCurrentIndex(i)}
                            className={cn(
                                "h-7 w-7 rounded-md text-xs font-medium transition-all",
                                i === currentIndex && "ring-2 ring-primary ring-offset-1",
                                answers[questions[i]?.id] ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div>

                <Button variant="outline" size="sm" onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))} disabled={currentIndex === questions.length - 1}>
                    Próxima <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            <ConfirmDialog
                open={confirmFinish}
                onOpenChange={setConfirmFinish}
                title="Finalizar simulado?"
                description={`Você respondeu ${answeredCount} de ${questions.length} questões. Tem certeza que deseja finalizar?`}
                confirmLabel="Finalizar"
                onConfirm={() => handleFinish()}
                loading={finishAttempt.isPending}
            />
        </div>
    );
}