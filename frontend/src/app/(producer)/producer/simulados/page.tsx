// frontend/src/app/(producer)/producer/simulados/page.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { useForm } from "react-hook-form";
import { useCourses } from "@/lib/hooks/useCourses";
import { cn } from "@/lib/utils/cn";
import {
    ClipboardList, Clock, HelpCircle, Sparkles,
    Plus, Trash2, ChevronDown, AlertCircle, Users, Shuffle,
} from "lucide-react";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";
import type { Simulado } from "@/types/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DisciplineBlock {
    discipline: string;
    topic: string;
    count: number;
}

type DisciplinesMode = "all" | "custom";
type QuestionFilter = "all" | "not_answered" | "previously_correct" | "previously_wrong";

interface CreateFormData {
    title: string;
    course_id: string;
    time_limit_minutes: number;
    difficulty: string;
}

const QUESTION_FILTER_OPTIONS: { value: QuestionFilter; label: string; description: string }[] = [
    {
        value: "all",
        label: "Todas",
        description: "Questões aleatórias do pool configurado",
    },
    {
        value: "not_answered",
        label: "Não respondidas",
        description: "Questões que o aluno ainda não respondeu",
    },
    {
        value: "previously_wrong",
        label: "Erradas antes",
        description: "Questões que o aluno errou (fallback: aleatórias)",
    },
    {
        value: "previously_correct",
        label: "Acertadas antes",
        description: "Revisão — questões que o aluno já acertou",
    },
];

// ── Data hooks ────────────────────────────────────────────────────────────────

function useDisciplines() {
    return useQuery({
        queryKey: ["questions", "disciplines"],
        queryFn: () =>
            apiClient.get("/questions/disciplines").then(r => r.data.disciplines as string[]),
        staleTime: 5 * 60 * 1000,
    });
}

function useTopics(discipline: string) {
    return useQuery({
        queryKey: ["questions", "topics", discipline],
        queryFn: () =>
            apiClient.get("/questions/topics", { params: { discipline } })
                .then(r => r.data.topics as string[]),
        enabled: !!discipline,
        staleTime: 5 * 60 * 1000,
    });
}

// ── DisciplineRow ─────────────────────────────────────────────────────────────

