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
    Building2, CheckCircle2, XCircle, RefreshCw, BarChart3,
    TrendingUp, TrendingDown, Activity, Zap, BookOpen,
    CalendarCheck, HelpCircle, Minus, Users, Search,
    ChevronDown, ChevronUp, ArrowUpDown,
} from "lucide-react";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Tenant {
    id: string; name: string; slug: string; plan: string;
    is_active: boolean; admin: { name: string; email: string } | null;
}

interface PerfSemana {
    label: string; week_start: string; week_end: string;
    total_questions: number; correct: number; accuracy_pct: number;
}

interface TrackingMacro {
    tenant_id: string; tenant_name: string; computed_at: string;
    total_students: number; dau: number; mau: number; stickiness: number;
    taxa_ativacao: number; retorno_d1: number; retorno_d7: number;
    d1_eligible: number; d7_eligible: number;
    uso_funcionalidades: Record<string, { label: string; count: number; pct: number }>;
    total_events: number; performance_semanal: PerfSemana[]; warnings?: string[];
}

interface StudentMicro {
    id: string; name: string; email: string; is_active: boolean;
    created_at: string | null; activated: boolean;
    first_activity: string | null; last_activity: string | null;
    days_active: number; retornou_d1: boolean; retornou_d7: boolean;
    total_questions: number; correct_questions: number; accuracy_pct: number;
    schedule_checkins: number; lessons_watched: number;
    performance_semanal: PerfSemana[];
}

interface TrackingMicro {
    tenant_id: string; tenant_name: string; computed_at: string;
    total: number; students: StudentMicro[];
}

type SortKey = "name" | "last_activity" | "days_active" | "total_questions" | "accuracy_pct" | "activated";

// ── Helpers ───────────────────────────────────────────────────────────────────

function PctBadge({ value, thresholds }: { value: number; thresholds?: [number, number] }) {
    const t = thresholds ?? [30, 60];
    const color = value >= t[1] ? "bg-success/10 text-success border-success/20"
        : value >= t[0] ? "bg-warning/10 text-warning border-warning/20"
            : "bg-destructive/10 text-destructive border-destructive/20";
    return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}>{value}%</span>;
}

function BoolIcon({ value }: { value: boolean }) {
    return value
        ? <CheckCircle2 className="h-4 w-4 text-success mx-auto" />
        : <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />;
}

function MetricCard({ icon: Icon, label, value, sub, highlight }: {
    icon: React.ElementType; label: string; value: React.ReactNode; sub?: React.ReactNode; highlight?: boolean;
}) {
    return (
        <div className={`rounded-xl border p-4 space-y-1.5 ${highlight ? "bg-primary/5 border-primary/20" : "bg-card border-border"}`}>
            <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-xs uppercase tracking-wider font-semibold">{label}</span>
            </div>
            <div className="text-2xl font-bold text-foreground leading-none">{value}</div>
            {sub && <div className="text-xs text-muted-foreground leading-snug">{sub}</div>}
        </div>
    );
}

const FuncIcon: Record<string, React.ElementType> = { questoes: HelpCircle, cronograma: CalendarCheck, aulas: BookOpen };

function fmtDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

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
            {/* Lista de tenants */}
            <div className="w-72 shrink-0 flex flex-col gap-3">
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">Métricas</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Selecione um infoprodutor</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                        className="w-full h-9 pl-9 pr-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                    {tenantsLoading
                        ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl animate-pulse" />)
                        : tenants.map(tenant => (
                            <button key={tenant.id} onClick={() => setSelectedId(tenant.id)}
                                className={cn("w-full text-left rounded-xl border p-3 transition-all",
                                    selectedId === tenant.id
                                        ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                                        : "bg-card border-border hover:bg-accent/50")}>
                                <div className="flex items-center gap-2">
                                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <Building2 className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-medium text-foreground truncate">{tenant.name}</span>
                                            {tenant.is_active ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-xs text-muted-foreground font-mono">{tenant.slug}</span>
                                            <Badge variant={tenant.plan === "enterprise" ? "default" : tenant.plan === "pro" ? "secondary" : "outline"} className="text-xs px-1.5 py-0">{tenant.plan}</Badge>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                </div>
            </div>

            {/* Painel de métricas */}
            <div className="flex-1 min-w-0 overflow-y-auto">
                {!selectedId ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                        <BarChart3 className="h-12 w-12 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">Selecione um infoprodutor para ver as métricas</p>
                    </div>
                ) : <MetricsPanel tenantId={selectedId} tenant={selectedTenant} />}
            </div>
        </div>
    );
}

// ── Painel com tabs Macro / Micro ─────────────────────────────────────────────

function MetricsPanel({ tenantId, tenant }: { tenantId: string; tenant: Tenant | null }) {
    const [tab, setTab] = useState<"macro" | "micro">("macro");
    return (
        <div className="space-y-4 pb-6">
            <div>
                <h2 className="font-display text-xl font-bold text-foreground">{tenant?.name ?? "..."}</h2>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{tenant?.slug}</p>
            </div>
            <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
                {([{ key: "macro", label: "Visão Geral" }, { key: "micro", label: "Por Aluno" }] as const).map(({ key, label }) => (
                    <button key={key} onClick={() => setTab(key)}
                        className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                            tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                        {label}
                    </button>
                ))}
            </div>
            {tab === "macro" && <MacroView tenantId={tenantId} />}
            {tab === "micro" && <MicroView tenantId={tenantId} />}
        </div>
    );
}

// ── Visão Macro ───────────────────────────────────────────────────────────────

function MacroView({ tenantId }: { tenantId: string }) {
    const { data: tracking, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery<TrackingMacro>({
        queryKey: ["tenant-tracking", tenantId],
        queryFn: () => apiClient.get(`/tenants/${tenantId}/tracking`).then(r => r.data),
        staleTime: 5 * 60 * 1000,
    });
    const semanas = tracking?.performance_semanal ?? [];
    const semanaAtual = semanas[semanas.length - 1];
    const semanaAnterior = semanas[semanas.length - 2];
    const evolucao = semanaAtual && semanaAnterior && semanaAnterior.accuracy_pct > 0
        ? +(semanaAtual.accuracy_pct - semanaAnterior.accuracy_pct).toFixed(1) : null;
    const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;

    if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl animate-pulse" />)}</div>;
    if (isError) return <ErrorState onRetry={refetch} />;
    if (!tracking) return null;

    return (
        <div className="space-y-6">
            <div className="flex justify-end items-center gap-2">
                {updatedAt && <span className="text-xs text-muted-foreground">Atualizado às {updatedAt}</span>}
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
                    <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
                </Button>
            </div>

            {(tracking.warnings ?? []).length > 0 && (
                <div className="rounded-xl border border-warning/20 bg-warning/5 p-3 space-y-1">
                    {tracking.warnings!.map((w, i) => <p key={i} className="text-xs text-warning font-medium">⚠ {w}</p>)}
                </div>
            )}

            <section>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Engajamento</p>
                <div className="grid grid-cols-3 gap-3">
                    <MetricCard icon={Users} label="Total de alunos" value={tracking.total_students} sub="Cadastrados no tenant" />
                    <MetricCard icon={Zap} label="Taxa de Ativação" value={<PctBadge value={tracking.taxa_ativacao} />} sub="Realizaram ao menos 1 evento-chave" />
                    <MetricCard icon={Activity} label="DAU" value={tracking.dau} sub="Usuários únicos ativos hoje" />
                    <MetricCard icon={Activity} label="MAU" value={tracking.mau} sub="Usuários únicos — últimos 30 dias" />
                    <MetricCard icon={TrendingUp} label="Stickiness" value={<PctBadge value={tracking.stickiness} thresholds={[10, 25]} />} sub="DAU ÷ MAU — recorrência de uso" highlight />
                </div>
            </section>

            <section>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Retenção</p>
                <div className="grid grid-cols-2 gap-3">
                    <MetricCard icon={RefreshCw} label="Retorno D1" value={<PctBadge value={tracking.retorno_d1} />}
                        sub={`Voltaram no dia seguinte ao 1° acesso real (base: ${tracking.d1_eligible} alunos)`} />
                    <MetricCard icon={RefreshCw} label="Retorno D7" value={<PctBadge value={tracking.retorno_d7} />}
                        sub={`Voltaram em algum dia da 1ª semana (base: ${tracking.d7_eligible} alunos)`} />
                </div>
            </section>

            <section>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Uso por funcionalidade</p>
                    <span className="text-xs text-muted-foreground">{tracking.total_events.toLocaleString("pt-BR")} eventos totais</span>
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
                                        <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${item.pct}%` }} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Performance semanal — questões</p>
                {semanaAtual && (
                    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 mb-3">
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">Semana atual</p>
                            <p className="text-2xl font-bold text-foreground">{semanaAtual.accuracy_pct}%<span className="text-sm text-muted-foreground font-normal ml-2">de acerto</span></p>
                            <p className="text-xs text-muted-foreground mt-0.5">{semanaAtual.correct.toLocaleString("pt-BR")} acertos de {semanaAtual.total_questions.toLocaleString("pt-BR")} questões</p>
                        </div>
                        {evolucao !== null && (
                            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold ${evolucao > 0 ? "bg-success/10 text-success" : evolucao < 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                                {evolucao > 0 ? <TrendingUp className="h-4 w-4" /> : evolucao < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                                {evolucao > 0 ? "+" : ""}{evolucao}pp vs semana anterior
                            </div>
                        )}
                    </div>
                )}
                <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50 border-b border-border">
                                {["Período", "Questões", "Acertos", "Erros", "% Acerto"].map((h, i) => (
                                    <th key={h} className={`text-xs font-semibold text-muted-foreground px-4 py-2.5 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {semanas.map((s, i) => {
                                const isCurrent = i === semanas.length - 1;
                                return (
                                    <tr key={s.week_start} className={`border-b border-border last:border-0 ${isCurrent ? "bg-primary/5 font-medium" : ""}`}>
                                        <td className="px-4 py-3">
                                            <span className={`text-sm ${isCurrent ? "text-primary font-semibold" : "text-foreground"}`}>{s.label}</span>
                                            <span className="block text-xs text-muted-foreground font-normal">{fmtDate(s.week_start)} – {fmtDate(s.week_end)}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums text-foreground">{s.total_questions.toLocaleString("pt-BR")}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-success font-medium">{s.correct.toLocaleString("pt-BR")}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-destructive font-medium">{(s.total_questions - s.correct).toLocaleString("pt-BR")}</td>
                                        <td className="px-4 py-3 text-right"><PctBadge value={s.accuracy_pct} /></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

// ── Visão Micro (por aluno) ───────────────────────────────────────────────────

function MicroView({ tenantId }: { tenantId: string }) {
    const [sortKey, setSortKey] = useState<SortKey>("last_activity");
    const [sortAsc, setSortAsc] = useState(false);
    const [searchStudent, setSearchStudent] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery<TrackingMicro>({
        queryKey: ["tenant-tracking-students", tenantId],
        queryFn: () => apiClient.get(`/tenants/${tenantId}/tracking/students`).then(r => r.data),
        staleTime: 5 * 60 * 1000,
    });

    const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;

    function handleSort(k: SortKey) {
        if (sortKey === k) setSortAsc(!sortAsc);
        else { setSortKey(k); setSortAsc(k === "name"); }
    }

    const students = (data?.students ?? [])
        .filter(s => s.name.toLowerCase().includes(searchStudent.toLowerCase()) || s.email.toLowerCase().includes(searchStudent.toLowerCase()))
        .sort((a, b) => {
            const vals: Record<SortKey, any> = {
                name: [a.name, b.name], last_activity: [a.last_activity ?? "", b.last_activity ?? ""],
                days_active: [a.days_active, b.days_active], total_questions: [a.total_questions, b.total_questions],
                accuracy_pct: [a.accuracy_pct, b.accuracy_pct], activated: [a.activated ? 1 : 0, b.activated ? 1 : 0],
            };
            const [av, bv] = vals[sortKey];
            return sortAsc ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
        });

    function SortTh({ k, label, align = "right" }: { k: SortKey; label: string; align?: "left" | "right" | "center" }) {
        const active = sortKey === k;
        return (
            <th onClick={() => handleSort(k)} className={`text-${align} text-xs font-semibold text-muted-foreground px-3 py-2.5 cursor-pointer select-none whitespace-nowrap`}>
                <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""}`}>
                    {label}
                    {active ? (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </span>
            </th>
        );
    }

    if (isLoading) return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl animate-pulse" />)}</div>;
    if (isError) return <ErrorState onRetry={refetch} />;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input value={searchStudent} onChange={e => setSearchStudent(e.target.value)}
                        placeholder="Buscar aluno por nome ou e-mail..."
                        className="w-full h-9 pl-9 pr-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{students.length} alunos</span>
                {updatedAt && <span className="text-xs text-muted-foreground whitespace-nowrap">às {updatedAt}</span>}
                <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => refetch()} disabled={isFetching}>
                    <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                </Button>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50 border-b border-border">
                                <SortTh k="name" label="Aluno" align="left" />
                                <SortTh k="activated" label="Ativou" align="center" />
                                <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-2.5">D1</th>
                                <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-2.5">D7</th>
                                <SortTh k="last_activity" label="Último acesso" />
                                <SortTh k="days_active" label="Dias ativos" />
                                <SortTh k="total_questions" label="Questões" />
                                <SortTh k="accuracy_pct" label="% Acerto" />
                                <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2.5 whitespace-nowrap">Cronograma</th>
                                <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2.5">Aulas</th>
                                <th className="px-2 py-2.5 w-8" />
                            </tr>
                        </thead>
                        <tbody>
                            {students.map((s) => (
                                <>
                                    <tr key={s.id}
                                        className={cn("border-b border-border last:border-0 hover:bg-muted/20 transition-colors",
                                            !s.activated && "opacity-50")}>
                                        <td className="px-3 py-2.5">
                                            <p className="text-sm font-medium text-foreground truncate max-w-[150px]">{s.name}</p>
                                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">{s.email}</p>
                                        </td>
                                        <td className="px-3 py-2.5 text-center"><BoolIcon value={s.activated} /></td>
                                        <td className="px-3 py-2.5 text-center">
                                            {s.activated ? <BoolIcon value={s.retornou_d1} /> : <span className="text-xs text-muted-foreground">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            {s.activated ? <BoolIcon value={s.retornou_d7} /> : <span className="text-xs text-muted-foreground">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">{fmtDate(s.last_activity)}</td>
                                        <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{s.days_active}</td>
                                        <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{s.total_questions.toLocaleString("pt-BR")}</td>
                                        <td className="px-3 py-2.5 text-right">
                                            {s.total_questions > 0 ? <PctBadge value={s.accuracy_pct} /> : <span className="text-xs text-muted-foreground">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{s.schedule_checkins}</td>
                                        <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{s.lessons_watched}</td>
                                        <td className="px-2 py-2.5">
                                            <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                                                className="text-muted-foreground hover:text-foreground transition-colors">
                                                {expandedId === s.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedId === s.id && (
                                        <tr key={`${s.id}-exp`} className="bg-muted/20 border-b border-border">
                                            <td colSpan={11} className="px-4 py-4">
                                                <div className="space-y-3">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                        Evolução semanal — {s.name}
                                                    </p>
                                                    <div className="grid grid-cols-4 gap-2">
                                                        {s.performance_semanal.map((ps, pi) => {
                                                            const isCurrent = pi === s.performance_semanal.length - 1;
                                                            return (
                                                                <div key={ps.week_start} className={`rounded-lg border p-3 ${isCurrent ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
                                                                    <p className={`text-xs font-semibold mb-1 ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>{ps.label}</p>
                                                                    <p className="text-xs text-muted-foreground mb-2">{fmtDate(ps.week_start)} – {fmtDate(ps.week_end)}</p>
                                                                    {ps.total_questions > 0 ? (
                                                                        <>
                                                                            <p className="text-xl font-bold text-foreground">{ps.accuracy_pct}%</p>
                                                                            <div className="flex gap-2 text-xs mt-1">
                                                                                <span className="text-success">{ps.correct} ✓</span>
                                                                                <span className="text-destructive">{ps.total_questions - ps.correct} ✗</span>
                                                                                <span className="text-muted-foreground">{ps.total_questions} total</span>
                                                                            </div>
                                                                        </>
                                                                    ) : (
                                                                        <p className="text-xs text-muted-foreground">Sem questões</p>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="flex gap-6 text-xs text-muted-foreground pt-1">
                                                        <span>1° acesso real: <strong className="text-foreground">{fmtDate(s.first_activity)}</strong></span>
                                                        <span>Cadastro: <strong className="text-foreground">{fmtDate(s.created_at)}</strong></span>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ── Shared error state ────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
            <XCircle className="h-10 w-10 text-destructive/40" />
            <p className="text-sm text-muted-foreground">Erro ao carregar métricas.</p>
            <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw className="h-4 w-4 mr-1.5" /> Tentar novamente</Button>
        </div>
    );
}