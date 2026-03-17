// frontend/src/app/(student)/questions/page.tsx
"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { questionsApi } from "@/lib/api/questions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import {
    Filter, ChevronLeft, ChevronRight,
    CheckCircle2, XCircle, Clock, BookOpen,
    RotateCcw, AlertCircle,
} from "lucide-react";
import type { Question, AnswerResult, DifficultyLevel } from "@/types/api";

const DIFFICULTIES: { value: DifficultyLevel | ""; label: string }[] = [
    { value: "", label: "Todas" },
    { value: "easy", label: "Fácil" },
    { value: "medium", label: "Médio" },
    { value: "hard", label: "Difícil" },
];

const FILTERS_HISTORY = [
    { key: "not_answered", label: "Não respondidas" },
    { key: "previously_wrong", label: "Erradas antes" },
    { key: "previously_correct", label: "Acertadas antes" },
];

export default function QuestionsPage() {
    const [filters, setFilters] = useState({
        difficulty: "" as DifficultyLevel | "",
        discipline: "",
        historyFilter: "" as string,
        page: 1,
    });
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ["questions", filters],
        queryFn: () =>
            questionsApi.list({
                difficulty: filters.difficulty || undefined,
                discipline: filters.discipline || undefined,
                not_answered: filters.historyFilter === "not_answered" ? true : undefined,
                previously_wrong: filters.historyFilter === "previously_wrong" ? true : undefined,
                previously_correct: filters.historyFilter === "previously_correct" ? true : undefined,
                page: filters.page,
                per_page: 10,
            }),
    });

    const answerMutation = useMutation({
        mutationFn: ({
            questionId,
            key,
        }: {
            questionId: string;
            key: string;
        }) => {
            const elapsed = startTime ? Math.round((Date.now() - startTime) / 1000) : undefined;
            return questionsApi.answer(questionId, {
                chosen_alternative_key: key,
                response_time_seconds: elapsed,
                context: "practice",
            });
        },
        onSuccess: (result) => setAnswerResult(result),
    });

    const questions: Question[] = data?.questions || [];
    const pagination = data?.pagination;
    const currentQuestion = questions[currentIndex];

    const handleSelectAnswer = (key: string) => {
        if (answerResult || answerMutation.isPending) return;
        if (!currentQuestion) return;
        answerMutation.mutate({ questionId: currentQuestion.id, key });
    };

    const handleNext = () => {
        setAnswerResult(null);
        setStartTime(Date.now());
        if (currentIndex < questions.length - 1) {
            setCurrentIndex((i) => i + 1);
        } else if (pagination?.has_next) {
            setFilters((f) => ({ ...f, page: f.page + 1 }));
            setCurrentIndex(0);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setAnswerResult(null);
            setCurrentIndex((i) => i - 1);
        }
    };

    // Inicia o timer ao mostrar a questão
    const timerStarted = useRef(false);
    if (currentQuestion && !answerResult && !timerStarted.current) {
        timerStarted.current = true;
        setStartTime(Date.now());
    }
    if (answerResult) timerStarted.current = false;

    return (
        <div className="space-y-5 animate-fade-in max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">
                        Questões
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Pratique com filtros inteligentes
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                >
                    <Filter className="h-4 w-4" />
                    Filtros
                </Button>
            </div>

            {/* Painel de filtros */}
            {showFilters && (
                <Card className="animate-fade-in">
                    <CardContent className="p-4 space-y-4">
                        {/* Dificuldade */}
                        <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                                DIFICULDADE
                            </p>
                            <div className="flex gap-2 flex-wrap">
                                {DIFFICULTIES.map(({ value, label }) => (
                                    <button
                                        key={value}
                                        onClick={() =>
                                            setFilters((f) => ({
                                                ...f,
                                                difficulty: value as DifficultyLevel | "",
                                                page: 1,
                                            }))
                                        }
                                        className={cn(
                                            "px-3 py-1 rounded-lg text-xs font-medium border transition-all",
                                            filters.difficulty === value
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Histórico */}
                        <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                                HISTÓRICO
                            </p>
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() =>
                                        setFilters((f) => ({ ...f, historyFilter: "", page: 1 }))
                                    }
                                    className={cn(
                                        "px-3 py-1 rounded-lg text-xs font-medium border transition-all",
                                        !filters.historyFilter
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "border-border text-muted-foreground hover:border-primary"
                                    )}
                                >
                                    Todas
                                </button>
                                {FILTERS_HISTORY.map(({ key, label }) => (
                                    <button
                                        key={key}
                                        onClick={() =>
                                            setFilters((f) => ({
                                                ...f,
                                                historyFilter: key,
                                                page: 1,
                                            }))
                                        }
                                        className={cn(
                                            "px-3 py-1 rounded-lg text-xs font-medium border transition-all",
                                            filters.historyFilter === key
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "border-border text-muted-foreground hover:border-primary"
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Disciplina */}
                        <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                                DISCIPLINA
                            </p>
                            <input
                                type="text"
                                placeholder="Ex: Direito Penal"
                                value={filters.discipline}
                                onChange={(e) =>
                                    setFilters((f) => ({
                                        ...f,
                                        discipline: e.target.value,
                                        page: 1,
                                    }))
                                }
                                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Questão */}
            {isLoading ? (
                <QuestionSkeleton />
            ) : !currentQuestion ? (
                <EmptyQuestions onReset={() => setFilters({ difficulty: "", discipline: "", historyFilter: "", page: 1 })} />
            ) : (
                <>
                    {/* Progress bar + contador */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full rounded-full bg-primary transition-all duration-300"
                                style={{
                                    width: `${((currentIndex + 1) / questions.length) * 100}%`,
                                }}
                            />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                            {currentIndex + 1}/{questions.length}
                        </span>
                    </div>

                    <QuestionCard
                        question={currentQuestion}
                        result={answerResult}
                        onSelect={handleSelectAnswer}
                        isLoading={answerMutation.isPending}
                    />

                    {/* Feedback após resposta */}
                    {answerResult && (
                        <FeedbackCard result={answerResult} onNext={handleNext} />
                    )}

                    {/* Navegação */}
                    {!answerResult && (
                        <div className="flex items-center justify-between">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handlePrev}
                                disabled={currentIndex === 0}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Anterior
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleNext}
                                disabled={
                                    currentIndex === questions.length - 1 &&
                                    !pagination?.has_next
                                }
                            >
                                Pular
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function QuestionCard({
    question,
    result,
    onSelect,
    isLoading,
}: {
    question: Question;
    result: AnswerResult | null;
    onSelect: (key: string) => void;
    isLoading: boolean;
}) {
    const difficultyConfig: Record
    string,
        { label: string; className: string }
        > = {
        easy: { label: "Fácil", className: "bg-success/10 text-success" },
        medium: { label: "Médio", className: "bg-warning/10 text-warning" },
        hard: { label: "Difícil", className: "bg-destructive/10 text-destructive" },
    };

    const diff = question.difficulty
        ? difficultyConfig[question.difficulty]
        : null;

    return (
        <Card className="animate-fade-in">
            <CardContent className="p-6 space-y-5">
                {/* Meta */}
                <div className="flex items-center gap-2 flex-wrap">
                    {diff && (
                        <span
                            className={cn(
                                "text-xs font-medium px-2 py-0.5 rounded-md",
                                diff.className
                            )}
                        >
                            {diff.label}
                        </span>
                    )}
                    {question.discipline && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                            {question.discipline}
                        </span>
                    )}
                    {question.exam_board && (
                        <span className="text-xs text-muted-foreground">
                            {question.exam_board}
                            {question.exam_year && ` • ${question.exam_year}`}
                        </span>
                    )}
                </div>

                {/* Enunciado */}
                {question.context && (
                    <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground leading-relaxed border-l-4 border-primary/30">
                        {question.context}
                    </div>
                )}
                <p className="text-sm text-foreground leading-relaxed font-medium">
                    {question.statement}
                </p>

                {/* Alternativas */}
                <div className="space-y-2">
                    {question.alternatives.map((alt) => {
                        const isChosen = result?.result.chosen_key === alt.key;
                        const isCorrect = result?.result.correct_key === alt.key;
                        const showResult = !!result;

                        return (
                            <button
                                key={alt.key}
                                onClick={() => onSelect(alt.key)}
                                disabled={showResult || isLoading}
                                className={cn(
                                    "w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-200",
                                    !showResult &&
                                    "hover:border-primary hover:bg-primary/5 active:scale-[0.99]",
                                    showResult && isCorrect && "border-success bg-success/5",
                                    showResult &&
                                    isChosen &&
                                    !isCorrect &&
                                    "border-destructive bg-destructive/5",
                                    !showResult && "border-border bg-background",
                                    isLoading && "opacity-60 cursor-wait"
                                )}
                            >
                                <span
                                    className={cn(
                                        "h-6 w-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-colors",
                                        !showResult && "bg-muted text-muted-foreground",
                                        showResult && isCorrect && "bg-success text-success-foreground",
                                        showResult && isChosen && !isCorrect && "bg-destructive text-destructive-foreground",
                                        showResult && !isChosen && !isCorrect && "bg-muted text-muted-foreground opacity-50"
                                    )}
                                >
                                    {alt.key.toUpperCase()}
                                </span>
                                <span
                                    className={cn(
                                        "text-sm leading-relaxed",
                                        showResult && isCorrect && "text-success font-medium",
                                        showResult && isChosen && !isCorrect && "text-destructive",
                                        showResult && !isChosen && !isCorrect && "text-muted-foreground"
                                    )}
                                >
                                    {alt.text}
                                </span>
                                {showResult && isCorrect && (
                                    <CheckCircle2 className="h-4 w-4 text-success shrink-0 ml-auto mt-0.5" />
                                )}
                                {showResult && isChosen && !isCorrect && (
                                    <XCircle className="h-4 w-4 text-destructive shrink-0 ml-auto mt-0.5" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

function FeedbackCard({
    result,
    onNext,
}: {
    result: AnswerResult;
    onNext: () => void;
}) {
    return (
        <Card
            className={cn(
                "border-l-4 animate-fade-in",
                result.result.is_correct ? "border-l-success" : "border-l-destructive"
            )}
        >
            <CardContent className="p-5 space-y-4">
                {/* Resultado */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {result.result.is_correct ? (
                            <>
                                <CheckCircle2 className="h-5 w-5 text-success" />
                                <span className="font-semibold text-success">Correto!</span>
                            </>
                        ) : (
                            <>
                                <XCircle className="h-5 w-5 text-destructive" />
                                <span className="font-semibold text-destructive">Incorreto</span>
                            </>
                        )}
                    </div>
                    {result.result.response_time_seconds && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {result.result.response_time_seconds}s
                        </span>
                    )}
                </div>

                {/* Justificativa do erro */}
                {!result.result.is_correct && result.feedback.distractor_justification && (
                    <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                        <p className="text-xs font-semibold text-destructive mb-1">
                            Por que sua resposta está errada:
                        </p>
                        <p className="text-xs text-foreground leading-relaxed">
                            {result.feedback.distractor_justification}
                        </p>
                    </div>
                )}

                {/* Justificativa da correta */}
                {result.feedback.correct_justification && (
                    <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                        <p className="text-xs font-semibold text-success mb-1">
                            Por que a resposta correta ({result.result.correct_key.toUpperCase()}) está certa:
                        </p>
                        <p className="text-xs text-foreground leading-relaxed">
                            {result.feedback.correct_justification}
                        </p>
                    </div>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 pt-1 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                        Taxa de acerto geral:{" "}
                        <span className="font-medium text-foreground">
                            {result.question_stats.accuracy_rate}%
                        </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {result.question_stats.total_attempts} tentativas
                    </span>
                </div>

                <Button className="w-full" onClick={onNext}>
                    Próxima questão
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </CardContent>
        </Card>
    );
}

function QuestionSkeleton() {
    return (
        <Card className="animate-pulse">
            <CardContent className="p-6 space-y-4">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-4 bg-muted rounded w-5/6" />
                    <div className="h-4 bg-muted rounded w-4/6" />
                </div>
                <div className="space-y-2 pt-2">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-12 bg-muted rounded-xl" />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function EmptyQuestions({ onReset }: { onReset: () => void }) {
    return (
        <Card>
            <CardContent className="py-16 flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center">
                    <p className="font-semibold text-foreground">
                        Nenhuma questão encontrada
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Tente ajustar os filtros ou explore outras disciplinas.
                    </p>
                </div>
                <Button variant="outline" onClick={onReset}>
                    <RotateCcw className="h-4 w-4" />
                    Limpar filtros
                </Button>
            </CardContent>
        </Card>
    );
}