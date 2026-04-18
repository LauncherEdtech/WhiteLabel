"use client";
// frontend/src/app/(student)/questions/page.tsx

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { questionsApi } from "@/lib/api/questions";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import {
    Filter, ChevronLeft, ChevronRight, CheckCircle2, XCircle,
    BookOpen, RotateCcw, Lightbulb, ChevronDown,
    Target, Layers, TrendingUp, LayoutList, LayoutGrid, X,
} from "lucide-react";
import type { Question, AnswerResult, DifficultyLevel } from "@/types/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuestionWithTip extends Question {
    review_status?: string;
}

interface Filters {
    difficulty: DifficultyLevel | "";
    discipline: string;
    topic: string;
    historyFilter: string;
    page: number;
}

type ViewMode = "block" | "list";

// ── Config ────────────────────────────────────────────────────────────────────

const DIFFICULTIES = [
    { value: "" as const, label: "Todas", color: "" },
    { value: "easy" as const, label: "Fácil", color: "text-success border-success/40 bg-success/5" },
    { value: "medium" as const, label: "Médio", color: "text-warning border-warning/40 bg-warning/5" },
    { value: "hard" as const, label: "Difícil", color: "text-destructive border-destructive/40 bg-destructive/5" },
];

const DIFFICULTY_CONFIG: Record<string, { label: string; className: string }> = {
    easy: { label: "Fácil", className: "bg-success/10 text-success border-success/20" },
    medium: { label: "Médio", className: "bg-warning/10 text-warning border-warning/20" },
    hard: { label: "Difícil", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const HISTORY_FILTERS = [
    { key: "", label: "Todas" },
    { key: "not_answered", label: "Não respondidas" },
    { key: "previously_wrong", label: "Erradas antes" },
    { key: "previously_correct", label: "Acertadas antes" },
];

const PER_PAGE = 20;

// ── Inner Page (usa useSearchParams) ─────────────────────────────────────────

function QuestionsContent() {
    const searchParams = useSearchParams();

    // Inicializa filtros a partir dos query params (vindo do cronograma)
    const initDiscipline = searchParams.get("discipline") ?? "";
    const initNotAnsw = searchParams.get("not_answered") === "true";
    const initPrevWrong = searchParams.get("previously_wrong") === "true";
    const initDifficulty = (searchParams.get("difficulty") ?? "") as DifficultyLevel | "";

    const blankFilters = (): Filters => ({
        difficulty: initDifficulty,
        discipline: initDiscipline,
        topic: "",
        historyFilter: initNotAnsw ? "not_answered" : initPrevWrong ? "previously_wrong" : "",
        page: 1,
    });

    const [filters, setFilters] = useState<Filters>(blankFilters);
    const [viewMode, setViewMode] = useState<ViewMode>("block");
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
    const [startTime, setStartTime] = useState<number>(Date.now());
    const [showFilters, setShowFilters] = useState(false);
    const [showTip, setShowTip] = useState(false);
    const [listAnswers, setListAnswers] = useState<Record<string, AnswerResult>>({});
    const [listTips, setListTips] = useState<Record<string, boolean>>({});

    const { data: disciplinesData } = useQuery({
        queryKey: ["questions", "disciplines"],
        queryFn: () => apiClient.get("/questions/disciplines").then(r => r.data.disciplines as string[]),
        staleTime: 5 * 60 * 1000,
    });

    const { data: topicsData } = useQuery({
        queryKey: ["questions", "topics", filters.discipline],
        queryFn: () =>
            apiClient.get("/questions/topics", { params: { discipline: filters.discipline } })
                .then(r => r.data.topics as string[]),
        enabled: !!filters.discipline,
        staleTime: 5 * 60 * 1000,
    });

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ["questions", filters],
        queryFn: () => questionsApi.list({
            difficulty: filters.difficulty || undefined,
            discipline: filters.discipline || undefined,
            topic: filters.topic || undefined,
            not_answered: filters.historyFilter === "not_answered" ? true : undefined,
            previously_wrong: filters.historyFilter === "previously_wrong" ? true : undefined,
            previously_correct: filters.historyFilter === "previously_correct" ? true : undefined,
            page: filters.page,
            per_page: PER_PAGE,
        }),
        placeholderData: prev => prev,
    });

    const questions = (data?.questions ?? []) as QuestionWithTip[];
    const pagination = data?.pagination;
    const currentQuestion = questions[currentIndex] as QuestionWithTip | undefined;

    useEffect(() => {
        setCurrentIndex(0);
        setAnswerResult(null);
        setStartTime(Date.now());
        setShowTip(false);
        setListAnswers({});
        setListTips({});
    }, [filters]);

    useEffect(() => {
        setAnswerResult(null);
        setShowTip(false);
        setStartTime(Date.now());
    }, [currentIndex]);

    const answerMutation = useMutation({
        mutationFn: ({ questionId, key }: { questionId: string; key: string }) =>
            questionsApi.answer(questionId, {
                chosen_alternative_key: key,
                response_time_seconds: Math.round((Date.now() - startTime) / 1000),
                context: "practice",
            }),
        onSuccess: (result) => setAnswerResult(result),
    });

    const listAnswerMutation = useMutation({
        mutationFn: ({ questionId, key }: { questionId: string; key: string }) =>
            questionsApi.answer(questionId, {
                chosen_alternative_key: key,
                response_time_seconds: undefined,
                context: "practice",
            }),
        onSuccess: (result, { questionId }) => {
            setListAnswers(prev => ({ ...prev, [questionId]: result }));
        },
    });

    const handleSelectAnswer = (key: string) => {
        if (answerResult || answerMutation.isPending || !currentQuestion) return;
        answerMutation.mutate({ questionId: currentQuestion.id, key });
    };

    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(i => i + 1);
        } else if (pagination?.has_next) {
            setFilters(f => ({ ...f, page: f.page + 1 }));
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) setCurrentIndex(i => i - 1);
    };

    const totalPages = pagination?.pages ?? 1;
    const globalPosition = (filters.page - 1) * PER_PAGE + currentIndex + 1;
    const totalQuestions = pagination ? pagination.total : 0;

    const activeFilterCount = [filters.difficulty, filters.discipline, filters.topic, filters.historyFilter]
        .filter(Boolean).length;

    // Conteúdo interno da sidebar (reutilizado em desktop inline e mobile drawer)
    const sidebarContent = (
        <div className="space-y-4 pt-1">

            <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Disciplina</p>
                <div className="relative">
                    <select
                        value={filters.discipline}
                        onChange={e => setFilters(f => ({ ...f, discipline: e.target.value, topic: "", page: 1 }))}
                        className="w-full h-9 px-3 pr-8 rounded-lg border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <option value="">Todas</option>
                        {(disciplinesData ?? []).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
            </div>

            {filters.discipline && (
                <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tópico</p>
                    <div className="relative">
                        <select
                            value={filters.topic}
                            onChange={e => setFilters(f => ({ ...f, topic: e.target.value, page: 1 }))}
                            className="w-full h-9 px-3 pr-8 rounded-lg border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">Todos</option>
                            {(topicsData ?? []).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                </div>
            )}

            <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dificuldade</p>
                <div className="space-y-1">
                    {DIFFICULTIES.map(({ value, label, color }) => (
                        <button
                            key={value}
                            onClick={() => setFilters(f => ({ ...f, difficulty: value, page: 1 }))}
                            className={cn(
                                "w-full text-left px-3 py-1.5 rounded-lg text-sm border transition-all",
                                filters.difficulty === value
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : cn("border-transparent text-muted-foreground hover:text-foreground hover:bg-muted", color)
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Histórico</p>
                <div className="space-y-1">
                    {HISTORY_FILTERS.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setFilters(f => ({ ...f, historyFilter: key, page: 1 }))}
                            className={cn(
                                "w-full text-left px-3 py-1.5 rounded-lg text-sm border transition-all",
                                filters.historyFilter === key
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {activeFilterCount > 0 && (
                <button
                    onClick={() => setFilters(blankFilters())}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    <RotateCcw className="h-3 w-3" /> Limpar filtros
                </button>
            )}
        </div>
    );

    return (
        <div className="flex gap-6 animate-fade-in">

            {/* ── Backdrop mobile (cobre o conteúdo quando filtros abertos) ── */}
            {showFilters && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 sm:hidden"
                    onClick={() => setShowFilters(false)}
                />
            )}

            {/* ── Sidebar filtros ──
                Mobile  : drawer fixo deslizando da esquerda (z-40, largura 280px)
                Desktop : coluna inline que expande/colapsa com w-56
            ── */}
            <aside className={cn(
                "shrink-0 transition-all duration-300",
                // Mobile: fixed drawer
                "fixed top-0 left-0 h-full z-40 bg-background overflow-y-auto p-5 shadow-2xl",
                // Desktop: inline, sem p e shadow
                "sm:static sm:h-auto sm:z-auto sm:bg-transparent sm:overflow-visible sm:p-0 sm:shadow-none sm:space-y-4",
                showFilters
                    ? "w-72 sm:w-56"
                    : "w-0 overflow-hidden opacity-0 pointer-events-none"
            )}>
                {/* Botão fechar — apenas mobile */}
                <div className="flex items-center justify-between mb-4 sm:hidden">
                    <span className="text-sm font-semibold text-foreground">Filtros</span>
                    <button
                        onClick={() => setShowFilters(false)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    >
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>

                {sidebarContent}
            </aside>

            {/* ── Conteúdo principal ── */}
            <div data-onboarding="questions" className="flex-1 min-w-0 space-y-4">

                {/* Header — flex-wrap evita overflow no mobile */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h1 className="font-display text-2xl font-bold text-foreground">Questões</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {isLoading ? "Carregando..." : totalQuestions > 0
                                ? `${totalQuestions.toLocaleString("pt-BR")} questões disponíveis`
                                : "Pratique com filtros inteligentes"}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Toggle Bloco / Lista — texto oculto em telas pequenas */}
                        <div className="flex items-center border border-border rounded-lg p-0.5 gap-0.5">
                            <button
                                onClick={() => setViewMode("block")}
                                title="Modo bloco"
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                                    viewMode === "block"
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <LayoutGrid className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Bloco</span>
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                title="Modo lista"
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                                    viewMode === "list"
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <LayoutList className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Lista</span>
                            </button>
                        </div>

                        {/* Botão filtros — texto oculto em telas pequenas */}
                        <Button
                            variant={showFilters ? "default" : "outline"}
                            size="sm"
                            onClick={() => setShowFilters(v => !v)}
                        >
                            <Filter className="h-4 w-4" />
                            <span className="hidden sm:inline">Filtros</span>
                            {activeFilterCount > 0 && (
                                <span className="ml-1 h-4 w-4 rounded-full bg-primary-foreground text-primary text-[10px] flex items-center justify-center font-bold">
                                    {activeFilterCount}
                                </span>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Chips filtros ativos */}
                {(filters.discipline || filters.topic || filters.difficulty || filters.historyFilter) && (
                    <div className="flex flex-wrap gap-2">
                        {filters.discipline && (
                            <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">
                                <Layers className="h-3 w-3" />{filters.discipline}
                            </span>
                        )}
                        {filters.topic && (
                            <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">
                                <Target className="h-3 w-3" />{filters.topic}
                            </span>
                        )}
                        {filters.difficulty && (
                            <span className={cn("inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border", DIFFICULTY_CONFIG[filters.difficulty]?.className)}>
                                <TrendingUp className="h-3 w-3" />
                                {DIFFICULTY_CONFIG[filters.difficulty]?.label}
                            </span>
                        )}
                        {filters.historyFilter && (
                            <span className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full border border-border">
                                {HISTORY_FILTERS.find(h => h.key === filters.historyFilter)?.label}
                            </span>
                        )}
                    </div>
                )}

                {/* Conteúdo */}
                {isLoading ? (
                    <QuestionSkeleton />
                ) : questions.length === 0 ? (
                    <EmptyQuestions onReset={() => setFilters(blankFilters())} />
                ) : viewMode === "block" ? (
                    <>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                    className={cn("h-full rounded-full transition-all duration-300", isFetching ? "bg-muted-foreground" : "bg-primary")}
                                    style={{ width: totalQuestions > 0 ? `${(globalPosition / totalQuestions) * 100}%` : "0%" }}
                                />
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0 font-mono">
                                {globalPosition.toLocaleString("pt-BR")}/{totalQuestions.toLocaleString("pt-BR")}
                            </span>
                        </div>

                        {currentQuestion && (
                            <QuestionCard
                                question={currentQuestion}
                                result={answerResult}
                                onSelect={handleSelectAnswer}
                                isLoading={answerMutation.isPending}
                                onShowTip={() => setShowTip(v => !v)}
                                tipVisible={showTip}
                            />
                        )}

                        {answerResult && currentQuestion && (
                            <FeedbackCard
                                result={answerResult}
                                question={currentQuestion}
                                onNext={handleNext}
                                hasNext={currentIndex < questions.length - 1 || !!pagination?.has_next}
                            />
                        )}

                        {!answerResult && (
                            <div className="flex items-center justify-between">
                                <Button variant="ghost" size="sm" onClick={handlePrev} disabled={currentIndex === 0 && filters.page === 1}>
                                    <ChevronLeft className="h-4 w-4" /> Anterior
                                </Button>
                                {totalPages > 1 && (
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                            const p = i + 1;
                                            return (
                                                <button key={p} onClick={() => setFilters(f => ({ ...f, page: p }))}
                                                    className={cn("h-7 w-7 rounded text-xs font-mono transition-all",
                                                        filters.page === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                                                    )}>
                                                    {p}
                                                </button>
                                            );
                                        })}
                                        {totalPages > 5 && <span className="text-xs text-muted-foreground px-1">... {totalPages}</span>}
                                    </div>
                                )}
                                <Button variant="ghost" size="sm" onClick={handleNext} disabled={currentIndex === questions.length - 1 && !pagination?.has_next}>
                                    Pular <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="space-y-4">
                            {questions.map((q, idx) => (
                                <ListQuestionCard
                                    key={q.id}
                                    question={q}
                                    index={(filters.page - 1) * PER_PAGE + idx + 1}
                                    result={listAnswers[q.id] ?? null}
                                    isLoading={listAnswerMutation.isPending && listAnswerMutation.variables?.questionId === q.id}
                                    onSelect={(key) => {
                                        if (listAnswers[q.id] || listAnswerMutation.isPending) return;
                                        listAnswerMutation.mutate({ questionId: q.id, key });
                                    }}
                                    tipVisible={listTips[q.id] ?? false}
                                    onShowTip={() => setListTips(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                                />
                            ))}
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-2">
                                <Button variant="outline" size="sm" onClick={() => setFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))} disabled={filters.page === 1}>
                                    <ChevronLeft className="h-4 w-4" /> Anterior
                                </Button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                        const p = i + 1;
                                        return (
                                            <button key={p} onClick={() => setFilters(f => ({ ...f, page: p }))}
                                                className={cn("h-8 w-8 rounded-lg text-xs font-mono transition-all",
                                                    filters.page === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                                                )}>
                                                {p}
                                            </button>
                                        );
                                    })}
                                    {totalPages > 7 && <span className="text-xs text-muted-foreground px-1">... {totalPages}</span>}
                                </div>
                                <Button variant="outline" size="sm" onClick={() => setFilters(f => ({ ...f, page: Math.min(totalPages, f.page + 1) }))} disabled={filters.page === totalPages}>
                                    Próxima <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ── Page export com Suspense (obrigatório para useSearchParams no App Router) ─

export default function QuestionsPage() {
    return (
        <Suspense>
            <QuestionsContent />
        </Suspense>
    );
}

// ── QuestionCard (bloco) ──────────────────────────────────────────────────────

function QuestionCard({ question, result, onSelect, isLoading, onShowTip, tipVisible }: {
    question: QuestionWithTip;
    result: AnswerResult | null;
    onSelect: (key: string) => void;
    isLoading: boolean;
    onShowTip: () => void;
    tipVisible: boolean;
}) {
    const diff = question.difficulty ? DIFFICULTY_CONFIG[question.difficulty] : null;

    return (
        <Card className="animate-fade-in">
            <CardContent className="p-6 space-y-5">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        {diff && (
                            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-md border", diff.className)}>
                                {diff.label}
                            </span>
                        )}
                        {question.discipline && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-medium">
                                {question.discipline}
                            </span>
                        )}
                        {question.topic && (
                            <span className="text-xs text-muted-foreground">{question.topic}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {(question.exam_board || question.exam_year) && (
                            <span className="text-xs text-muted-foreground">
                                {[question.exam_board, question.exam_year].filter(Boolean).join(" · ")}
                            </span>
                        )}
                        {question.tip && !result && (
                            <button
                                onClick={onShowTip}
                                className={cn(
                                    "flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all",
                                    tipVisible
                                        ? "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400"
                                        : "border-border text-muted-foreground hover:border-amber-500/40 hover:text-amber-600 dark:hover:text-amber-400"
                                )}
                            >
                                <Lightbulb className="h-3 w-3" /> Dica
                            </button>
                        )}
                    </div>
                </div>

                {tipVisible && question.tip && !result && (
                    <div className="p-3 rounded-lg bg-amber-500/8 border border-amber-500/20 animate-fade-in">
                        <div className="flex items-start gap-2">
                            <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-foreground leading-relaxed">{question.tip}</p>
                        </div>
                    </div>
                )}

                {question.context && (
                    <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground leading-relaxed border-l-4 border-primary/30 whitespace-pre-wrap">
                        {question.context}
                    </div>
                )}

                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {question.statement}
                </p>

                <div className="space-y-2">
                    {question.alternatives.map((alt) => {
                        const altKey = alt.key.toUpperCase();
                        const chosenKey = result?.chosen_key?.toUpperCase();
                        const correctKey = result?.correct_key?.toUpperCase();
                        const isChosen = chosenKey === altKey;
                        const isCorrect = correctKey === altKey;
                        const showResult = !!result;

                        return (
                            <button key={alt.key} onClick={() => onSelect(alt.key)} disabled={showResult || isLoading}
                                className={cn(
                                    "w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-200",
                                    !showResult && "hover:border-primary hover:bg-primary/5 active:scale-[0.99]",
                                    showResult && isCorrect && "border-success bg-success/5",
                                    showResult && isChosen && !isCorrect && "border-destructive bg-destructive/5",
                                    !showResult && "border-border bg-background",
                                    isLoading && "opacity-60 cursor-wait"
                                )}
                            >
                                <span className={cn(
                                    "h-6 w-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                                    !showResult && "bg-muted text-muted-foreground",
                                    showResult && isCorrect && "bg-success text-success-foreground",
                                    showResult && isChosen && !isCorrect && "bg-destructive text-destructive-foreground",
                                    showResult && !isChosen && !isCorrect && "bg-muted text-muted-foreground opacity-50"
                                )}>
                                    {alt.key.toUpperCase()}
                                </span>
                                <span className={cn(
                                    "text-sm leading-relaxed flex-1",
                                    showResult && isCorrect && "text-success font-medium",
                                    showResult && isChosen && !isCorrect && "text-destructive",
                                    showResult && !isChosen && !isCorrect && "text-muted-foreground"
                                )}>
                                    {alt.text}
                                </span>
                                {showResult && isCorrect && <CheckCircle2 className="h-4 w-4 text-success shrink-0 ml-auto mt-0.5" />}
                                {showResult && isChosen && !isCorrect && <XCircle className="h-4 w-4 text-destructive shrink-0 ml-auto mt-0.5" />}
                            </button>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

// ── ListQuestionCard (lista) ──────────────────────────────────────────────────

function ListQuestionCard({ question, index, result, onSelect, isLoading, tipVisible, onShowTip }: {
    question: QuestionWithTip;
    index: number;
    result: AnswerResult | null;
    onSelect: (key: string) => void;
    isLoading: boolean;
    tipVisible: boolean;
    onShowTip: () => void;
}) {
    const diff = question.difficulty ? DIFFICULTY_CONFIG[question.difficulty] : null;

    const chosenAlt = result?.alternatives.find(a => a.key.toUpperCase() === result.chosen_key?.toUpperCase());
    const correctAlt = result?.alternatives.find(a => a.is_correct);
    const distractorJ = result && !result.is_correct ? chosenAlt?.justification : null;
    const correctJ = correctAlt?.justification ?? question.correct_justification;

    return (
        <Card className={cn(
            "transition-all",
            result && (result.is_correct ? "border-l-4 border-l-success" : "border-l-4 border-l-destructive")
        )}>
            <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground font-semibold">#{index}</span>
                        {diff && (
                            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-md border", diff.className)}>
                                {diff.label}
                            </span>
                        )}
                        {question.discipline && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-medium">
                                {question.discipline}
                            </span>
                        )}
                        {question.topic && (
                            <span className="text-xs text-muted-foreground">{question.topic}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {result && (
                            result.is_correct
                                ? <span className="flex items-center gap-1 text-xs text-success font-medium"><CheckCircle2 className="h-3.5 w-3.5" />Correto</span>
                                : <span className="flex items-center gap-1 text-xs text-destructive font-medium"><XCircle className="h-3.5 w-3.5" />Incorreto</span>
                        )}
                        {question.tip && !result && (
                            <button
                                onClick={onShowTip}
                                className={cn(
                                    "flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all",
                                    tipVisible
                                        ? "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400"
                                        : "border-border text-muted-foreground hover:border-amber-500/40 hover:text-amber-600"
                                )}
                            >
                                <Lightbulb className="h-3 w-3" /> Dica
                            </button>
                        )}
                    </div>
                </div>

                {tipVisible && question.tip && !result && (
                    <div className="p-3 rounded-lg bg-amber-500/8 border border-amber-500/20">
                        <div className="flex items-start gap-2">
                            <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-foreground leading-relaxed">{question.tip}</p>
                        </div>
                    </div>
                )}

                {question.context && (
                    <div className="p-3 rounded-lg bg-muted text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/30 whitespace-pre-wrap">
                        {question.context}
                    </div>
                )}

                <p className="text-sm text-foreground leading-relaxed">{question.statement}</p>

                <div className="space-y-1.5">
                    {question.alternatives.map((alt) => {
                        const altKey = alt.key.toUpperCase();
                        const chosenKey = result?.chosen_key?.toUpperCase();
                        const correctKey = result?.correct_key?.toUpperCase();
                        const isChosen = chosenKey === altKey;
                        const isCorrect = correctKey === altKey;
                        const showResult = !!result;

                        return (
                            <button key={alt.key} onClick={() => onSelect(alt.key)} disabled={showResult || isLoading}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all",
                                    !showResult && "hover:border-primary hover:bg-primary/5",
                                    showResult && isCorrect && "border-success/40 bg-success/5",
                                    showResult && isChosen && !isCorrect && "border-destructive/40 bg-destructive/5",
                                    !showResult && "border-border bg-background",
                                    isLoading && "opacity-60 cursor-wait"
                                )}
                            >
                                <span className={cn(
                                    "h-5 w-5 rounded flex items-center justify-center text-[11px] font-bold shrink-0",
                                    !showResult && "bg-muted text-muted-foreground",
                                    showResult && isCorrect && "bg-success text-success-foreground",
                                    showResult && isChosen && !isCorrect && "bg-destructive text-destructive-foreground",
                                    showResult && !isChosen && !isCorrect && "bg-muted text-muted-foreground opacity-40"
                                )}>
                                    {alt.key.toUpperCase()}
                                </span>
                                <span className={cn(
                                    "text-sm flex-1",
                                    showResult && isCorrect && "text-success font-medium",
                                    showResult && isChosen && !isCorrect && "text-destructive",
                                    showResult && !isChosen && !isCorrect && "text-muted-foreground"
                                )}>
                                    {alt.text}
                                </span>
                                {showResult && isCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />}
                                {showResult && isChosen && !isCorrect && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                            </button>
                        );
                    })}
                </div>

                {result && (
                    <div className="space-y-2 pt-1 border-t border-border">
                        {!result.is_correct && distractorJ && (
                            <div className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
                                <p className="text-xs font-semibold text-destructive mb-1">
                                    Por que ({result.chosen_key?.toUpperCase()}) está errada:
                                </p>
                                <p className="text-xs text-foreground leading-relaxed">{distractorJ}</p>
                            </div>
                        )}
                        {correctJ && (
                            <div className="p-2.5 rounded-lg bg-success/5 border border-success/20">
                                <p className="text-xs font-semibold text-success mb-1">
                                    Por que ({result.correct_key?.toUpperCase()}) está correta:
                                </p>
                                <p className="text-xs text-foreground leading-relaxed">{correctJ}</p>
                            </div>
                        )}
                        {question.tip && (
                            <div className="p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20">
                                <div className="flex items-start gap-1.5">
                                    <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-foreground leading-relaxed">{question.tip}</p>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono bg-muted px-1.5 py-0.5 rounded">+{result.xp_gained} XP</span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ── FeedbackCard (bloco) ──────────────────────────────────────────────────────

function FeedbackCard({ result, question, onNext, hasNext }: {
    result: AnswerResult;
    question: QuestionWithTip;
    onNext: () => void;
    hasNext: boolean;
}) {
    const isCorrect = result.is_correct;
    const chosenAlt = result.alternatives.find(a => a.key.toUpperCase() === result.chosen_key?.toUpperCase());
    const correctAlt = result.alternatives.find(a => a.is_correct);
    const distractorJ = !isCorrect ? chosenAlt?.justification : null;
    const correctJ = correctAlt?.justification ?? question.correct_justification;

    return (
        <Card className={cn("border-l-4 animate-fade-in", isCorrect ? "border-l-success" : "border-l-destructive")}>
            <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {isCorrect
                            ? <><CheckCircle2 className="h-5 w-5 text-success" /><span className="font-semibold text-success">Correto!</span></>
                            : <><XCircle className="h-5 w-5 text-destructive" /><span className="font-semibold text-destructive">Incorreto</span></>
                        }
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-mono">
                        +{result.xp_gained} XP
                    </span>
                </div>

                {!isCorrect && distractorJ && (
                    <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                        <p className="text-xs font-semibold text-destructive mb-1">
                            Por que ({result.chosen_key?.toUpperCase()}) está errada:
                        </p>
                        <p className="text-xs text-foreground leading-relaxed">{distractorJ}</p>
                    </div>
                )}

                {correctJ && (
                    <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                        <p className="text-xs font-semibold text-success mb-1">
                            Por que ({result.correct_key?.toUpperCase()}) está correta:
                        </p>
                        <p className="text-xs text-foreground leading-relaxed">{correctJ}</p>
                    </div>
                )}

                {question.tip && (
                    <div className="p-3 rounded-lg bg-amber-500/8 border border-amber-500/20">
                        <div className="flex items-start gap-2">
                            <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">Dica para fixar</p>
                                <p className="text-xs text-foreground leading-relaxed">{question.tip}</p>
                            </div>
                        </div>
                    </div>
                )}

                {hasNext && (
                    <Button className="w-full" onClick={onNext}>
                        Próxima questão <ChevronRight className="h-4 w-4" />
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

// ── Skeleton & Empty ──────────────────────────────────────────────────────────

function QuestionSkeleton() {
    return (
        <Card className="animate-pulse">
            <CardContent className="p-6 space-y-4">
                <div className="flex gap-2">
                    <div className="h-5 w-16 bg-muted rounded-md" />
                    <div className="h-5 w-32 bg-muted rounded-md" />
                </div>
                <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-4 bg-muted rounded w-5/6" />
                    <div className="h-4 bg-muted rounded w-4/6" />
                </div>
                <div className="space-y-2 pt-2">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted rounded-xl" />)}
                </div>
            </CardContent>
        </Card>
    );
}

function EmptyQuestions({ onReset }: { onReset: () => void }) {
    return (
        <Card>
            <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                    <p className="font-semibold text-foreground">Nenhuma questão encontrada</p>
                    <p className="text-sm text-muted-foreground mt-1">Tente ajustar os filtros ou explore outras disciplinas.</p>
                </div>
                <Button variant="outline" onClick={onReset}>
                    <RotateCcw className="h-4 w-4" /> Limpar filtros
                </Button>
            </CardContent>
        </Card>
    );
}