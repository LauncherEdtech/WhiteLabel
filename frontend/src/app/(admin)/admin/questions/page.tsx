// frontend/src/app/(admin)/admin/questions/page.tsx
"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils/cn";
import {
    BookOpen, Upload, Clock, CheckCircle2, XCircle, AlertCircle,
    ChevronDown, ChevronUp, Search, Filter, FileJson,
    BarChart3, Building2, Loader2, Plus,
} from "lucide-react";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BankStats {
    total_questions: number;
    by_status: Record<string, number>;
    by_discipline: Record<string, number>;
    by_difficulty: Record<string, number>;
    top_submitters: { tenant_id: string; tenant_name: string; total: number }[];
}

interface PendingQuestion {
    id: string;
    statement: string;
    discipline: string;
    topic: string | null;
    difficulty: "easy" | "medium" | "hard";
    question_type: string | null;
    review_status: "pending" | "approved" | "rejected";
    rejection_reason: string | null;
    reviewed_at: string | null;
    submitted_by_tenant: { id: string; name: string; slug: string } | null;
    alternatives: { key: string; text: string }[];
    created_at: string;
}

interface ImportResult {
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
    skip_details: { external_id: string; reason: string; existing_id?: string }[];
    error_details: { external_id: string; error: string }[];
}

const DIFFICULTY_LABEL: Record<string, string> = {
    easy: "Fácil", medium: "Médio", hard: "Difícil",
};
const DIFFICULTY_VARIANT: Record<string, string> = {
    easy: "bg-success/10 text-success border-success/20",
    medium: "bg-warning/10 text-warning border-warning/20",
    hard: "bg-destructive/10 text-destructive border-destructive/20",
};

// ── Página principal ──────────────────────────────────────────────────────────

