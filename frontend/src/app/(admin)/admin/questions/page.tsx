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
    ChevronDown, ChevronUp, Search, Filter, FileJson, FileSpreadsheet,
    BarChart3, Building2, Loader2, Plus, Sparkles, Image, Download,
    FolderOpen, Layers,
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
    images_uploaded?: number;
    total_rows?: number;
    enrich_ai?: boolean;
    skip_details: { external_id: string; reason: string; existing_id?: string }[];
    error_details: { row?: number; sheet?: string; statement_preview?: string; external_id?: string; error: string }[];
}

interface XlsxPreview {
    total_questions: number;
    by_sheet: { sheet: string; count: number }[];
    disciplines: string[];
    questions_with_image: number;
    images_in_zip: number;
    estimated_duplicates: number;
}

const DIFFICULTY_LABEL: Record<string, string> = {
    easy: "Fácil", medium: "Médio", hard: "Difícil",
};
const DIFFICULTY_VARIANT: Record<string, string> = {
    easy: "bg-success/10 text-success border-success/20",
    medium: "bg-warning/10 text-warning border-warning/20",
    hard: "bg-destructive/10 text-destructive border-destructive/20",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminQuestionsPage() {
    const [tab, setTab] = useState<"stats" | "import" | "pending">("stats");

    const { data: stats, isLoading: statsLoading } = useQuery<BankStats>({
        queryKey: QUERY_KEYS.QUESTION_BANK_STATS,
        queryFn: () => apiClient.get("/admin/questions/stats").then(r => r.data),
        staleTime: 60_000,
    });

    const { data: pendingData, isLoading: pendingLoading } = useQuery({
        queryKey: QUERY_KEYS.QUESTION_BANK_PENDING,
        queryFn: () => apiClient.get("/admin/questions/pending").then(r => r.data),
        staleTime: 30_000,
        enabled: tab === "pending",
    });

    const pendingQuestions: PendingQuestion[] = pendingData?.questions ?? [];
    const pendingTotal: number = pendingData?.total ?? 0;
    const byTenant = pendingData?.by_tenant ?? [];

    const tabs = [
        { key: "stats" as const, label: "Visão Geral", icon: BarChart3 },
        { key: "import" as const, label: "Importar Questões", icon: Upload },
        {
            key: "pending" as const,
            label: "Revisão Pendente",
            icon: Clock,
            badge: stats?.by_status?.pending,
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-display font-bold text-foreground">
                    Banco de Questões
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    {stats
                        ? `${stats.total_questions.toLocaleString("pt-BR")} questões no banco global`
                        : "Banco compartilhado entre todos os infoprodutores"}
                </p>
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
        <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
                {statusCards.map(({ label, value, color }) => (
                    <Card key={label}>
                        <CardContent className="p-4 text-center">
                            <p className={cn("text-3xl font-display font-bold", color)}>
                                {(value ?? 0).toLocaleString("pt-BR")}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {Object.keys(stats.by_discipline ?? {}).length > 0 && (
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm font-semibold mb-3">Por disciplina</p>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(stats.by_discipline)
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 12)
                                .map(([disc, count]) => (
                                    <div key={disc} className="flex items-center justify-between py-1">
                                        <p className="text-xs text-muted-foreground truncate mr-2">{disc}</p>
                                        <p className="text-sm font-semibold font-mono text-foreground">
                                            {count}
                                        </p>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// ── Import Panel ──────────────────────────────────────────────────────────────

type ImportMode = "xlsx" | "json";

function ImportPanel() {
    const [mode, setMode] = useState<ImportMode>("xlsx");

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    Importe questões via planilha Excel (.xlsx / .zip com imagens) ou JSON gerado pelo notebook Gemini.
                </p>
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                    <button
                        onClick={() => setMode("xlsx")}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                            mode === "xlsx"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        XLSX / ZIP
                    </button>
                    <button
                        onClick={() => setMode("json")}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                            mode === "json"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <FileJson className="h-3.5 w-3.5" />
                        JSON
                    </button>
                </div>
            </div>

            {mode === "xlsx" ? <XlsxImportPanel /> : <JsonImportPanel />}
        </div>
    );
}

// ── XLSX Import Panel ─────────────────────────────────────────────────────────

function XlsxImportPanel() {
    const toast = useToast();
    const queryClient = useQueryClient();
    const fileRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<XlsxPreview | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [enrichAi, setEnrichAi] = useState(true);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [showSingle, setShowSingle] = useState(false);

    const importMutation = useMutation({
        mutationFn: (formData: FormData) =>
            apiClient.post("/admin/questions/xlsx-import", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            }).then(r => r.data),
        onSuccess: (data: ImportResult) => {
            setResult(data);
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.QUESTION_BANK_STATS });
            if (data.errors > 0) {
                toast.error(`Import concluído com ${data.errors} erro(s)`);
            } else {
                const imgMsg = data.images_uploaded ? ` · ${data.images_uploaded} imagem(ns) no S3` : "";
                toast.success(
                    `${data.inserted} questões importadas`,
                    `${data.skipped} duplicatas ignoradas${imgMsg}`
                );
            }
        },
        onError: () => toast.error("Erro ao processar o arquivo"),
    });

    async function loadPreview(f: File) {
        setPreviewLoading(true);
        setPreview(null);
        setResult(null);
        const fd = new FormData();
        fd.append("file", f);
        try {
            const res = await apiClient.post("/admin/questions/xlsx-preview", fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setPreview(res.data);
        } catch (e: any) {
            const msg = e?.response?.data?.error ?? "Erro ao ler o arquivo";
            toast.error("Arquivo inválido", msg);
            setFile(null);
        } finally {
            setPreviewLoading(false);
        }
    }

    function handleFile(f: File) {
        const valid = f.name.endsWith(".xlsx") || f.name.endsWith(".zip");
        if (!valid) {
            toast.error("Formato inválido", "Aceito: .xlsx ou .zip contendo xlsx + imagens");
            return;
        }
        setFile(f);
        loadPreview(f);
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
    }

    function reset() {
        setFile(null);
        setPreview(null);
        setResult(null);
        if (fileRef.current) fileRef.current.value = "";
    }

    function handleImport() {
        if (!file) return;
        const fd = new FormData();
        fd.append("file", file);
        fd.append("enrich_ai", enrichAi ? "true" : "false");
        importMutation.mutate(fd);
    }

    const isZip = file?.name.endsWith(".zip") ?? false;

    return (
        <div className="space-y-4">
            {/* Formato guide */}
            <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <FileSpreadsheet className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div className="space-y-2 text-sm">
                            <p className="font-semibold text-foreground">Formato esperado da planilha</p>
                            <p className="text-muted-foreground text-xs leading-relaxed">
                                Cada aba do Excel vira uma disciplina. Colunas reconhecidas (case-insensitive):
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {[
                                    "Disciplina", "Enunciado", "Imagem*", "fonte",
                                    "Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D", "Alternativa E*",
                                    "Gabarito",
                                    "Tópico*", "Subtópico*", "Dificuldade*", "Banca*", "Ano*", "Concurso*",
                                    "Dica*", "Justificativa*", "Justificativa A…E*",
                                ].map(col => (
                                    <span
                                        key={col}
                                        className={cn(
                                            "text-xs px-2 py-0.5 rounded-md font-mono",
                                            col.endsWith("*")
                                                ? "bg-muted text-muted-foreground"
                                                : "bg-primary/10 text-primary font-medium"
                                        )}
                                    >
                                        {col.replace("*", "")}
                                        {col.endsWith("*") && <span className="text-muted-foreground/60"> opt</span>}
                                    </span>
                                ))}
                            </div>
                            <div className="flex items-start gap-2 pt-1">
                                <Image className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                <p className="text-xs text-muted-foreground">
                                    Para questões com imagem: coloque o nome do arquivo na coluna{" "}
                                    <code className="font-mono">Imagem</code> (ex: <code>q001.png</code>) e envie tudo
                                    compactado em um <strong>.zip</strong> contendo o xlsx + pasta com as imagens.
                                    O sistema faz o upload automático para o S3.
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Questão única */}
            <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowSingle(true)}>
                    <Plus className="h-4 w-4" />
                    Questão única
                </Button>
            </div>

            {/* Dropzone */}
            {!file && (
                <div
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    className={cn(
                        "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all",
                        dragging
                            ? "border-primary bg-primary/5 scale-[1.01]"
                            : "border-border hover:border-primary/50 hover:bg-muted/30"
                    )}
                >
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".xlsx,.zip"
                        className="hidden"
                        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                    <div className="flex items-center justify-center gap-3 mb-3">
                        <FileSpreadsheet className="h-9 w-9 text-muted-foreground" />
                        <FolderOpen className="h-7 w-7 text-muted-foreground/60" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                        Arraste o arquivo ou clique para selecionar
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Aceito: <code className="font-mono">.xlsx</code> (sem imagens) ou{" "}
                        <code className="font-mono">.zip</code> (xlsx + imagens)
                    </p>
                </div>
            )}

            {/* Loading preview */}
            {previewLoading && (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <p className="text-sm">Analisando arquivo...</p>
                </div>
            )}

            {/* Preview card */}
            {preview && file && !previewLoading && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-success/5 border border-success/20">
                        <div className="flex items-center gap-3">
                            {isZip
                                ? <FolderOpen className="h-5 w-5 text-success" />
                                : <FileSpreadsheet className="h-5 w-5 text-success" />
                            }
                            <div>
                                <p className="text-sm font-semibold text-foreground">
                                    {file.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {(file.size / 1024).toFixed(0)} KB
                                </p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={reset}>
                            Trocar arquivo
                        </Button>
                    </div>

                    {/* Stats do preview */}
                    <div className="grid grid-cols-2 gap-3">
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-2xl font-display font-bold text-foreground">
                                    {preview.total_questions.toLocaleString("pt-BR")}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">questões detectadas</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-2xl font-display font-bold text-foreground">
                                    {preview.by_sheet.length}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    aba{preview.by_sheet.length !== 1 ? "s" : ""} / disciplina{preview.by_sheet.length !== 1 ? "s" : ""}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Abas */}
                    <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Abas encontradas
                        </p>
                        <div className="space-y-1">
                            {preview.by_sheet.map(({ sheet, count }) => (
                                <div key={sheet} className="flex items-center justify-between">
                                    <span className="text-xs text-foreground truncate mr-2">{sheet}</span>
                                    <span className="text-xs font-mono text-muted-foreground shrink-0">
                                        {count} questões
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Avisos */}
                    <div className="space-y-2">
                        {preview.questions_with_image > 0 && (
                            <div className={cn(
                                "flex items-center gap-2 p-2.5 rounded-lg text-xs",
                                preview.images_in_zip > 0
                                    ? "bg-success/10 border border-success/20 text-success"
                                    : "bg-warning/10 border border-warning/20 text-warning"
                            )}>
                                <Image className="h-3.5 w-3.5 shrink-0" />
                                {preview.images_in_zip > 0
                                    ? `${preview.questions_with_image} questão(ões) com imagem — ${preview.images_in_zip} imagem(ns) encontrada(s) no zip, prontas para upload S3`
                                    : `${preview.questions_with_image} questão(ões) com imagem — envie um .zip com o xlsx + pasta de imagens para fazer upload automático`
                                }
                            </div>
                        )}
                        {preview.estimated_duplicates > 0 && (
                            <div className="flex items-center gap-2 p-2.5 rounded-lg text-xs bg-muted/50 border border-border text-muted-foreground">
                                <Layers className="h-3.5 w-3.5 shrink-0" />
                                ~{preview.estimated_duplicates} possível(is) duplicata(s) — serão ignoradas automaticamente
                            </div>
                        )}
                    </div>

                    {/* Opção AI */}
                    <div
                        onClick={() => setEnrichAi(!enrichAi)}
                        className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none",
                            enrichAi
                                ? "border-primary/30 bg-primary/5"
                                : "border-border hover:border-border/80"
                        )}
                    >
                        <div className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                            enrichAi ? "bg-primary/10" : "bg-muted"
                        )}>
                            <Sparkles className={cn("h-4 w-4", enrichAi ? "text-primary" : "text-muted-foreground")} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">
                                Enriquecer com IA (Gemini)
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Preenche automaticamente tópico, dica e justificativas dos distratores quando ausentes
                            </p>
                        </div>
                        <div className={cn(
                            "h-5 w-9 rounded-full transition-colors shrink-0",
                            enrichAi ? "bg-primary" : "bg-muted-foreground/30"
                        )}>
                            <div className={cn(
                                "h-4 w-4 bg-white rounded-full shadow-sm mt-0.5 transition-transform",
                                enrichAi ? "translate-x-4 ml-0.5" : "translate-x-0.5"
                            )} />
                        </div>
                    </div>

                    {/* Botão importar */}
                    <Button
                        className="w-full"
                        size="lg"
                        disabled={importMutation.isPending}
                        loading={importMutation.isPending}
                        onClick={handleImport}
                    >
                        {importMutation.isPending
                            ? `Importando ${preview.total_questions.toLocaleString("pt-BR")} questões...`
                            : `Importar ${preview.total_questions.toLocaleString("pt-BR")} questões`
                        }
                    </Button>
                </div>
            )}

            {/* Resultado */}
            {result && (
                <ImportResultCard result={result} onReset={reset} />
            )}

            <SingleQuestionModal open={showSingle} onClose={() => setShowSingle(false)} />
        </div>
    );
}

// ── JSON Import Panel ─────────────────────────────────────────────────────────

function JsonImportPanel() {
    const toast = useToast();
    const queryClient = useQueryClient();
    const fileRef = useRef<HTMLInputElement>(null);
    const [parsed, setParsed] = useState<any[] | null>(null);
    const [jsonText, setJsonText] = useState("");
    const [result, setResult] = useState<ImportResult | null>(null);
    const [dragging, setDragging] = useState(false);
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

    const disciplines = parsed
        ? [...new Set(parsed.map((q: any) => q.discipline).filter(Boolean))]
        : [];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                    Importe o arquivo gerado pelo notebook Gemini.
                </p>
                <Button variant="outline" size="sm" onClick={() => setShowSingle(true)}>
                    <Plus className="h-4 w-4" />
                    Questão única
                </Button>
            </div>

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
                <p className="text-xs text-muted-foreground mt-1">questoes_para_importacao.json</p>
            </div>

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
                    onChange={e => {
                        setJsonText(e.target.value);
                        if (e.target.value.trim()) parseText(e.target.value);
                        else setParsed(null);
                    }}
                    placeholder='[{"external_id":"...","statement":"...","discipline":"..."}]'
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
            </div>

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
                    <Button variant="ghost" size="sm" onClick={() => { setParsed(null); setJsonText(""); setResult(null); }}>
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

            {result && <ImportResultCard result={result} onReset={() => { setParsed(null); setJsonText(""); setResult(null); }} />}

            <SingleQuestionModal open={showSingle} onClose={() => setShowSingle(false)} />
        </div>
    );
}

// ── Import Result Card ────────────────────────────────────────────────────────

function ImportResultCard({ result, onReset }: { result: ImportResult; onReset: () => void }) {
    const hasErrors = result.errors > 0;
    return (
        <Card className={cn(
            "border",
            hasErrors ? "border-destructive/30 bg-destructive/5" : "border-success/30 bg-success/5"
        )}>
            <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        {hasErrors
                            ? <AlertCircle className="h-4 w-4 text-destructive" />
                            : <CheckCircle2 className="h-4 w-4 text-success" />
                        }
                        <p className="text-sm font-semibold text-foreground">
                            {hasErrors ? "Import concluído com erros" : "Import concluído com sucesso"}
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onReset}>Nova importação</Button>
                </div>

                <div className="grid grid-cols-4 gap-3 text-center">
                    {[
                        { label: "Inseridas", value: result.inserted, color: "text-success" },
                        { label: "Atualizadas", value: result.updated, color: "text-primary" },
                        { label: "Ignoradas", value: result.skipped, color: "text-warning" },
                        { label: "Erros", value: result.errors, color: "text-destructive" },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="p-2 rounded-lg bg-background/60">
                            <p className={cn("text-xl font-bold font-display", color)}>{value}</p>
                            <p className="text-xs text-muted-foreground">{label}</p>
                        </div>
                    ))}
                </div>

                {(result.images_uploaded ?? 0) > 0 && (
                    <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-success/10 border border-success/20">
                        <Image className="h-3.5 w-3.5 text-success shrink-0" />
                        <p className="text-xs text-success font-medium">
                            {result.images_uploaded} imagem(ns) salva(s) no S3
                        </p>
                    </div>
                )}

                {result.enrich_ai && (
                    <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                        <p className="text-xs text-primary">
                            Enriquecimento IA em processamento em segundo plano
                        </p>
                    </div>
                )}

                {result.error_details.length > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-background/60 space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                            Detalhes dos erros
                        </p>
                        {result.error_details.slice(0, 5).map((e, i) => (
                            <p key={i} className="text-xs font-mono text-destructive">
                                {e.sheet && `[${e.sheet} linha ${e.row}] `}
                                {e.statement_preview ?? e.external_id} — {e.error}
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
                <RejectModal question={rejectTarget} onClose={() => setRejectTarget(null)} />
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
                                <span className="text-xs text-muted-foreground">{question.topic}</span>
                            )}
                            <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full border",
                                DIFFICULTY_VARIANT[question.difficulty]
                            )}>
                                {DIFFICULTY_LABEL[question.difficulty]}
                            </span>
                        </div>
                        <p className="text-sm text-foreground line-clamp-2">{question.statement}</p>
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

                {expanded && (
                    <div className="mt-4 pt-4 border-t border-border space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Alternativas
                        </p>
                        {question.alternatives.map(alt => (
                            <div key={alt.key} className="flex gap-2 text-sm">
                                <span className="font-semibold text-muted-foreground w-4 shrink-0">{alt.key}</span>
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
                            {...register("reason", {
                                required: "Motivo obrigatório",
                                minLength: { value: 10, message: "Mínimo 10 caracteres" },
                            })}
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

        mutation.mutate([{
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
        }]);
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

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">
                                Disciplina <span className="text-destructive">*</span>
                            </label>
                            <Input {...register("discipline", { required: true })} placeholder="Ex: DIREITO CONSTITUCIONAL" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Tópico</label>
                            <Input {...register("topic")} placeholder="Ex: Princípio da Legalidade" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Dificuldade</label>
                            <select {...register("difficulty")} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm">
                                <option value="easy">Fácil</option>
                                <option value="medium">Médio</option>
                                <option value="hard">Difícil</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Tipo</label>
                            <select {...register("question_type")} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm">
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
                                l === correctKey ? "border-success/40 bg-success/5" : "border-border"
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
                                        "h-5 w-5 rounded-full border-2 shrink-0 transition-all flex items-center justify-center",
                                        l === correctKey
                                            ? "border-success bg-success"
                                            : "border-muted-foreground/40 hover:border-success"
                                    )}
                                >
                                    {l === correctKey && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                                </button>
                            </div>
                        ))}
                    </div>

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