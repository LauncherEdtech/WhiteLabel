// frontend/src/app/(student)/simulados/[id]/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSimulado, useStartAttempt, useAnswerSimulado, useFinishAttempt } from "@/lib/hooks/useSimulados";
import { useTimer } from "@/lib/hooks/useTimer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils/cn";
import { secondsToDisplay, isTimeCritical, timerColor } from "@/lib/utils/time";
import { Clock, CheckCircle2, ChevronLeft, ChevronRight, Flag, BookOpen, LayoutList, X } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SimuladoQuestion {
    id: string;
    statement: string;
    context: string | null;
    discipline: string | null;
    difficulty: string | null;
    alternatives: { key: string; text: string }[];
    chosen_key?: string | null;
}

// ── Discipline sidebar ────────────────────────────────────────────────────────

function DisciplinePanel({
    questions,
    answers,
    currentIndex,
    onJump,
    onClose,
}: {
    questions: SimuladoQuestion[];
    answers: Record<string, string>;
    currentIndex: number;
    onJump: (index: number) => void;
    onClose: () => void;
}) {
    const groups = useMemo(() => {
        const map = new Map<string, { name: string; indices: number[] }>();
        questions.forEach((q, i) => {
            const disc = q.discipline || "Sem disciplina";
            if (!map.has(disc)) map.set(disc, { name: disc, indices: [] });
            map.get(disc)!.indices.push(i);
        });
        return Array.from(map.values());
    }, [questions]);

    if (groups.length <= 1) return null;

    return (
        <aside className={cn(
            "shrink-0 transition-all duration-300",
            // Mobile: fixed drawer overlay
            "fixed top-0 left-0 h-full z-40 bg-background overflow-y-auto p-5 shadow-2xl w-72",
            // Desktop: inline sidebar
            "sm:static sm:h-auto sm:z-auto sm:bg-transparent sm:overflow-visible sm:p-0 sm:shadow-none sm:w-52 sm:space-y-1.5"
        )}>
            {/* Header do drawer — só mobile */}
            <div className="flex items-center justify-between mb-4 sm:hidden">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <LayoutList className="h-4 w-4" />
                    Disciplinas
                </p>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                    <X className="h-4 w-4 text-muted-foreground" />
                </button>
            </div>

            {/* Label desktop */}
            <p className="hidden sm:flex text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 items-center gap-1.5">
                <LayoutList className="h-3.5 w-3.5" />
                Disciplinas
            </p>

            <div className="space-y-1.5">
                {groups.map((group) => {
                    const answeredInGroup = group.indices.filter(i => answers[questions[i]?.id]).length;
                    const isActive = group.indices.includes(currentIndex);
                    const firstUnanswered = group.indices.find(i => !answers[questions[i]?.id]);
                    const jumpTo = firstUnanswered ?? group.indices[0];

                    return (
                        <button
                            key={group.name}
                            onClick={() => {
                                onJump(jumpTo);
                                onClose(); // fecha drawer no mobile após navegar
                            }}
                            className={cn(
                                "w-full text-left px-3 py-2.5 rounded-xl border transition-all",
                                isActive
                                    ? "border-primary bg-primary/8 shadow-sm"
                                    : "border-border hover:border-primary/40 hover:bg-muted/50"
                            )}
                        >
                            <p className={cn(
                                "text-xs font-medium leading-snug line-clamp-2",
                                isActive ? "text-primary" : "text-foreground"
                            )}>
                                {group.name}
                            </p>
                            <div className="flex items-center justify-between mt-1.5">
                                <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden mr-2">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all",
                                            answeredInGroup === group.indices.length
                                                ? "bg-success"
                                                : "bg-primary"
                                        )}
                                        style={{ width: `${(answeredInGroup / group.indices.length) * 100}%` }}
                                    />
                                </div>
                                <span className={cn(
                                    "text-[10px] font-mono shrink-0",
                                    answeredInGroup === group.indices.length
                                        ? "text-success"
                                        : "text-muted-foreground"
                                )}>
                                    {answeredInGroup}/{group.indices.length}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </aside>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
    const [attemptQuestions, setAttemptQuestions] = useState<SimuladoQuestion[]>([]);
    const [showDisciplines, setShowDisciplines] = useState(false);

    const timeLimit = simulado?.time_limit_minutes ? simulado.time_limit_minutes * 60 : 3600;

    const { seconds, start: startTimer } = useTimer({
        initialSeconds: timeLimit,
        autoStart: false,
        onExpire: () => handleFinish(true),
    });

    useEffect(() => {
        if (started) startTimer();
    }, [started]);

    const handleStart = async () => {
        if (!id) return;
        const data = await startAttempt.mutateAsync(id);
        const aid = data.attempt?.id;
        const qs: SimuladoQuestion[] = data.attempt?.questions || [];

        const preAnswered: Record<string, string> = {};
        qs.forEach((q: SimuladoQuestion) => {
            if (q.chosen_key) preAnswered[q.id] = q.chosen_key;
        });

        if (aid) {
            setAttemptId(aid);
            setAttemptQuestions(qs);
            setAnswers(preAnswered);
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

    const questions: SimuladoQuestion[] = started
        ? attemptQuestions
        : (simulado.questions || []);

    const totalQuestions = started
        ? questions.length
        : (simulado.total_questions || questions.length || 0);

    const currentQuestion = questions[currentIndex];
    const answeredCount = Object.keys(answers).length;

    // ── Lobby ─────────────────────────────────────────────────────────────────
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
                                <p className="font-display text-2xl font-bold text-foreground">{totalQuestions}</p>
                                <p className="text-xs text-muted-foreground">Questões</p>
                            </div>
                            <div className="p-3 rounded-lg bg-muted text-center">
                                <p className="font-display text-2xl font-bold text-foreground">{simulado.time_limit_minutes}min</p>
                                <p className="text-xs text-muted-foreground">Tempo</p>
                            </div>
                        </div>
                        {simulado.settings?.question_filter && simulado.settings.question_filter !== "all" && (
                            <div className="flex items-center justify-center gap-1.5 text-xs text-primary bg-primary/8 px-3 py-1.5 rounded-full border border-primary/20 w-fit mx-auto">
                                <BookOpen className="h-3 w-3" />
                                {{
                                    not_answered: "Questões não respondidas",
                                    previously_wrong: "Questões erradas antes",
                                    previously_correct: "Questões acertadas antes",
                                }[simulado.settings.question_filter as string] ?? simulado.settings.question_filter}
                            </div>
                        )}
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

    // ── Prova ─────────────────────────────────────────────────────────────────
    const hasDisciplines = questions.some(q => q.discipline);

    return (
        <div className="animate-fade-in">

            {/* Backdrop mobile — aparece atrás do drawer de disciplinas */}
            {showDisciplines && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 sm:hidden"
                    onClick={() => setShowDisciplines(false)}
                />
            )}

            {/* Header com timer
                Mobile : 3 itens compactos (contador | timer | botões)
                Desktop: igual ao original
            ── */}
            <div className="flex items-center justify-between py-2 mb-4 gap-2">
                {/* Esquerda: contador + toggle disciplinas */}
                <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground font-mono shrink-0">
                        {currentIndex + 1}<span className="text-muted-foreground/50">/{totalQuestions}</span>
                    </div>
                    {hasDisciplines && (
                        <button
                            onClick={() => setShowDisciplines(v => !v)}
                            className={cn(
                                "flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all",
                                showDisciplines
                                    ? "border-primary/30 bg-primary/8 text-primary"
                                    : "border-border text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <LayoutList className="h-3 w-3" />
                            {/* Texto oculto em telas pequenas */}
                            <span className="hidden sm:inline">Disciplinas</span>
                        </button>
                    )}
                </div>

                {/* Centro: timer */}
                <div className={cn(
                    "flex items-center gap-1.5 font-display font-bold tabular-nums",
                    "text-base sm:text-xl",
                    timerColor(seconds)
                )}>
                    <Clock className={cn("h-4 w-4 sm:h-5 sm:w-5", isTimeCritical(seconds) && "animate-pulse")} />
                    {secondsToDisplay(seconds)}
                </div>

                {/* Direita: botão finalizar — ícone no mobile, texto no desktop */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmFinish(true)}
                    disabled={finishAttempt.isPending}
                >
                    <Flag className="h-4 w-4" />
                    <span className="hidden sm:inline">Finalizar</span>
                </Button>
            </div>

            {/* Barra de progresso geral */}
            <Progress value={(answeredCount / totalQuestions) * 100} className="h-1 mb-4" />

            {/* Layout: sidebar de disciplinas + questão
                Mobile : DisciplinePanel como drawer fixo (z-40), conteúdo ocupa 100%
                Desktop: sidebar inline w-52 + flex-1
            ── */}
            <div className="flex gap-5">
                {/* Sidebar de disciplinas */}
                {showDisciplines && questions.length > 0 && (
                    <DisciplinePanel
                        questions={questions}
                        answers={answers}
                        currentIndex={currentIndex}
                        onJump={(i) => setCurrentIndex(i)}
                        onClose={() => setShowDisciplines(false)}
                    />
                )}

                {/* Questão + navegação — sempre ocupa 100% no mobile */}
                <div className="flex-1 min-w-0 space-y-4">
                    {currentQuestion && (
                        <Card className="animate-fade-in">
                            <CardContent className="p-4 sm:p-6 space-y-5">
                                {/* Metadados */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    {currentQuestion.discipline && (
                                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-md font-medium">
                                            {currentQuestion.discipline}
                                        </span>
                                    )}
                                    {currentQuestion.difficulty && (
                                        <span className={cn(
                                            "text-xs px-2 py-0.5 rounded-md border font-medium",
                                            currentQuestion.difficulty === "easy" && "bg-success/10 text-success border-success/20",
                                            currentQuestion.difficulty === "medium" && "bg-warning/10 text-warning border-warning/20",
                                            currentQuestion.difficulty === "hard" && "bg-destructive/10 text-destructive border-destructive/20",
                                        )}>
                                            {{ easy: "Fácil", medium: "Médio", hard: "Difícil" }[currentQuestion.difficulty] ?? currentQuestion.difficulty}
                                        </span>
                                    )}
                                    {answers[currentQuestion.id] && (
                                        <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-md flex items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3" /> Respondida
                                        </span>
                                    )}
                                </div>

                                {/* Contexto */}
                                {currentQuestion.context && (
                                    <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground leading-relaxed border-l-4 border-primary/30 whitespace-pre-wrap">
                                        {currentQuestion.context}
                                    </div>
                                )}

                                {/* Enunciado */}
                                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                    {currentQuestion.statement}
                                </p>

                                {/* Alternativas */}
                                <div className="space-y-2">
                                    {currentQuestion.alternatives?.map((alt) => {
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

                    {/* Navegação + mapa de questões */}
                    <div className="flex items-center justify-between gap-2">
                        <Button
                            variant="outline" size="sm"
                            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                            disabled={currentIndex === 0}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            <span className="hidden sm:inline">Anterior</span>
                        </Button>

                        {/* Mapa de questões */}
                        <div className="flex gap-1 flex-wrap justify-center flex-1 min-w-0">
                            {questions.slice(
                                Math.max(0, currentIndex - 9),
                                Math.min(questions.length, Math.max(0, currentIndex - 9) + 20)
                            ).map((q, offset) => {
                                const realIndex = Math.max(0, currentIndex - 9) + offset;
                                return (
                                    <button
                                        key={realIndex}
                                        onClick={() => setCurrentIndex(realIndex)}
                                        className={cn(
                                            "h-7 w-7 rounded-md text-xs font-medium transition-all",
                                            realIndex === currentIndex && "ring-2 ring-primary ring-offset-1",
                                            answers[q.id]
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                                        )}
                                    >
                                        {realIndex + 1}
                                    </button>
                                );
                            })}
                        </div>

                        <Button
                            variant="outline" size="sm"
                            onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))}
                            disabled={currentIndex === questions.length - 1}
                        >
                            <span className="hidden sm:inline">Próxima</span>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={confirmFinish}
                onOpenChange={setConfirmFinish}
                title="Finalizar simulado?"
                description={`Você respondeu ${answeredCount} de ${totalQuestions} questões. Tem certeza que deseja finalizar?`}
                confirmLabel="Finalizar"
                onConfirm={() => handleFinish()}
                loading={finishAttempt.isPending}
            />
        </div>
    );
}