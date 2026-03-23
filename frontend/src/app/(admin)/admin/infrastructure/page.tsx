// frontend/src/app/(admin)/admin/infrastructure/page.tsx
"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import {
    Server, Database, Zap, Shield, DollarSign,
    RefreshCw, Activity, AlertTriangle, CheckCircle2,
    XCircle, Search, Terminal, TrendingDown,
    Plus, Minus, Info,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toaster";

// ── Types ──────────────────────────────────────────────────────────────────

interface ECSService {
    name: string;
    status: string;
    running_count: number;
    desired_count: number;
    pending_count: number;
    task_definition: string;
    metrics?: { cpu_percent: number | null; mem_percent: number | null; cpu_history: number[]; mem_history: number[] };
    deployments: { status: string; running_count: number; desired_count: number }[];
}

interface InfraOverview {
    region: string;
    project: string;
    generated_at: string;
    ecs: { cluster: string; services: ECSService[] };
    rds: { identifier: string; status: string; engine: string; instance_class: string; storage_gb: number; multi_az: boolean; backup_retention: number } | null;
    redis: { id: string; status: string; at_rest_encryption: boolean; in_transit_encryption: boolean } | null;
    costs: { total_30d_usd: number; daily_avg_usd: number; breakdown: { service: string; total_usd: number; daily_avg_usd: number }[] };
    security: { findings: { severity: string; type: string; resource: string; description: string; samples?: string[] }[]; critical_count: number; warning_count: number };
}

interface Recommendation {
    priority: "HIGH" | "MEDIUM" | "LOW" | "INFO" | "OK";
    category: string;
    resource: string;
    title: string;
    description: string;
    action: string;
    current_value?: number;
    recommended_value?: number;
    estimated_saving_monthly_usd: number;
}

interface LogEvent { timestamp: string; message: string; log_stream: string }

// ── Mini sparkline ─────────────────────────────────────────────────────────

function Sparkline({ values, color = "#7F77DD" }: { values: number[]; color?: string }) {
    if (!values?.length) return <span className="text-xs text-muted-foreground">—</span>;
    const max = Math.max(...values, 1);
    const pts = values.map((v, i) => `${(i / (values.length - 1)) * 60},${18 - (v / max) * 16}`).join(" ");
    return (
        <svg width="60" height="20" className="inline-block">
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// ── Usage bar ──────────────────────────────────────────────────────────────

function UsageBar({ value, label }: { value: number | null; label: string }) {
    const pct = value ?? 0;
    const color = pct > 80 ? "bg-destructive" : pct > 60 ? "bg-warning" : "bg-primary";
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value !== null ? `${value}%` : "—"}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

// ── Status dot ─────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
    const ok = ["active", "available", "in-sync"].includes(status?.toLowerCase());
    return (
        <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full", ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-success" : "bg-destructive")} />
            {status ?? "unknown"}
        </span>
    );
}

// ── Scale control ──────────────────────────────────────────────────────────

function ScaleControl({ service, currentDesired, onScale }: {
    service: string;
    currentDesired: number;
    onScale: (service: string, count: number) => void;
}) {
    const shortName = service.replace("concurso-platform-", "");
    return (
        <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16">{shortName}</span>
            <button
                onClick={() => onScale(shortName, Math.max(1, currentDesired - 1))}
                disabled={currentDesired <= 1}
                className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                <Minus className="h-3 w-3" />
            </button>
            <span className="w-6 text-center text-sm font-bold text-foreground">{currentDesired}</span>
            <button
                onClick={() => onScale(shortName, Math.min(10, currentDesired + 1))}
                disabled={currentDesired >= 10}
                className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                <Plus className="h-3 w-3" />
            </button>
            <span className="text-xs text-muted-foreground">tasks</span>
        </div>
    );
}

// ── Main ───────────────────────────────────────────────────────────────────

type Tab = "overview" | "resources" | "logs" | "security" | "costs";