function DisciplineRow({
    block, index, onUpdate, onRemove, canRemove,
}: {
    block: DisciplineBlock;
    index: number;
    onUpdate: (i: number, u: Partial<DisciplineBlock>) => void;
    onRemove: (i: number) => void;
    canRemove: boolean;
}) {
    const { data: disciplines } = useDisciplines();
    const { data: topics } = useTopics(block.discipline);

    return (
        <div className="grid grid-cols-[1fr_1fr_72px_32px] gap-2 items-center">
            <div className="relative">
                <select
                    value={block.discipline}
                    onChange={e => onUpdate(index, { discipline: e.target.value, topic: "" })}
                    className="w-full h-9 px-3 pr-8 rounded-lg border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <option value="">Disciplina</option>
                    {(disciplines ?? []).map(d => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                </select>
                <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>

            <div className="relative">
                <select
                    value={block.topic}
                    onChange={e => onUpdate(index, { topic: e.target.value })}
                    disabled={!block.discipline || !topics?.length}
                    className="w-full h-9 px-3 pr-8 rounded-lg border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40"
                >
                    <option value="">Todos os tópicos</option>
                    {(topics ?? []).map(t => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>
                <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>

            <Input
                type="number"
                min={1}
                max={50}
                value={block.count}
                onChange={e => onUpdate(index, { count: Math.max(1, Math.min(50, Number(e.target.value))) })}
                className="h-9 text-center px-2"
            />

            <button
                type="button"
                onClick={() => onRemove(index)}
                disabled={!canRemove}
                className="h-9 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <Trash2 className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

// ── Modal de criação ──────────────────────────────────────────────────────────

function CreateSimuladoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const toast = useToast();
    const queryClient = useQueryClient();
    const { data: courses } = useCourses();

    const [disciplinesMode, setDisciplinesMode] = useState<DisciplinesMode>("all");
    const [allCount, setAllCount] = useState(20);
    const [blocks, setBlocks] = useState<DisciplineBlock[]>([{ discipline: "", topic: "", count: 10 }]);
    const [questionFilter, setQuestionFilter] = useState<QuestionFilter>("all");

    const { register, handleSubmit, reset, watch } = useForm<CreateFormData>({
        defaultValues: { title: "", course_id: "", time_limit_minutes: 60, difficulty: "" },
    });

    const createMutation = useMutation({
        mutationFn: (payload: object) =>
            apiClient.post("/simulados/auto-generate", payload).then(r => r.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SIMULADOS() });
            toast.success("Simulado criado com sucesso!");
            handleClose();
        },
        onError: () =>
            toast.error("Erro ao criar simulado", "Verifique se há questões disponíveis."),
    });

    function handleClose() {
        onClose();
        reset();
        setDisciplinesMode("all");
        setAllCount(20);
        setBlocks([{ discipline: "", topic: "", count: 10 }]);
        setQuestionFilter("all");
    }

    const addBlock = () => setBlocks(p => [...p, { discipline: "", topic: "", count: 10 }]);
    const updateBlock = (i: number, u: Partial<DisciplineBlock>) =>
        setBlocks(p => p.map((b, idx) => idx === i ? { ...b, ...u } : b));
    const removeBlock = (i: number) => setBlocks(p => p.filter((_, idx) => idx !== i));

    const totalQuestions = disciplinesMode === "all"
        ? allCount
        : blocks.reduce((s, b) => s + b.count, 0);

    const isPersonalized = questionFilter !== "all";

    function onSubmit(data: CreateFormData) {
        const payload: Record<string, unknown> = {
            title: data.title,
            course_id: data.course_id,
            time_limit_minutes: Number(data.time_limit_minutes),
            question_filter: questionFilter,
        };

        if (data.difficulty) payload.difficulty = data.difficulty;

        if (disciplinesMode === "all") {
            payload.disciplines = "all";
            payload.total_questions = allCount;
        } else {
            const valid = blocks.filter(b => b.discipline);
            if (!valid.length) {
                toast.error("Selecione ao menos uma disciplina");
                return;
            }
            payload.disciplines = valid.map(b => ({
                discipline: b.discipline,
                topic: b.topic || undefined,
                count: b.count,
            }));
            payload.total_questions = totalQuestions;
        }

        createMutation.mutate(payload);
    }

    const difficulty = watch("difficulty");

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Criar simulado
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    {/* Básico */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-sm font-medium">Título <span className="text-destructive">*</span></label>
                            <Input {...register("title", { required: true })} placeholder="Ex: Simulado Geral — Maio 2025" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Curso <span className="text-destructive">*</span></label>
                            <div className="relative">
                                <select
                                    {...register("course_id", { required: true })}
                                    className="w-full h-10 px-3 pr-8 rounded-lg border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="">Selecione...</option>
                                    {(courses || []).map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Tempo (min)</label>
                            <Input {...register("time_limit_minutes", { valueAsNumber: true })} type="number" min={10} max={480} />
                        </div>
                    </div>

                    {/* Dificuldade */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Dificuldade
                            <span className="text-xs text-muted-foreground font-normal ml-1">(opcional)</span>
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {[
                                { value: "", label: "Todas" },
                                { value: "easy", label: "Fácil", cls: "data-[active=true]:bg-success data-[active=true]:text-success-foreground data-[active=true]:border-success" },
                                { value: "medium", label: "Médio", cls: "data-[active=true]:bg-warning data-[active=true]:text-warning-foreground data-[active=true]:border-warning" },
                                { value: "hard", label: "Difícil", cls: "data-[active=true]:bg-destructive data-[active=true]:text-destructive-foreground data-[active=true]:border-destructive" },
                            ].map(opt => (
                                <label key={opt.value} className={cn(
                                    "px-3 py-1.5 rounded-lg text-sm border cursor-pointer transition-all",
                                    difficulty === opt.value
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "border-border text-muted-foreground hover:bg-muted"
                                )}>
                                    <input type="radio" value={opt.value} {...register("difficulty")} className="sr-only" />
                                    {opt.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Filtro de histórico */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <label className="text-sm font-medium">Filtro por histórico do aluno</label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {QUESTION_FILTER_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setQuestionFilter(opt.value)}
                                    className={cn(
                                        "p-3 rounded-lg border text-left transition-all",
                                        questionFilter === opt.value
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:bg-muted/50"
                                    )}
                                >
                                    <p className={cn(
                                        "text-sm font-medium",
                                        questionFilter === opt.value ? "text-primary" : "text-foreground"
                                    )}>
                                        {opt.label}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                                </button>
                            ))}
                        </div>
                        {isPersonalized && (
                            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                                <Shuffle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                <p className="text-xs text-muted-foreground">
                                    Cada aluno receberá questões diferentes baseadas no seu histórico individual.
                                    Se não houver histórico suficiente, questões aleatórias serão usadas como complemento.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Disciplinas */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">Disciplinas</label>
                        </div>

                        {/* Toggle all / custom */}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setDisciplinesMode("all")}
                                className={cn(
                                    "flex-1 py-2 rounded-lg text-sm font-medium border transition-all",
                                    disciplinesMode === "all"
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "border-border text-muted-foreground hover:bg-muted"
                                )}
                            >
                                Todas as disciplinas
                            </button>
                            <button
                                type="button"
                                onClick={() => setDisciplinesMode("custom")}
                                className={cn(
                                    "flex-1 py-2 rounded-lg text-sm font-medium border transition-all",
                                    disciplinesMode === "custom"
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "border-border text-muted-foreground hover:bg-muted"
                                )}
                            >
                                Escolher disciplinas
                            </button>
                        </div>

                        {/* Modo: todas */}
                        {disciplinesMode === "all" && (
                            <div className="flex items-center gap-3">
                                <label className="text-sm text-muted-foreground shrink-0">
                                    Total de questões:
                                </label>
                                <Input
                                    type="number"
                                    min={5}
                                    max={100}
                                    value={allCount}
                                    onChange={e => setAllCount(Math.max(5, Math.min(100, Number(e.target.value))))}
                                    className="w-24 h-9 text-center"
                                />
                                <span className="text-xs text-muted-foreground">questões aleatórias de todo o banco</span>
                            </div>
                        )}

                        {/* Modo: custom */}
                        {disciplinesMode === "custom" && (
                            <>
                                <div className="grid grid-cols-[1fr_1fr_72px_32px] gap-2 text-xs text-muted-foreground font-medium px-0.5">
                                    <span>Disciplina</span>
                                    <span>Tópico</span>
                                    <span className="text-center">Qtd.</span>
                                    <span />
                                </div>
                                <div className="space-y-2">
                                    {blocks.map((block, i) => (
                                        <DisciplineRow
                                            key={i}
                                            block={block}
                                            index={i}
                                            onUpdate={updateBlock}
                                            onRemove={removeBlock}
                                            canRemove={blocks.length > 1}
                                        />
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={addBlock}
                                    disabled={blocks.length >= 10}
                                    className="flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Plus className="h-3 w-3" /> Adicionar disciplina
                                </button>
                            </>
                        )}

                        {/* Total */}
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground" />
                            <span className={cn(
                                "font-mono font-semibold px-2 py-0.5 rounded",
                                totalQuestions > 100
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-muted text-foreground"
                            )}>
                                Total: {totalQuestions} questões
                            </span>
                        </div>

                        {totalQuestions > 100 && (
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                                <p className="text-xs text-destructive">Limite máximo de 100 questões.</p>
                            </div>
                        )}
                    </div>

                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-xs text-muted-foreground">
                        💡 A IA priorizará questões com menor taxa de acerto da turma em cada disciplina.
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={handleClose}>Cancelar</Button>
                        <Button
                            type="submit"
                            loading={createMutation.isPending}
                            disabled={totalQuestions > 100 || totalQuestions === 0}
                        >
                            <Sparkles className="h-4 w-4" />
                            Criar simulado
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function ProducerSimuladosPage() {
    const [showCreate, setShowCreate] = useState(false);
    const { data, isLoading } = useQuery({
        queryKey: QUERY_KEYS.SIMULADOS(),
        queryFn: async () => {
            const res = await apiClient.get<{ simulados: Simulado[] }>("/simulados/");
            return res.data.simulados;
        },
    });

    const simulados = data || [];

    const FILTER_LABEL: Record<string, string> = {
        all: "",
        not_answered: "Não respondidas",
        previously_correct: "Acertadas antes",
        previously_wrong: "Erradas antes",
    };

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">Simulados</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {simulados.length} simulado(s) criado(s)
                    </p>
                </div>
                <Button onClick={() => setShowCreate(true)}>
                    <Sparkles className="h-4 w-4" /> Criar simulado
                </Button>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
            ) : simulados.length === 0 ? (
                <Card>
                    <CardContent className="py-16 flex flex-col items-center gap-4">
                        <ClipboardList className="h-12 w-12 text-muted-foreground" />
                        <div className="text-center">
                            <p className="font-semibold text-foreground">Nenhum simulado ainda</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Crie um simulado para seus alunos praticarem.
                            </p>
                        </div>
                        <Button onClick={() => setShowCreate(true)}>
                            <Plus className="h-4 w-4" /> Criar primeiro simulado
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {simulados.map((sim: Simulado) => {
                        const filterKey = (sim.settings as any)?.question_filter || "all";
                        const filterLabel = FILTER_LABEL[filterKey];
                        return (
                            <Card key={sim.id} className="hover:shadow-sm transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <ClipboardList className="h-6 w-6 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-semibold text-foreground truncate">{sim.title}</p>
                                                <Badge variant={sim.is_active ? "success" : "outline"}>
                                                    {sim.is_active ? "Ativo" : "Inativo"}
                                                </Badge>
                                                {sim.is_ai_generated && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        <Sparkles className="h-2.5 w-2.5 mr-1" /> IA
                                                    </Badge>
                                                )}
                                                {filterLabel && (
                                                    <Badge variant="outline" className="text-xs gap-1">
                                                        <Users className="h-2.5 w-2.5" />
                                                        {filterLabel}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <HelpCircle className="h-3 w-3" />
                                                    {sim.total_questions} questões
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {sim.time_limit_minutes}min
                                                </span>
                                                <span>
                                                    Aprovação: {Math.round((sim.settings?.passing_score || 0.6) * 100)}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <CreateSimuladoModal open={showCreate} onClose={() => setShowCreate(false)} />
        </div>
    );
}