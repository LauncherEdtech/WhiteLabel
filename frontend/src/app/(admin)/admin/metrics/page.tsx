// frontend/src/app/(admin)/admin/metrics/page.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import {
    Building2, CheckCircle2, XCircle, RefreshCw,
    BarChart3, TrendingUp, TrendingDown, Activity,
    Zap, BookOpen, CalendarCheck, HelpCircle, Minus,
    Users, Search,
} from "lucide-react";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Tenant {
    id: string; name: string; slug: string; plan: string;
    is_active: boolean; admin: { name: string; email: string } | null;
}

interface TrackingData {
    tenant_id: string; tenant_name: string; computed_at: string;
    total_students: number; dau: number; mau: number; stickiness: number;
    taxa_ativacao: number; retorno_d1: number; retorno_d7: number;
    uso_funcionalidades: Record<string, { label: string; count: number; pct: number }>;
    total_events: number;
    performance_semanal: Array<{
        label: string; week_start: string; week_end: string;
        total_questions: number; correct: number; accuracy_pct: number;
    }>;
    // avisos de precisão retornados pela API
    warnings?: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function PctBadge({ value, thresholds }: { value: number; thresholds?: [number, number] }) {
    const t = thresholds ?? [30, 60];
    const color =
        value >= t[1] ? "bg-success/10 text-success border-success/20"
            : value >= t[0] ? "bg-warning/10 text-warning border-warning/20"
                : "bg-destructive/10 text-destructive border-destructive/20";
    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${color}`}>
            {value}%
        </span>
    );
}

function MetricCard({ icon: Icon, label, value, sub, highlight }: {
    icon: React.ElementType; label: string; value: React.ReactNode;
    sub?: React.ReactNode; highlight?: boolean;
}) {
    return (
        <div className={`rounded-xl border p-4 space-y-1.5 ${highlight
            ? "bg-primary/5 border-primary/20"
            : "bg-card border-border"}`}>
            <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-xs uppercase tracking-wider font-semibold">{label}</span>
            </div>
            <div className="text-2xl font-bold text-foreground leading-none">{value}</div>
            {sub && <div className="text-xs text-muted-foreground leading-snug">{sub}</div>}
        </div>
    );
}

const FuncIcon: Record<string, React.ElementType> = {
    questoes: HelpCircle,
    cronograma: CalendarCheck,
    aulas: BookOpen,
};

// ── Página ────────────────────────────────────────────────────────────────────

export default function MetricsPage() {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const { data, isLoading: tenantsLoading } = useQuery({
        queryKey: QUERY_KEYS.TENANTS,
        queryFn: () => apiClient.get("/tenants/").then(r => r.data.tenants as Tenant[]),
    });

    const tenants = (data || []).filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase())
    );

    const selectedTenant = (data || []).find(t => t.id === selectedId) ?? null;

    return (
        <div className="h-[calc(100vh-theme(spacing.6)*2-theme(spacing.16))] flex gap-5 animate-fade-in">

            {/* ── Coluna esquerda: lista de tenants ─────────────────────────── */}
            <div className="w-72 shrink-0 flex flex-col gap-3">
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">Métricas</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Selecione um infoprodutor</p>
                </div>

                {/* Busca */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar tenant..."
                        className="w-full h-9 pl-9 pr-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                    {tenantsLoading ? (
                        [...Array(4)].map((_, i) => (
                            <Skeleton key={i} className="h-16 rounded-xl animate-pulse" />
                        ))
                    ) : tenants.map(tenant => (
                        <button
                            key={tenant.id}
                            onClick={() => setSelectedId(tenant.id)}
                            className={cn(
                                "w-full text-left rounded-xl border p-3 transition-all",
                                selectedId === tenant.id
                                    ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                                    : "bg-card border-border hover:bg-accent/50"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                    <Building2 className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-medium text-foreground truncate">
                                            {tenant.name}
                                        </span>
                                        {tenant.is_active
                                            ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                                            : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                                        }
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-xs text-muted-foreground font-mono">{tenant.slug}</span>
                                        <Badge
                                            variant={tenant.plan === "enterprise" ? "default" : tenant.plan === "pro" ? "secondary" : "outline"}
                                            className="text-xs px-1.5 py-0"
                                        >
                                            {tenant.plan}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Coluna direita: painel de métricas ──────────────────────────── */}
            <div className="flex-1 min-w-0 overflow-y-auto">
                {!selectedId ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                        <BarChart3 className="h-12 w-12 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">
                            Selecione um infoprodutor para ver as métricas
                        </p>
                    </div>
                ) : (
                    <MetricsPanel tenantId={selectedId} tenant={selectedTenant} />
                )}
            </div>
        </div>
    );
}

// ── Painel de métricas ────────────────────────────────────────────────────────

function MetricsPanel({ tenantId, tenant }: { tenantId: string; tenant: Tenant | null }) {
    const {
        data: tracking,
        isLoading,
        isError,
        refetch,
        isFetching,
        dataUpdatedAt,
    } = useQuery<TrackingData>({
        queryKey: ["tenant-tracking", tenantId],
        queryFn: async () => {
            const res = await apiClient.get(`/tenants/${tenantId}/tracking`);
            return res.data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const semanas = tracking?.performance_semanal ?? [];
    const semanaAtual = semanas[semanas.length - 1];
    const semanaAnterior = semanas[semanas.length - 2];
    const evolucao =
        semanaAtual && semanaAnterior && semanaAnterior.accuracy_pct > 0
            ? +(semanaAtual.accuracy_pct - semanaAnterior.accuracy_pct).toFixed(1)
            : null;

    const updatedAt = dataUpdatedAt
        ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : null;

    return (
        <div className="space-y-6 pb-6">

            {/* Header do painel */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-display text-xl font-bold text-foreground">
                        {tenant?.name ?? "Carregando..."}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{tenant?.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                    {updatedAt && (
                        <span className="text-xs text-muted-foreground">
                            Atualizado às {updatedAt}
                        </span>
                    )}
                    <Button
                        variant="outline" size="sm" className="gap-1.5"
                        onClick={() => refetch()}
                        disabled={isFetching || isLoading}
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                        Atualizar
                    </Button>
                </div>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-28 rounded-xl animate-pulse" />
                    ))}
                </div>
            )}

            {/* Erro */}
            {!isLoading && isError && (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <XCircle className="h-10 w-10 text-destructive/40" />
                    <p className="text-sm text-muted-foreground">Erro ao carregar métricas.</p>
                    <Button variant="outline" size="sm" onClick={() => refetch()}>
                        <RefreshCw className="h-4 w-4" /> Tentar novamente
                    </Button>
                </div>
            )}

            {/* Dados */}
            {tracking && !isLoading && (
                <>
                    {/* Avisos de precisão */}
                    {tracking.warnings && tracking.warnings.length > 0 && (
                        <div className="rounded-xl border border-warning/20 bg-warning/5 p-3 space-y-1">
                            {tracking.warnings.map((w, i) => (
                                <p key={i} className="text-xs text-warning font-medium">⚠ {w}</p>
                            ))}
                        </div>
                    )}

                    {/* ── Engajamento ─────────────────────────────────────── */}
                    <section>
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                            Engajamento
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                            <MetricCard
                                icon={Users}
                                label="Total de alunos"
                                value={tracking.total_students}
                                sub="Cadastrados no tenant"
                            />
                            <MetricCard
                                icon={Zap}
                                label="Taxa de Ativação"
                                value={<PctBadge value={tracking.taxa_ativacao} />}
                                sub="Realizaram ao menos 1 evento-chave"
                            />
                            <MetricCard
                                icon={Activity}
                                label="DAU"
                                value={tracking.dau}
                                sub="Usuários únicos ativos hoje"
                            />
                            <MetricCard
                                icon={Activity}
                                label="MAU"
                                value={tracking.mau}
                                sub="Usuários únicos — últimos 30 dias"
                            />
                            <MetricCard
                                icon={TrendingUp}
                                label="Stickiness"
                                value={<PctBadge value={tracking.stickiness} thresholds={[10, 25]} />}
                                sub="DAU ÷ MAU — recorrência de uso"
                                highlight
                            />
                        </div>
                    </section>

                    {/* ── Retenção ─────────────────────────────────────────── */}
                    <section>
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                            Retenção
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <MetricCard
                                icon={RefreshCw}
                                label="Retorno D1"
                                value={<PctBadge value={tracking.retorno_d1} />}
                                sub="Voltaram no dia seguinte ao 1° acesso real"
                            />
                            <MetricCard
                                icon={RefreshCw}
                                label="Retorno D7"
                                value={<PctBadge value={tracking.retorno_d7} />}
                                sub="Voltaram em algum dia da 1ª semana"
                            />
                        </div>
                    </section>

                    {/* ── Uso por funcionalidade ───────────────────────────── */}
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Uso por funcionalidade
                            </p>
                            <span className="text-xs text-muted-foreground">
                                {tracking.total_events.toLocaleString("pt-BR")} eventos totais
                            </span>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                            {Object.entries(tracking.uso_funcionalidades).map(([key, item]) => {
                                const Icon = FuncIcon[key] ?? Activity;
                                return (
                                    <div key={key} className="flex items-center gap-3">
                                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-sm font-medium text-foreground">{item.label}</span>
                                                <span className="text-xs text-muted-foreground tabular-nums">
                                                    {item.count.toLocaleString("pt-BR")} eventos · <strong>{item.pct}%</strong>
                                                </span>
                                            </div>
                                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-primary transition-all duration-700"
                                                    style={{ width: `${item.pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* ── Performance semanal ──────────────────────────────── */}
                    <section>
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                            Performance semanal — questões
                        </p>

                        {/* Destaque semana atual */}
                        {semanaAtual && (
                            <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 mb-3">
                                <div className="flex-1">
                                    <p className="text-xs text-muted-foreground mb-0.5">Semana atual</p>
                                    <p className="text-2xl font-bold text-foreground">
                                        {semanaAtual.accuracy_pct}%
                                        <span className="text-sm text-muted-foreground font-normal ml-2">
                                            de acerto
                                        </span>
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {semanaAtual.correct.toLocaleString("pt-BR")} acertos de {semanaAtual.total_questions.toLocaleString("pt-BR")} questões
                                    </p>
                                </div>
                                {evolucao !== null && (
                                    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold ${evolucao > 0 ? "bg-success/10 text-success"
                                        : evolucao < 0 ? "bg-destructive/10 text-destructive"
                                            : "bg-muted text-muted-foreground"
                                        }`}>
                                        {evolucao > 0 ? <TrendingUp className="h-4 w-4" />
                                            : evolucao < 0 ? <TrendingDown className="h-4 w-4" />
                                                : <Minus className="h-4 w-4" />}
                                        {evolucao > 0 ? "+" : ""}{evolucao}pp
                                        <span className="text-xs font-normal ml-0.5">vs semana anterior</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tabela 4 semanas */}
                        <div className="rounded-xl border border-border overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/50 border-b border-border">
                                        <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">Período</th>
                                        <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2.5">Questões</th>
                                        <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2.5">Acertos</th>
                                        <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2.5">Erros</th>
                                        <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2.5">% Acerto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {semanas.map((s, i) => {
                                        const erros = s.total_questions - s.correct;
                                        const isCurrent = i === semanas.length - 1;
                                        return (
                                            <tr key={s.week_start}
                                                className={`border-b border-border last:border-0 ${isCurrent ? "bg-primary/5 font-medium" : ""}`}>
                                                <td className="px-4 py-3">
                                                    <span className={`text-sm ${isCurrent ? "text-primary font-semibold" : "text-foreground"}`}>
                                                        {s.label}
                                                    </span>
                                                    <span className="block text-xs text-muted-foreground font-normal">
                                                        {new Date(s.week_start + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                                                        {" – "}
                                                        {new Date(s.week_end + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-foreground tabular-nums">
                                                    {s.total_questions.toLocaleString("pt-BR")}
                                                </td>
                                                <td className="px-4 py-3 text-right text-success tabular-nums font-medium">
                                                    {s.correct.toLocaleString("pt-BR")}
                                                </td>
                                                <td className="px-4 py-3 text-right text-destructive tabular-nums font-medium">
                                                    {erros.toLocaleString("pt-BR")}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <PctBadge value={s.accuracy_pct} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}