export default function InfrastructurePage() {
    const [activeTab, setActiveTab] = useState<Tab>("overview");
    const [logService, setLogService] = useState<"api" | "frontend">("api");
    const [logSearch, setLogSearch] = useState("");
    const [logSearchQuery, setLogSearchQuery] = useState("");
    const toast = useToast();
    const queryClient = useQueryClient();

    const { data: overview, isLoading, refetch, dataUpdatedAt } = useQuery<InfraOverview>({
        queryKey: ["admin", "infra", "overview"],
        queryFn: () => apiClient.get("/admin/infrastructure/overview").then(r => r.data),
        refetchInterval: 60_000,
        staleTime: 30_000,
    });

    const { data: optimizationData, isLoading: optLoading } = useQuery<{
        recommendations: Recommendation[];
        total_estimated_saving_monthly_usd: number;
    }>({
        queryKey: ["admin", "infra", "optimization"],
        queryFn: () => apiClient.get("/admin/infrastructure/cost-optimization").then(r => r.data),
        enabled: activeTab === "costs",
        staleTime: 120_000,
    });

    const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery<{
        events: LogEvent[]; count: number; log_group: string;
    }>({
        queryKey: ["admin", "infra", "logs", logService, logSearchQuery],
        queryFn: () => apiClient.get("/admin/infrastructure/logs", {
            params: { service: logService, search: logSearchQuery || undefined, limit: 100 },
        }).then(r => r.data),
        enabled: activeTab === "logs",
        staleTime: 10_000,
    });

    const scaleMutation = useMutation({
        mutationFn: ({ service, desired_count }: { service: string; desired_count: number }) =>
            apiClient.post("/admin/infrastructure/scale", { service, desired_count }).then(r => r.data),
        onSuccess: (data) => {
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: ["admin", "infra", "overview"] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || "Erro ao escalar serviço");
        },
    });

    const handleScale = useCallback((service: string, count: number) => {
        scaleMutation.mutate({ service, desired_count: count });
    }, [scaleMutation]);

    const handleLogSearch = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        setLogSearchQuery(logSearch);
    }, [logSearch]);

    const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR") : null;
    const criticalCount = overview?.security.critical_count ?? 0;

    const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
        { id: "overview", label: "Visão Geral", icon: Activity },
        { id: "resources", label: "Recursos", icon: Server },
        { id: "logs", label: "Logs", icon: Terminal },
        { id: "security", label: "Segurança", icon: Shield },
        { id: "costs", label: "Custos", icon: DollarSign },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title="Infraestrutura AWS"
                description={`Região: ${overview?.region ?? "sa-east-1"} • ${lastUpdated ? `Atualizado às ${lastUpdated}` : "Carregando..."}`}
                action={
                    <Button variant="outline" size="sm" onClick={() => { refetch(); if (activeTab === "logs") refetchLogs(); }} disabled={isLoading}>
                        <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isLoading && "animate-spin")} />
                        Atualizar
                    </Button>
                }
            />

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border overflow-x-auto">
                {tabs.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setActiveTab(id)} className={cn(
                        "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                        activeTab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                    )}>
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                        {id === "security" && criticalCount > 0 && (
                            <span className="ml-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">{criticalCount}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── OVERVIEW ── */}
            {activeTab === "overview" && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <KpiCard label="Serviços ECS" value={isLoading ? null : overview?.ecs.services.length ?? 0} sub={`${overview?.ecs.services.filter(s => s.status === "ACTIVE").length ?? 0} ativos`} icon={<Server className="h-4 w-4" />} loading={isLoading} />
                        <KpiCard label="Tasks rodando" value={isLoading ? null : overview?.ecs.services.reduce((a, s) => a + s.running_count, 0) ?? 0} sub="total de containers" icon={<Activity className="h-4 w-4" />} loading={isLoading} />
                        <KpiCard label="Custo/dia (30d avg)" value={isLoading ? null : `$${overview?.costs.daily_avg_usd ?? 0}`} sub={`$${overview?.costs.total_30d_usd ?? 0} / 30 dias`} icon={<DollarSign className="h-4 w-4" />} loading={isLoading} />
                        <KpiCard label="Alertas segurança" value={isLoading ? null : criticalCount + (overview?.security.warning_count ?? 0)} sub={criticalCount > 0 ? `${criticalCount} críticos` : "nenhum crítico"} icon={<Shield className="h-4 w-4" />} loading={isLoading} alert={criticalCount > 0} />
                    </div>

                    {/* ECS cards + scale controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {isLoading ? [1, 2].map(i => <Skeleton key={i} className="h-52 rounded-xl" />) :
                            overview?.ecs.services.map(svc => (
                                <Card key={svc.name}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm flex items-center justify-between">
                                            <span className="flex items-center gap-2">
                                                <Server className="h-4 w-4" />
                                                {svc.name.replace("concurso-platform-", "")}
                                            </span>
                                            <StatusDot status={svc.status} />
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className={cn("text-xl font-bold", svc.running_count >= svc.desired_count ? "text-success" : "text-destructive")}>{svc.running_count}</span>
                                            <span className="text-muted-foreground">/ {svc.desired_count} tasks</span>
                                            {svc.pending_count > 0 && <Badge variant="outline" className="text-[10px]">{svc.pending_count} pendente</Badge>}
                                        </div>
                                        {svc.metrics && (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1"><UsageBar value={svc.metrics.cpu_percent} label="CPU" /></div>
                                                    <Sparkline values={svc.metrics.cpu_history} color="#7F77DD" />
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1"><UsageBar value={svc.metrics.mem_percent} label="Memória" /></div>
                                                    <Sparkline values={svc.metrics.mem_history} color="#1D9E75" />
                                                </div>
                                            </div>
                                        )}
                                        {/* Scaling inline */}
                                        <div className="pt-2 border-t border-border">
                                            <p className="text-xs text-muted-foreground mb-2">Escalar</p>
                                            <ScaleControl
                                                service={svc.name}
                                                currentDesired={svc.desired_count}
                                                onScale={handleScale}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        }
                    </div>

                    {/* RDS + Redis */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {isLoading ? <Skeleton className="h-36 rounded-xl" /> : overview?.rds ? (
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4 text-blue-500" />PostgreSQL RDS</CardTitle></CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    {[
                                        { l: "Status", v: <StatusDot status={overview.rds.status} /> },
                                        { l: "Engine", v: overview.rds.engine },
                                        { l: "Classe", v: overview.rds.instance_class },
                                        { l: "Storage", v: `${overview.rds.storage_gb} GB` },
                                        { l: "Multi-AZ", v: overview.rds.multi_az ? "✓ Sim" : "✗ Não" },
                                    ].map(({ l, v }) => (
                                        <div key={l} className="flex justify-between">
                                            <span className="text-muted-foreground">{l}</span>
                                            <span className="font-medium">{v}</span>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="flex items-center justify-center h-36 text-muted-foreground text-sm">RDS não encontrado / sem permissões IAM</Card>
                        )}

                        {isLoading ? <Skeleton className="h-36 rounded-xl" /> : overview?.redis ? (
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-red-500" />Redis ElastiCache</CardTitle></CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    {[
                                        { l: "Status", v: <StatusDot status={overview.redis.status} /> },
                                        { l: "ID", v: <span className="font-mono text-xs">{overview.redis.id}</span> },
                                        { l: "Criptografia em repouso", v: overview.redis.at_rest_encryption ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" /> },
                                        { l: "TLS (in-transit)", v: overview.redis.in_transit_encryption ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" /> },
                                    ].map(({ l, v }) => (
                                        <div key={l} className="flex justify-between items-center">
                                            <span className="text-muted-foreground">{l}</span>
                                            <span className="font-medium">{v}</span>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="flex items-center justify-center h-36 text-muted-foreground text-sm">Redis não encontrado / sem permissões IAM</Card>
                        )}
                    </div>
                </div>
            )}

            {/* ── RESOURCES ── */}
            {activeTab === "resources" && (
                <div className="space-y-4">
                    {/* Scale panel */}
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Server className="h-4 w-4 text-primary" />
                                Controle de Escala ECS
                                {scaleMutation.isPending && <span className="text-xs text-muted-foreground animate-pulse ml-2">Atualizando...</span>}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {isLoading ? <Skeleton className="h-8 w-48" /> :
                                    overview?.ecs.services.map(svc => (
                                        <div key={svc.name} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{svc.name.replace("concurso-platform-", "")}</p>
                                                <p className="text-xs text-muted-foreground">{svc.running_count} rodando</p>
                                            </div>
                                            <ScaleControl
                                                service={svc.name}
                                                currentDesired={svc.desired_count}
                                                onScale={handleScale}
                                            />
                                        </div>
                                    ))
                                }
                            </div>
                            <p className="text-xs text-muted-foreground mt-3">
                                Alterações aplicam imediatamente no ECS. Tasks novas levam ~30s para subir.
                            </p>
                        </CardContent>
                    </Card>

                    {isLoading ? [1, 2].map(i => <Skeleton key={i} className="h-64 rounded-xl" />) :
                        overview?.ecs.services.map(svc => (
                            <Card key={svc.name}>
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between text-base">
                                        <span className="flex items-center gap-2"><Server className="h-4 w-4" />{svc.name}</span>
                                        <StatusDot status={svc.status} />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-3 gap-3 text-sm">
                                        {[
                                            { v: svc.running_count, l: "Tasks rodando" },
                                            { v: svc.desired_count, l: "Desejado" },
                                            { v: svc.pending_count, l: "Pendente" },
                                        ].map(({ v, l }) => (
                                            <div key={l} className="text-center p-3 bg-muted/40 rounded-lg">
                                                <p className="text-2xl font-bold text-foreground">{v}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{l}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {svc.metrics && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-4"><div className="flex-1"><UsageBar value={svc.metrics.cpu_percent} label="CPU" /></div><Sparkline values={svc.metrics.cpu_history} color="#7F77DD" /></div>
                                            <div className="flex items-center gap-4"><div className="flex-1"><UsageBar value={svc.metrics.mem_percent} label="Memória" /></div><Sparkline values={svc.metrics.mem_history} color="#1D9E75" /></div>
                                        </div>
                                    )}
                                    <div className="pt-2 border-t border-border">
                                        <p className="text-xs text-muted-foreground font-mono">{svc.task_definition}</p>
                                    </div>
                                    {svc.deployments.length > 0 && (
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-2">Deployments</p>
                                            {svc.deployments.map((d, i) => (
                                                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                                                    <Badge variant={d.status === "PRIMARY" ? "default" : "outline"} className="text-[10px]">{d.status}</Badge>
                                                    <span className="text-muted-foreground">{d.running_count}/{d.desired_count} tasks</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    }
                </div>
            )}

            {/* ── LOGS ── */}
            {activeTab === "logs" && (
                <div className="space-y-4">
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex gap-2">
                                    {(["api", "frontend"] as const).map(s => (
                                        <button key={s} onClick={() => setLogService(s)} className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors", logService === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>{s}</button>
                                    ))}
                                </div>
                                <form onSubmit={handleLogSearch} className="flex-1 flex gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input value={logSearch} onChange={e => setLogSearch(e.target.value)} placeholder="Filtrar: ERROR, 500, user_id..." className="pl-9 text-sm" />
                                    </div>
                                    <Button type="submit" size="sm" variant="outline">Filtrar</Button>
                                    {logSearchQuery && <Button type="button" size="sm" variant="ghost" onClick={() => { setLogSearch(""); setLogSearchQuery(""); }}>Limpar</Button>}
                                </form>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center justify-between">
                                <span className="flex items-center gap-2"><Terminal className="h-4 w-4" />{logsData?.log_group ?? `/ecs/concurso-platform/${logService}`}</span>
                                <span className="text-xs text-muted-foreground font-normal">{logsData?.count ?? 0} eventos</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {logsLoading ? <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 rounded" />)}</div>
                                : logsData?.events.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Nenhum log encontrado{logSearchQuery ? ` para "${logSearchQuery}"` : ""}</p>
                                    : (
                                        <div className="bg-[#0d1117] rounded-lg p-4 overflow-x-auto max-h-[500px] overflow-y-auto font-mono text-xs space-y-1">
                                            {logsData?.events.map((evt, i) => <LogLine key={i} event={evt} />)}
                                        </div>
                                    )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ── SECURITY ── */}
            {activeTab === "security" && (
                <div className="space-y-4">
                    {isLoading ? <Skeleton className="h-64 rounded-xl" /> : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <SecurityKpi label="Críticos" value={overview?.security.critical_count ?? 0} color="destructive" icon={<XCircle className="h-5 w-5" />} />
                                <SecurityKpi label="Avisos" value={overview?.security.warning_count ?? 0} color="warning" icon={<AlertTriangle className="h-5 w-5" />} />
                                <SecurityKpi label="Verificações OK" value={overview?.security.findings.filter(f => f.severity === "OK").length ?? 0} color="success" icon={<CheckCircle2 className="h-5 w-5" />} />
                            </div>
                            <Card>
                                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" />Findings de Segurança</CardTitle></CardHeader>
                                <CardContent className="space-y-3">
                                    {overview?.security.findings.map((f, i) => (
                                        <div key={i} className={cn("p-3 rounded-lg border", f.severity === "HIGH" && "border-destructive/30 bg-destructive/5", f.severity === "MEDIUM" && "border-warning/30 bg-warning/5", f.severity === "OK" && "border-success/30 bg-success/5")}>
                                            <div className="flex items-start gap-3">
                                                <span className="mt-0.5">{f.severity === "HIGH" && <XCircle className="h-4 w-4 text-destructive" />}{f.severity === "MEDIUM" && <AlertTriangle className="h-4 w-4 text-warning" />}{f.severity === "OK" && <CheckCircle2 className="h-4 w-4 text-success" />}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-medium">{f.description}</p>
                                                        <Badge variant="outline" className="text-[10px] shrink-0">{f.resource}</Badge>
                                                    </div>
                                                    {f.samples?.map((s, j) => <p key={j} className="text-xs text-muted-foreground font-mono truncate mt-1">{s}</p>)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle className="text-sm">Checklist de Criptografia</CardTitle></CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    {[
                                        { l: "Redis in-transit TLS", ok: overview?.redis?.in_transit_encryption ?? false },
                                        { l: "Redis at-rest encryption", ok: overview?.redis?.at_rest_encryption ?? false },
                                        { l: "RDS backup habilitado", ok: (overview?.rds?.backup_retention ?? 0) > 0 },
                                        { l: "RDS Multi-AZ", ok: overview?.rds?.multi_az ?? false },
                                    ].map(({ l, ok }) => (
                                        <div key={l} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                                            <span className="text-muted-foreground">{l}</span>
                                            {ok ? <span className="flex items-center gap-1 text-success text-xs"><CheckCircle2 className="h-3.5 w-3.5" />Habilitado</span>
                                                : <span className="flex items-center gap-1 text-destructive text-xs"><XCircle className="h-3.5 w-3.5" />Desabilitado</span>}
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            )}

            {/* ── COSTS ── */}
            {activeTab === "costs" && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card><CardContent className="pt-6 text-center">
                            <p className="text-4xl font-bold">{isLoading ? "—" : `$${overview?.costs.total_30d_usd ?? 0}`}</p>
                            <p className="text-sm text-muted-foreground mt-1">Total 30 dias</p>
                        </CardContent></Card>
                        <Card><CardContent className="pt-6 text-center">
                            <p className="text-4xl font-bold">{isLoading ? "—" : `$${overview?.costs.daily_avg_usd ?? 0}`}</p>
                            <p className="text-sm text-muted-foreground mt-1">Média/dia</p>
                        </CardContent></Card>
                        <Card className="border-success/30 bg-success/5"><CardContent className="pt-6 text-center">
                            <p className="text-4xl font-bold text-success">{optLoading ? "—" : `$${optimizationData?.total_estimated_saving_monthly_usd ?? 0}`}</p>
                            <p className="text-sm text-muted-foreground mt-1">Economia potencial/mês</p>
                        </CardContent></Card>
                    </div>

                    {/* Breakdown */}
                    <Card>
                        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" />Breakdown por Serviço AWS</CardTitle></CardHeader>
                        <CardContent>
                            {isLoading ? <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded" />)}</div>
                                : overview?.costs.breakdown.length === 0
                                    ? <p className="text-sm text-muted-foreground text-center py-6">Dados de custo não disponíveis — verifique as permissões do Cost Explorer (<code className="text-xs bg-muted px-1 rounded">ce:GetCostAndUsage</code>) na IAM Role da task.</p>
                                    : (
                                        <div className="space-y-3">
                                            {overview?.costs.breakdown.map((item, i) => {
                                                const pct = (item.total_usd / (overview.costs.total_30d_usd || 1)) * 100;
                                                return (
                                                    <div key={i} className="space-y-1">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="truncate max-w-[60%]">{item.service}</span>
                                                            <span className="font-medium">${item.total_usd}</span>
                                                        </div>
                                                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                                                        </div>
                                                        <p className="text-xs text-muted-foreground text-right">~${item.daily_avg_usd}/dia · {pct.toFixed(1)}%</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                        </CardContent>
                    </Card>

                    {/* Recommendations */}
                    <Card>
                        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4 text-success" />Recomendações de Otimização</CardTitle></CardHeader>
                        <CardContent>
                            {optLoading ? <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded" />)}</div>
                                : (
                                    <div className="space-y-3">
                                        {optimizationData?.recommendations.map((rec, i) => (
                                            <div key={i} className={cn("p-4 rounded-lg border", rec.priority === "HIGH" && "border-success/30 bg-success/5", rec.priority === "MEDIUM" && "border-warning/30 bg-warning/5", rec.priority === "LOW" && "border-border bg-muted/30", ["INFO", "OK"].includes(rec.priority) && "border-border")}>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-start gap-3 flex-1">
                                                        <span className="mt-0.5 shrink-0">
                                                            {rec.priority === "HIGH" && <TrendingDown className="h-4 w-4 text-success" />}
                                                            {rec.priority === "MEDIUM" && <AlertTriangle className="h-4 w-4 text-warning" />}
                                                            {rec.priority === "OK" && <CheckCircle2 className="h-4 w-4 text-success" />}
                                                            {["LOW", "INFO"].includes(rec.priority) && <Info className="h-4 w-4 text-muted-foreground" />}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="text-sm font-medium">{rec.title}</p>
                                                                <Badge variant="outline" className="text-[10px]">{rec.category}</Badge>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        {rec.estimated_saving_monthly_usd > 0 && (
                                                            <p className="text-sm font-bold text-success">-${rec.estimated_saving_monthly_usd}/mês</p>
                                                        )}
                                                        {rec.action === "scale_down" && rec.recommended_value !== undefined && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="mt-1 text-xs h-7"
                                                                onClick={() => {
                                                                    const svcName = rec.resource.replace("concurso-platform-", "");
                                                                    handleScale(svcName, rec.recommended_value!);
                                                                }}
                                                                disabled={scaleMutation.isPending}
                                                            >
                                                                Aplicar
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, loading, alert }: { label: string; value: any; sub: string; icon: React.ReactNode; loading?: boolean; alert?: boolean }) {
    return (
        <Card className={cn(alert && "border-destructive/40")}>
            <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground font-medium">{label}</p>
                    <span className={cn("text-muted-foreground", alert && "text-destructive")}>{icon}</span>
                </div>
                {loading ? <Skeleton className="h-8 w-20 rounded" /> : <p className={cn("text-2xl font-bold", alert ? "text-destructive" : "text-foreground")}>{value}</p>}
                <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
        </Card>
    );
}

function SecurityKpi({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
    return (
        <Card>
            <CardContent className="pt-4 flex items-center gap-4">
                <span className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", color === "destructive" && "bg-destructive/10 text-destructive", color === "warning" && "bg-warning/10 text-warning", color === "success" && "bg-success/10 text-success")}>{icon}</span>
                <div>
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function LogLine({ event }: { event: LogEvent }) {
    const isError = /error|500/i.test(event.message);
    const isWarn = /warn|4\d\d/i.test(event.message);
    const time = new Date(event.timestamp).toLocaleTimeString("pt-BR");
    return (
        <div className={cn("flex gap-3 hover:bg-white/5 px-1 py-0.5 rounded", isError && "text-red-400", isWarn && !isError && "text-yellow-400", !isError && !isWarn && "text-green-300/80")}>
            <span className="text-gray-500 shrink-0 select-none">{time}</span>
            <span className="break-all">{event.message}</span>
        </div>
    );
}