export default function QuestionsPage() {
    const [tab, setTab] = useState<"stats" | "import" | "pending">("stats");

    const { data: stats, isLoading: statsLoading } = useQuery<BankStats>({
        queryKey: QUERY_KEYS.QUESTION_BANK_STATS,
        queryFn: () => apiClient.get("/admin/questions/stats").then(r => r.data),
    });

    const { data: pendingData, isLoading: pendingLoading } = useQuery({
        queryKey: QUERY_KEYS.QUESTION_BANK_PENDING,
        queryFn: () => apiClient.get("/admin/questions/pending?per_page=50").then(r => r.data),
        enabled: tab === "pending",
    });

    const pendingQuestions: PendingQuestion[] = pendingData?.questions ?? [];
    const pendingTotal: number = pendingData?.total ?? 0;
    const byTenant: { tenant_id: string; tenant_name: string; count: number }[] =
        pendingData?.by_tenant ?? [];

    type TabItem = {
        key: "stats" | "import" | "pending";
        label: string;
        icon: React.ElementType;
        badge?: number;
    };

    const tabs: TabItem[] = [
        { key: "stats", label: "Visão Geral", icon: BarChart3 },
        { key: "import", label: "Importar Questões", icon: Upload },
        {
            key: "pending", label: "Revisão Pendente", icon: Clock,
            badge: stats?.by_status?.pending
        },
    ];

    return (
        <div className="space-y-5 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">
                        Banco de Questões
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {stats
                            ? `${stats.total_questions.toLocaleString("pt-BR")} questões no banco global`
                            : "Banco compartilhado entre todos os infoprodutores"}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
                {tabs.map(({ key, label, icon: Icon, badge }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                            tab === key
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                        {badge != null && badge > 0 && (
                            <span className="ml-0.5 text-xs bg-warning text-warning-foreground rounded-full px-1.5 py-0.5 leading-none font-semibold">
                                {badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            {tab === "stats" && <StatsPanel stats={stats} isLoading={statsLoading} />}
            {tab === "import" && <ImportPanel />}
            {tab === "pending" && (
                <PendingPanel
                    questions={pendingQuestions}
                    total={pendingTotal}
                    byTenant={byTenant}
                    isLoading={pendingLoading}
                />
            )}
        </div>
    );
}

// ── Stats Panel ───────────────────────────────────────────────────────────────

function StatsPanel({ stats, isLoading }: { stats?: BankStats; isLoading: boolean }) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }
    if (!stats) return null;

    const statusCards = [
        { label: "Total", value: stats.total_questions, color: "text-foreground" },
        { label: "Aprovadas", value: stats.by_status?.approved ?? 0, color: "text-success" },
        { label: "Pendentes", value: stats.by_status?.pending ?? 0, color: "text-warning" },
        { label: "Rejeitadas", value: stats.by_status?.rejected ?? 0, color: "text-destructive" },
    ];

    return (
        <div className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {statusCards.map(({ label, value, color }) => (
                    <Card key={label}>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                                {label}
                            </p>
                            <p className={cn("text-3xl font-bold font-display", color)}>
                                {value.toLocaleString("pt-BR")}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-5">
                {/* Por disciplina */}
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            Por Disciplina
                        </p>
                        <div className="space-y-2">
                            {Object.entries(stats.by_discipline)
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 8)
                                .map(([discipline, count]) => {
                                    const total = stats.by_status?.approved ?? 1;
                                    const pct = Math.round((count / total) * 100);
                                    return (
                                        <div key={discipline}>
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-xs text-foreground truncate max-w-[200px]">
                                                    {discipline}
                                                </p>
                                                <p className="text-xs text-muted-foreground font-mono ml-2 shrink-0">
                                                    {count}
                                                </p>
                                            </div>
                                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary rounded-full"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </CardContent>
                </Card>

                {/* Top submitters + dificuldade */}
                <div className="space-y-4">
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                Por Dificuldade
                            </p>
                            <div className="space-y-2">
                                {Object.entries(stats.by_difficulty).map(([diff, count]) => (
                                    <div key={diff} className="flex items-center justify-between">
                                        <span className={cn(
                                            "text-xs px-2 py-0.5 rounded-full border",
                                            DIFFICULTY_VARIANT[diff]
                                        )}>
                                            {DIFFICULTY_LABEL[diff] ?? diff}
                                        </span>
                                        <span className="text-sm font-semibold font-mono text-foreground">
                                            {count}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {stats.top_submitters.length > 0 && (
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    Top Submissões por Produtor
                                </p>
                                <div className="space-y-2">
                                    {stats.top_submitters.map(s => (
                                        <div key={s.tenant_id} className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                                <Building2 className="h-3.5 w-3.5 text-primary" />
                                            </div>
                                            <p className="text-sm text-foreground flex-1 truncate">
                                                {s.tenant_name}
                                            </p>
                                            <p className="text-sm font-semibold font-mono text-foreground">
                                                {s.total}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Import Panel ──────────────────────────────────────────────────────────────

function ImportPanel() {
    const toast = useToast();
    const queryClient = useQueryClient();
    const fileRef = useRef<HTMLInputElement>(null);
    const [parsed, setParsed] = useState<any[] | null>(null);
    const [jsonText, setJsonText] = useState("");
    const [result, setResult] = useState<ImportResult | null>(null);
    const [dragging, setDragging] = useState(false);

    // ── Questão única ─────────────────────────────────────────────────────────
    const [showSingle, setShowSingle] = useState(false);

    const importMutation = useMutation({
        mutationFn: (questions: any[]) =>
            apiClient.post("/admin/questions/bulk-import", questions).then(r => r.data),
        onSuccess: (data: ImportResult) => {
            setResult(data);
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.QUESTION_BANK_STATS });
            if (data.errors > 0) {
                toast.error(`Import concluído com ${data.errors} erro(s)`);
            } else if (data.skipped > 0) {
                toast.success(`${data.inserted} inseridas`, `${data.skipped} duplicatas ignoradas`);
            } else {
                toast.success(`${data.inserted} questões importadas com sucesso!`);
            }
        },
        onError: () => toast.error("Erro ao conectar com a API"),
    });

    function parseText(text: string) {
        try {
            const data = JSON.parse(text);
            if (!Array.isArray(data)) throw new Error("Esperado um array");
            setParsed(data);
            setResult(null);
            return true;
        } catch (e: any) {
            toast.error("JSON inválido", e.message);
            setParsed(null);
            return false;
        }
    }

    function handleFile(file: File) {
        const reader = new FileReader();
        reader.onload = e => {
            const text = e.target?.result as string;
            setJsonText(text);
            parseText(text);
        };
        reader.readAsText(file);
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file?.name.endsWith(".json")) handleFile(file);
        else toast.error("Apenas arquivos .json são aceitos");
    }

    function handleTextChange(v: string) {
        setJsonText(v);
        if (v.trim()) parseText(v);
        else setParsed(null);
    }

    const disciplines = parsed
        ? [...new Set(parsed.map((q: any) => q.discipline).filter(Boolean))]
        : [];

    return (
        <div className="space-y-4">
            {/* Ações rápidas */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    Importe o arquivo gerado pelo notebook Gemini ou adicione questões manualmente.
                </p>
                <Button variant="outline" size="sm" onClick={() => setShowSingle(true)}>
                    <Plus className="h-4 w-4" />
                    Questão única
                </Button>
            </div>

            {/* Upload zone */}
            <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                    "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
                    dragging
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                )}
            >
                <input
                    ref={fileRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <FileJson className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-foreground">
                    Arraste o arquivo JSON ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    questoes_para_importacao.json
                </p>
            </div>

            {/* Ou cole */}
            <div className="relative">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center">
                    <div className="flex-1 border-t border-border" />
                    <span className="mx-3 text-xs text-muted-foreground bg-background px-2">ou cole o JSON</span>
                    <div className="flex-1 border-t border-border" />
                </div>
            </div>

            <div className="space-y-1 pt-4">
                <textarea
                    rows={6}
                    value={jsonText}
                    onChange={e => handleTextChange(e.target.value)}
                    placeholder='[{"external_id":"...","statement":"...","discipline":"..."}]'
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
            </div>

            {/* Preview */}
            {parsed && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20">
                    <div>
                        <p className="text-sm font-semibold text-success">
                            {parsed.length.toLocaleString("pt-BR")} questão{parsed.length !== 1 ? "ões" : ""} detectada{parsed.length !== 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {disciplines.slice(0, 4).join(" · ")}
                            {disciplines.length > 4 ? ` +${disciplines.length - 4}` : ""}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setParsed(null); setJsonText(""); setResult(null); }}
                    >
                        Limpar
                    </Button>
                </div>
            )}

            <Button
                className="w-full"
                disabled={!parsed || importMutation.isPending}
                loading={importMutation.isPending}
                onClick={() => parsed && importMutation.mutate(parsed)}
            >
                {importMutation.isPending
                    ? `Importando ${parsed?.length ?? 0} questões...`
                    : "Importar questões"
                }
            </Button>

            {/* Resultado */}
            {result && (
                <Card className={cn(
                    "border",
                    result.errors > 0 ? "border-destructive/30 bg-destructive/5" : "border-success/30 bg-success/5"
                )}>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            {result.errors > 0
                                ? <AlertCircle className="h-4 w-4 text-destructive" />
                                : <CheckCircle2 className="h-4 w-4 text-success" />
                            }
                            <p className="text-sm font-semibold text-foreground">
                                {result.errors > 0 ? "Import concluído com erros" : "Import concluído com sucesso"}
                            </p>
                        </div>

                        <div className="grid grid-cols-4 gap-3 text-center">
                            {[
                                { label: "Inseridas", value: result.inserted, color: "text-success" },
                                { label: "Atualizadas", value: result.updated, color: "text-primary" },
                                { label: "Ignoradas", value: result.skipped, color: "text-warning" },
                                { label: "Erros", value: result.errors, color: "text-destructive" },
                            ].map(({ label, value, color }) => (
                                <div key={label} className="p-2 rounded-lg bg-background/60">
                                    <p className={cn("text-xl font-bold font-display", color)}>
                                        {value}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{label}</p>
                                </div>
                            ))}
                        </div>

                        {result.error_details.length > 0 && (
                            <div className="mt-3 p-3 rounded-lg bg-background/60 space-y-1">
                                <p className="text-xs font-semibold text-muted-foreground mb-2">ERROS DETALHADOS</p>
                                {result.error_details.slice(0, 5).map((e, i) => (
                                    <p key={i} className="text-xs font-mono text-destructive">
                                        {e.external_id} — {e.error}
                                    </p>
                                ))}
                                {result.error_details.length > 5 && (
                                    <p className="text-xs text-muted-foreground">
                                        +{result.error_details.length - 5} erros omitidos
                                    </p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Modal questão única */}
            <SingleQuestionModal open={showSingle} onClose={() => setShowSingle(false)} />
        </div>
    );
}

// ── Pending Panel ─────────────────────────────────────────────────────────────

function PendingPanel({
    questions, total, byTenant, isLoading,
}: {
    questions: PendingQuestion[];
    total: number;
    byTenant: { tenant_id: string; tenant_name: string; count: number }[];
    isLoading: boolean;
}) {
    const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
    const [rejectTarget, setRejectTarget] = useState<PendingQuestion | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const toast = useToast();
    const queryClient = useQueryClient();

    const approveMutation = useMutation({
        mutationFn: (id: string) =>
            apiClient.post(`/admin/questions/${id}/approve`).then(r => r.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.QUESTION_BANK_PENDING });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.QUESTION_BANK_STATS });
            toast.success("Questão aprovada!");
        },
        onError: () => toast.error("Erro ao aprovar questão"),
    });

    const filtered = selectedTenant
        ? questions.filter(q => q.submitted_by_tenant?.id === selectedTenant)
        : questions;

    if (isLoading) {
        return (
            <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Resumo por produtor */}
            {byTenant.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setSelectedTenant(null)}
                        className={cn(
                            "text-xs px-3 py-1.5 rounded-full border transition-all font-medium",
                            !selectedTenant
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Todos ({total})
                    </button>
                    {byTenant.map(t => (
                        <button
                            key={t.tenant_id}
                            onClick={() => setSelectedTenant(
                                selectedTenant === t.tenant_id ? null : t.tenant_id
                            )}
                            className={cn(
                                "text-xs px-3 py-1.5 rounded-full border transition-all font-medium",
                                selectedTenant === t.tenant_id
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {t.tenant_name} ({t.count})
                        </button>
                    ))}
                </div>
            )}

            {filtered.length === 0 ? (
                <Card>
                    <CardContent className="p-10 text-center">
                        <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-3" />
                        <p className="text-sm font-medium text-foreground">Nenhuma questão pendente</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Todas as submissões foram revisadas.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filtered.map(q => (
                        <PendingQuestionCard
                            key={q.id}
                            question={q}
                            expanded={expandedId === q.id}
                            onToggle={() => setExpandedId(expandedId === q.id ? null : q.id)}
                            onApprove={() => approveMutation.mutate(q.id)}
                            onReject={() => setRejectTarget(q)}
                            approving={approveMutation.isPending && approveMutation.variables === q.id}
                        />
                    ))}
                </div>
            )}

            {rejectTarget && (
                <RejectModal
                    question={rejectTarget}
                    onClose={() => setRejectTarget(null)}
                />
            )}
        </div>
    );
}

// ── Pending Question Card ─────────────────────────────────────────────────────

function PendingQuestionCard({
    question, expanded, onToggle, onApprove, onReject, approving,
}: {
    question: PendingQuestion;
    expanded: boolean;
    onToggle: () => void;
    onApprove: () => void;
    onReject: () => void;
    approving: boolean;
}) {
    return (
        <Card className="overflow-hidden">
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant="outline" className="text-xs font-mono">
                                {question.discipline}
                            </Badge>
                            {question.topic && (
                                <span className="text-xs text-muted-foreground">
                                    {question.topic}
                                </span>
                            )}
                            <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full border",
                                DIFFICULTY_VARIANT[question.difficulty]
                            )}>
                                {DIFFICULTY_LABEL[question.difficulty]}
                            </span>
                        </div>

                        <p className="text-sm text-foreground line-clamp-2">
                            {question.statement}
                        </p>

                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {question.submitted_by_tenant && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {question.submitted_by_tenant.name}
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                                {new Date(question.created_at).toLocaleDateString("pt-BR")}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-success border-success/30 hover:bg-success/10"
                            loading={approving}
                            onClick={onApprove}
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            Aprovar
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={onReject}
                        >
                            <XCircle className="h-4 w-4" />
                            Rejeitar
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={onToggle}>
                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>

                {/* Expanded: alternativas */}
                {expanded && (
                    <div className="mt-4 pt-4 border-t border-border space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Alternativas
                        </p>
                        {question.alternatives.map(alt => (
                            <div key={alt.key} className="flex gap-2 text-sm">
                                <span className="font-semibold text-muted-foreground w-4 shrink-0">
                                    {alt.key}
                                </span>
                                <span className="text-foreground">{alt.text}</span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ── Reject Modal ──────────────────────────────────────────────────────────────

function RejectModal({ question, onClose }: { question: PendingQuestion; onClose: () => void }) {
    const toast = useToast();
    const queryClient = useQueryClient();
    const { register, handleSubmit, formState: { errors } } = useForm<{ reason: string }>();

    const rejectMutation = useMutation({
        mutationFn: ({ reason }: { reason: string }) =>
            apiClient.post(`/admin/questions/${question.id}/reject`, { reason }).then(r => r.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.QUESTION_BANK_PENDING });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.QUESTION_BANK_STATS });
            toast.success("Questão rejeitada.");
            onClose();
        },
        onError: () => toast.error("Erro ao rejeitar questão"),
    });

    return (
        <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <XCircle className="h-5 w-5" />
                        Rejeitar questão
                    </DialogTitle>
                </DialogHeader>

                <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <p className="text-xs text-muted-foreground font-mono">{question.discipline}</p>
                    <p className="text-sm text-foreground mt-1 line-clamp-2">{question.statement}</p>
                </div>

                <form onSubmit={handleSubmit(d => rejectMutation.mutate(d))} className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-sm font-medium">
                            Motivo da rejeição <span className="text-destructive">*</span>
                        </label>
                        <textarea
                            {...register("reason", { required: "Motivo obrigatório", minLength: { value: 10, message: "Mínimo 10 caracteres" } })}
                            rows={3}
                            placeholder="Ex: Gabarito incorreto, questão desatualizada, enunciado incompleto..."
                            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        {errors.reason && (
                            <p className="text-xs text-destructive">{errors.reason.message}</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" variant="destructive" loading={rejectMutation.isPending}>
                            Rejeitar questão
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── Single Question Modal ─────────────────────────────────────────────────────

const LETTERS = ["A", "B", "C", "D", "E"] as const;

function SingleQuestionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const toast = useToast();
    const queryClient = useQueryClient();
    const [correctKey, setCorrectKey] = useState<string>("A");
    const { register, handleSubmit, reset, formState: { errors } } = useForm({
        defaultValues: {
            statement: "", discipline: "", topic: "",
            difficulty: "medium", question_type: "",
            exam_board: "", exam_year: "",
            correct_justification: "", tip: "",
            alt_A: "", alt_B: "", alt_C: "", alt_D: "", alt_E: "",
        },
    });

    const mutation = useMutation({
        mutationFn: (payload: any[]) =>
            apiClient.post("/admin/questions/bulk-import", payload).then(r => r.data),
        onSuccess: (data: ImportResult) => {
            if (data.skipped > 0) {
                toast.error("Questão duplicada", "Esta questão já existe no banco.");
            } else if (data.inserted > 0) {
                toast.success("Questão adicionada!");
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.QUESTION_BANK_STATS });
                reset();
                onClose();
            } else {
                toast.error("Erro ao adicionar questão");
            }
        },
        onError: () => toast.error("Erro ao conectar com a API"),
    });

    function onSubmit(data: any) {
        const alternatives = LETTERS
            .map(l => ({
                key: l,
                text: data[`alt_${l}`]?.trim() ?? "",
                is_correct: l === correctKey,
                explanation: null,
            }))
            .filter(a => a.text);

        if (alternatives.length < 2) {
            toast.error("Preencha ao menos 2 alternativas");
            return;
        }

        const payload = [{
            external_id: null,
            statement: data.statement,
            discipline: data.discipline.toUpperCase(),
            topic: data.topic || null,
            difficulty: data.difficulty,
            question_type: data.question_type || null,
            correct_answer_key: correctKey,
            explanation: data.correct_justification || null,
            tip: data.tip || null,
            exam_board: data.exam_board || null,
            exam_year: data.exam_year ? parseInt(data.exam_year) : null,
            alternatives,
            tags: [],
            source_type: "bank",
            has_image: false,
        }];

        mutation.mutate(payload);
    }

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); reset(); setCorrectKey("A"); } }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        Adicionar questão
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* Enunciado */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium">
                            Enunciado <span className="text-destructive">*</span>
                        </label>
                        <textarea
                            {...register("statement", { required: true })}
                            rows={4}
                            placeholder="Texto da questão..."
                            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>

                    {/* Metadados */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">
                                Disciplina <span className="text-destructive">*</span>
                            </label>
                            <Input
                                {...register("discipline", { required: true })}
                                placeholder="Ex: DIREITO CONSTITUCIONAL"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Tópico</label>
                            <Input {...register("topic")} placeholder="Ex: Princípio da Legalidade" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Dificuldade</label>
                            <select
                                {...register("difficulty")}
                                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                            >
                                <option value="easy">Fácil</option>
                                <option value="medium">Médio</option>
                                <option value="hard">Difícil</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Tipo</label>
                            <select
                                {...register("question_type")}
                                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                            >
                                <option value="">— selecione —</option>
                                <option value="interpretacao">Interpretação</option>
                                <option value="aplicacao">Aplicação</option>
                                <option value="raciocinio">Raciocínio</option>
                                <option value="memorizacao">Memorização</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Banca</label>
                            <Input {...register("exam_board")} placeholder="CESPE, FCC, VUNESP..." />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Ano</label>
                            <Input {...register("exam_year")} placeholder="2024" type="number" />
                        </div>
                    </div>

                    {/* Alternativas */}
                    <div className="space-y-2">
                        <p className="text-sm font-medium">
                            Alternativas{" "}
                            <span className="text-xs text-muted-foreground font-normal">
                                — clique no círculo para marcar a correta
                            </span>
                        </p>
                        {LETTERS.map(l => (
                            <div key={l} className={cn(
                                "flex items-center gap-3 p-2.5 rounded-lg border transition-all",
                                l === correctKey
                                    ? "border-success/40 bg-success/5"
                                    : "border-border"
                            )}>
                                <span className={cn(
                                    "text-sm font-semibold w-5 text-center shrink-0",
                                    l === correctKey ? "text-success" : "text-muted-foreground"
                                )}>
                                    {l}
                                </span>
                                <Input
                                    {...register(`alt_${l}` as any)}
                                    placeholder={`Alternativa ${l}`}
                                    className="flex-1 border-0 bg-transparent p-0 h-auto focus-visible:ring-0 shadow-none text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setCorrectKey(l)}
                                    className={cn(
                                        "h-5 w-5 rounded-full border-2 shrink-0 transition-all",
                                        l === correctKey
                                            ? "border-success bg-success"
                                            : "border-muted-foreground/40 hover:border-success"
                                    )}
                                >
                                    {l === correctKey && (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-white m-auto" />
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Justificativa + dica */}
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Justificativa da correta</label>
                            <textarea
                                {...register("correct_justification")}
                                rows={2}
                                placeholder="Por que a alternativa correta está certa..."
                                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Dica / Macete</label>
                            <Input {...register("tip")} placeholder="Dica rápida para resolver este tipo de questão..." />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => { onClose(); reset(); setCorrectKey("A"); }}>
                            Cancelar
                        </Button>
                        <Button type="submit" loading={mutation.isPending}>
                            Adicionar questão
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}