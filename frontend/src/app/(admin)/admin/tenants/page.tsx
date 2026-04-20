// frontend/src/app/(admin)/admin/tenants/page.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils/cn";
import {
    Building2, Plus, Globe, CheckCircle2, XCircle,
    Pencil, Trash2, User, Settings, ChevronDown, ChevronUp,
    AlertTriangle, ExternalLink, BarChart3, RefreshCw,
    TrendingUp, TrendingDown, Activity, Zap, BookOpen,
    CalendarCheck, HelpCircle, Minus, Users,
} from "lucide-react";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TenantAdmin { id: string; name: string; email: string }
interface Tenant {
    id: string; name: string; slug: string; plan: string;
    is_active: boolean; custom_domain: string | null;
    features: Record<string, boolean>; branding: Record<string, any>;
    created_at: string; admin: TenantAdmin | null;
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
}

const ALL_FEATURES: { key: string; label: string }[] = [
    { key: "ai_features", label: "IA (geral)" },
    { key: "ai_question_extract", label: "Extração de questões por IA" },
    { key: "ai_schedule", label: "Cronograma inteligente" },
    { key: "ai_tutor_chat", label: "Tutor IA" },
    { key: "analytics_producer", label: "Analytics do produtor" },
    { key: "simulados", label: "Simulados" },
    { key: "question_bank_concursos", label: "Banco de questões concursos" },
    { key: "video_hosting", label: "Hospedagem de vídeos" },
];

const PLATFORM_DOMAIN = "launcheredu.com.br";

// ── Helpers de métricas ───────────────────────────────────────────────────────

function PctBadge({ value, thresholds }: { value: number; thresholds?: [number, number] }) {
    const t = thresholds ?? [30, 60];
    const color =
        value >= t[1] ? "bg-success/10 text-success border-success/20"
            : value >= t[0] ? "bg-warning/10 text-warning border-warning/20"
                : "bg-destructive/10 text-destructive border-destructive/20";
    return (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}>
            {value}%
        </span>
    );
}

function MetricCard({ icon: Icon, label, value, sub, highlight }: {
    icon: React.ElementType; label: string; value: React.ReactNode;
    sub?: React.ReactNode; highlight?: boolean;
}) {
    return (
        <div className={`rounded-xl border border-border p-3 space-y-1 ${highlight ? "bg-primary/5 border-primary/20" : "bg-card"}`}>
            <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon className="h-3 w-3" />
                <span className="text-xs uppercase tracking-wider font-medium">{label}</span>
            </div>
            <div className="text-xl font-bold text-foreground">{value}</div>
            {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
    );
}

const FuncIcon: Record<string, React.ElementType> = {
    questoes: HelpCircle,
    cronograma: CalendarCheck,
    aulas: BookOpen,
};

// ── Página principal ──────────────────────────────────────────────────────────

export default function TenantsPage() {
    const [showCreate, setShowCreate] = useState(false);
    const [editTenant, setEditTenant] = useState<Tenant | null>(null);
    const [deleteTenant, setDeleteTenant] = useState<Tenant | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const toast = useToast();
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: QUERY_KEYS.TENANTS,
        queryFn: () => apiClient.get("/tenants/").then(r => r.data.tenants),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiClient.delete(`/tenants/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TENANTS });
            toast.success("Tenant removido.");
            setDeleteTenant(null);
        },
        onError: () => toast.error("Erro ao remover tenant"),
    });

    const tenants: Tenant[] = data || [];

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">Tenants</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {tenants.length} infoprodutores cadastrados
                    </p>
                </div>
                <Button onClick={() => setShowCreate(true)}>
                    <Plus className="h-4 w-4" />Novo tenant
                </Button>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
                </div>
            ) : (
                <div className="space-y-3">
                    {tenants.map((tenant) => (
                        <TenantCard
                            key={tenant.id}
                            tenant={tenant}
                            expanded={expandedId === tenant.id}
                            onToggle={() => setExpandedId(expandedId === tenant.id ? null : tenant.id)}
                            onEdit={() => setEditTenant(tenant)}
                            onDelete={() => setDeleteTenant(tenant)}
                        />
                    ))}
                </div>
            )}

            <CreateTenantModal open={showCreate} onClose={() => setShowCreate(false)} />

            {editTenant && (
                <EditTenantModal tenant={editTenant} onClose={() => setEditTenant(null)} />
            )}

            <Dialog open={!!deleteTenant} onOpenChange={v => { if (!v) setDeleteTenant(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <Trash2 className="h-5 w-5" />Confirmar exclusão
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <p className="text-sm text-foreground">
                            Tem certeza que deseja remover o tenant <strong>"{deleteTenant?.name}"</strong>?
                        </p>
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                            <p className="text-xs text-destructive font-medium">
                                Todos os dados deste tenant serão desativados. Esta ação pode ser revertida pelo banco de dados.
                            </p>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
                            {deleteTenant?.slug}
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDeleteTenant(null)}>Cancelar</Button>
                        <Button variant="destructive"
                            loading={deleteMutation.isPending}
                            onClick={() => deleteTenant && deleteMutation.mutate(deleteTenant.id)}>
                            Sim, remover tenant
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ── Card de tenant ────────────────────────────────────────────────────────────

function TenantCard({ tenant, expanded, onToggle, onEdit, onDelete }: {
    tenant: Tenant; expanded: boolean;
    onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
    const featuresOn = Object.values(tenant.features || {}).filter(Boolean).length;
    const featuresTotal = ALL_FEATURES.length;

    return (
        <Card className={cn("overflow-hidden transition-all", !tenant.is_active && "opacity-60")}>
            <CardContent className="p-4">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground">{tenant.name}</p>
                            <Badge variant={tenant.plan === "enterprise" ? "default" : tenant.plan === "pro" ? "secondary" : "outline"}>
                                {tenant.plan}
                            </Badge>
                            {tenant.is_active
                                ? <CheckCircle2 className="h-4 w-4 text-success" />
                                : <XCircle className="h-4 w-4 text-destructive" />
                            }
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <p className="text-xs text-muted-foreground font-mono">{tenant.slug}</p>
                            {tenant.custom_domain && (
                                <p className="text-xs text-primary flex items-center gap-1">
                                    <Globe className="h-3 w-3" />{tenant.custom_domain}
                                </p>
                            )}
                            {tenant.admin && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <User className="h-3 w-3" />{tenant.admin.email}
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                                {featuresOn}/{featuresTotal} features ativas
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon-sm" onClick={onEdit} title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="hover:text-destructive" onClick={onDelete} title="Remover">
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={onToggle}>
                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>

                {expanded && (
                    <div className="mt-4 pt-4 border-t border-border space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Features ativas</p>
                        <div className="flex flex-wrap gap-2">
                            {ALL_FEATURES.map(f => (
                                <span key={f.key} className={cn(
                                    "text-xs px-2 py-0.5 rounded-full border",
                                    tenant.features?.[f.key]
                                        ? "bg-success/10 text-success border-success/20"
                                        : "bg-muted text-muted-foreground border-border"
                                )}>
                                    {tenant.features?.[f.key] ? "✓" : "✗"} {f.label}
                                </span>
                            ))}
                        </div>
                        {tenant.admin && (
                            <div className="mt-2 pt-2 border-t border-border">
                                <p className="text-xs text-muted-foreground">
                                    Admin: <strong className="text-foreground">{tenant.admin.name}</strong> · {tenant.admin.email}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ── Modal criar tenant ────────────────────────────────────────────────────────

function CreateTenantModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const toast = useToast();
    const queryClient = useQueryClient();
    const { register, handleSubmit, reset, formState: { errors } } = useForm({
        defaultValues: { name: "", slug: "", plan: "pro", admin_name: "", admin_email: "", admin_password: "" },
    });

    const mutation = useMutation({
        mutationFn: (d: any) => apiClient.post("/tenants/", d).then(r => r.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TENANTS });
            toast.success("Tenant criado!");
            onClose(); reset();
        },
        onError: () => toast.error("Erro ao criar tenant"),
    });

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); reset(); } }}>
            <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Novo infoprodutor</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Nome da empresa</label>
                            <Input {...register("name", { required: true })} placeholder="Ex: Curso Jurídico" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Slug (URL)</label>
                            <Input {...register("slug", { required: true })} placeholder="curso-juridico" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Plano</label>
                        <select {...register("plan")} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm">
                            <option value="basic">Basic</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                        </select>
                    </div>
                    <div className="pt-1 border-t border-border">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">ADMIN DO TENANT</p>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Nome do admin</label>
                                <Input {...register("admin_name", { required: true })} placeholder="João Silva" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">E-mail</label>
                                    <Input {...register("admin_email", { required: true })} type="email" placeholder="admin@empresa.com" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Senha</label>
                                    <Input {...register("admin_password", { required: true, minLength: 8 })} type="password" placeholder="Min. 8 caracteres" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => { onClose(); reset(); }}>Cancelar</Button>
                        <Button type="submit" loading={mutation.isPending}>Criar tenant</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── Modal editar tenant ───────────────────────────────────────────────────────

function EditTenantModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
    const toast = useToast();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<"info" | "features" | "admin" | "metrics">("info");
    const [features, setFeatures] = useState<Record<string, boolean>>(tenant.features || {});

    const { register: regInfo, handleSubmit: submitInfo, watch: watchInfo } = useForm({
        defaultValues: {
            name: tenant.name,
            slug: tenant.slug,
            plan: tenant.plan,
            custom_domain: tenant.custom_domain || "",
            is_active: tenant.is_active,
        },
    });

    const currentSlug = watchInfo("slug") ?? tenant.slug;
    const slugChanged = currentSlug.trim() !== tenant.slug;
    const newUrl = `https://${currentSlug.trim()}.${PLATFORM_DOMAIN}/`;

    const { register: regAdmin, handleSubmit: submitAdmin } = useForm({
        defaultValues: {
            name: tenant.admin?.name || "", email: tenant.admin?.email || "", password: "",
        },
    });

    // ── Tracking — lazy, carrega só quando a aba é aberta ────────────────────
    const {
        data: tracking,
        isLoading: trackingLoading,
        isError: trackingError,
        refetch: refetchTracking,
        isFetching: trackingFetching,
    } = useQuery<TrackingData>({
        queryKey: ["tenant-tracking", tenant.id],
        queryFn: async () => {
            const res = await apiClient.get(`/tenants/${tenant.id}/tracking`);
            return res.data;
        },
        enabled: tab === "metrics",
        staleTime: 5 * 60 * 1000,
    });

    const semanas = tracking?.performance_semanal ?? [];
    const semanaAtual = semanas[semanas.length - 1];
    const semanaAnterior = semanas[semanas.length - 2];
    const evolucao =
        semanaAtual && semanaAnterior && semanaAnterior.accuracy_pct > 0
            ? +(semanaAtual.accuracy_pct - semanaAnterior.accuracy_pct).toFixed(1)
            : null;

    const updateMutation = useMutation({
        mutationFn: (d: any) => apiClient.put(`/tenants/${tenant.id}`, d).then(r => r.data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TENANTS });
            if (data.slug_changed) {
                toast.success(`Slug alterado! Nova URL: ${newUrl}`);
            } else {
                toast.success("Tenant atualizado!");
            }
            onClose();
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.message;
            if (msg?.includes("slug")) {
                toast.error("Slug já em uso por outro tenant.");
            } else {
                toast.error("Erro ao atualizar tenant.");
            }
        },
    });

    const updateAdminMutation = useMutation({
        mutationFn: (d: any) => apiClient.put(`/tenants/${tenant.id}/admin`, d).then(r => r.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TENANTS });
            toast.success("Admin atualizado!");
            onClose();
        },
        onError: () => toast.error("Erro ao atualizar admin"),
    });

    const updateFeaturesMutation = useMutation({
        mutationFn: () => apiClient.put(`/tenants/${tenant.id}/features`, features).then(r => r.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TENANTS });
            toast.success("Features atualizadas!");
            onClose();
        },
        onError: () => toast.error("Erro ao atualizar features"),
    });

    const tabs = [
        { key: "info", label: "Dados", icon: Building2 },
        { key: "features", label: "Features", icon: Settings },
        { key: "admin", label: "Admin", icon: User },
        { key: "metrics", label: "Métricas", icon: BarChart3 },
    ] as const;

    return (
        <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
            {/* max-w-2xl na aba de métricas para dar espaço à tabela */}
            <DialogContent className={tab === "metrics" ? "max-w-2xl" : "max-w-md"}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="h-4 w-4" />Editar: {tenant.name}
                    </DialogTitle>
                </DialogHeader>

                {/* Tabs */}
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                    {tabs.map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setTab(key as any)}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all",
                                tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}>
                            <Icon className="h-3.5 w-3.5" />{label}
                        </button>
                    ))}
                </div>

                {/* Tab: Dados */}
                {tab === "info" && (
                    <form onSubmit={submitInfo(d => {
                        const payload: any = {
                            name: d.name, plan: d.plan,
                            is_active: d.is_active,
                            custom_domain: d.custom_domain || null,
                        };
                        const trimmedSlug = (d.slug ?? "").trim().toLowerCase();
                        if (trimmedSlug && trimmedSlug !== tenant.slug) {
                            payload.slug = trimmedSlug;
                        }
                        updateMutation.mutate(payload);
                    })} className="space-y-3">

                        <div className="space-y-1">
                            <label className="text-sm font-medium">Nome da empresa</label>
                            <Input {...regInfo("name")} />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium flex items-center gap-1.5">
                                Slug (URL de acesso)
                                {tenant.slug === "platform" && (
                                    <span className="text-xs text-muted-foreground font-normal">(protegido)</span>
                                )}
                            </label>
                            <Input
                                {...regInfo("slug", {
                                    pattern: { value: /^[a-z0-9\-]+$/, message: "Apenas letras minúsculas, números e hífens." },
                                    minLength: { value: 2, message: "Mínimo 2 caracteres." }
                                })}
                                placeholder={tenant.slug}
                                disabled={tenant.slug === "platform"}
                                className="font-mono text-sm"
                            />

                            {!slugChanged && (
                                <p className="text-xs text-muted-foreground font-mono flex items-center gap-1 mt-1">
                                    <Globe className="h-3 w-3" />
                                    https://{tenant.slug}.{PLATFORM_DOMAIN}/
                                </p>
                            )}

                            {slugChanged && currentSlug.trim().length >= 2 && (
                                <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold text-amber-800">Atenção: mudança de slug</p>
                                            <p className="text-xs text-amber-700">
                                                A URL de acesso dos alunos e produtores vai mudar. Sessões ativas com o slug antigo serão desconectadas no próximo request.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-1 pl-6">
                                        <p className="text-xs text-amber-600 line-through font-mono">
                                            https://{tenant.slug}.{PLATFORM_DOMAIN}/
                                        </p>
                                        <p className="text-xs text-amber-800 font-mono font-semibold flex items-center gap-1">
                                            <ExternalLink className="h-3 w-3" />{newUrl}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Plano</label>
                                <select {...regInfo("plan")} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm">
                                    <option value="basic">Basic</option>
                                    <option value="pro">Pro</option>
                                    <option value="enterprise">Enterprise</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Status</label>
                                <select {...regInfo("is_active", { setValueAs: v => v === "true" })}
                                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm">
                                    <option value="true">Ativo</option>
                                    <option value="false">Inativo</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Domínio customizado (opcional)</label>
                            <Input {...regInfo("custom_domain")} placeholder="alunos.empresa.com.br" />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                            <Button
                                type="submit"
                                loading={updateMutation.isPending}
                                variant={slugChanged ? "destructive" : "default"}
                            >
                                {slugChanged ? "Confirmar mudança de URL" : "Salvar"}
                            </Button>
                        </DialogFooter>
                    </form>
                )}

                {/* Tab: Features */}
                {tab === "features" && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            {ALL_FEATURES.map(f => (
                                <label key={f.key} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{f.label}</p>
                                        <p className="text-xs text-muted-foreground font-mono">{f.key}</p>
                                    </div>
                                    <div className={cn(
                                        "h-6 w-11 rounded-full transition-all relative cursor-pointer",
                                        features[f.key] ? "bg-primary" : "bg-muted"
                                    )} onClick={() => setFeatures(prev => ({ ...prev, [f.key]: !prev[f.key] }))}>
                                        <div className={cn(
                                            "h-4 w-4 rounded-full bg-white absolute top-1 transition-all shadow-sm",
                                            features[f.key] ? "left-6" : "left-1"
                                        )} />
                                    </div>
                                </label>
                            ))}
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                            <Button loading={updateFeaturesMutation.isPending} onClick={() => updateFeaturesMutation.mutate()}>
                                Salvar features
                            </Button>
                        </DialogFooter>
                    </div>
                )}

                {/* Tab: Admin */}
                {tab === "admin" && (
                    <form onSubmit={submitAdmin(d => {
                        const payload: any = {};
                        if (d.name) payload.name = d.name;
                        if (d.email) payload.email = d.email;
                        if (d.password) payload.password = d.password;
                        updateAdminMutation.mutate(payload);
                    })} className="space-y-3">
                        <div className="p-3 rounded-lg bg-muted/30 border border-border">
                            <p className="text-xs text-muted-foreground">Admin atual: <strong className="text-foreground">{tenant.admin?.email || "—"}</strong></p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Nome</label>
                            <Input {...regAdmin("name")} placeholder={tenant.admin?.name} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">E-mail</label>
                            <Input {...regAdmin("email")} type="email" placeholder={tenant.admin?.email} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Nova senha (deixe em branco para manter)</label>
                            <Input {...regAdmin("password")} type="password" placeholder="Min. 8 caracteres" />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                            <Button type="submit" loading={updateAdminMutation.isPending}>Atualizar admin</Button>
                        </DialogFooter>
                    </form>
                )}

                {/* Tab: Métricas */}
                {tab === "metrics" && (
                    <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">

                        {/* Header com horário e refresh */}
                        <div className="flex items-center justify-between">
                            {tracking && (
                                <p className="text-xs text-muted-foreground">
                                    Atualizado às {new Date(tracking.computed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                            )}
                            <Button
                                variant="ghost" size="sm" className="h-7 gap-1.5 ml-auto"
                                onClick={() => refetchTracking()}
                                disabled={trackingFetching || trackingLoading}
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${trackingFetching ? "animate-spin" : ""}`} />
                                Atualizar
                            </Button>
                        </div>

                        {/* Loading */}
                        {trackingLoading && (
                            <div className="space-y-3">
                                {[...Array(4)].map((_, i) => (
                                    <Skeleton key={i} className="h-14 rounded-xl animate-pulse" />
                                ))}
                            </div>
                        )}

                        {/* Erro */}
                        {!trackingLoading && trackingError && (
                            <div className="flex flex-col items-center gap-3 py-8 text-center">
                                <XCircle className="h-8 w-8 text-destructive/50" />
                                <p className="text-sm text-muted-foreground">
                                    Erro ao carregar métricas. Verifique se a API foi deployada.
                                </p>
                                <Button variant="outline" size="sm" onClick={() => refetchTracking()}>
                                    <RefreshCw className="h-4 w-4" /> Tentar novamente
                                </Button>
                            </div>
                        )}

                        {/* Dados */}
                        {tracking && !trackingLoading && (
                            <>
                                {/* Engajamento */}
                                <section>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Engajamento</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <MetricCard icon={Users} label="Total alunos" value={tracking.total_students} />
                                        <MetricCard
                                            icon={Zap} label="Taxa de Ativação"
                                            value={<PctBadge value={tracking.taxa_ativacao} />}
                                            sub="Ao menos 1 evento-chave"
                                        />
                                        <MetricCard icon={Activity} label="DAU" value={tracking.dau} sub="Ativos hoje" />
                                        <MetricCard icon={Activity} label="MAU" value={tracking.mau} sub="Últimos 30 dias" />
                                        <MetricCard
                                            icon={TrendingUp} label="Stickiness"
                                            value={<PctBadge value={tracking.stickiness} thresholds={[10, 25]} />}
                                            sub="DAU / MAU" highlight
                                        />
                                        <div />
                                    </div>
                                </section>

                                {/* Retenção */}
                                <section>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Retenção</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <MetricCard
                                            icon={RefreshCw} label="Retorno D1"
                                            value={<PctBadge value={tracking.retorno_d1} />}
                                            sub="Voltou no dia seguinte"
                                        />
                                        <MetricCard
                                            icon={RefreshCw} label="Retorno D7"
                                            value={<PctBadge value={tracking.retorno_d7} />}
                                            sub="Voltou nos primeiros 7 dias"
                                        />
                                    </div>
                                </section>

                                {/* Uso por funcionalidade */}
                                <section>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                        Uso por funcionalidade
                                        <span className="ml-2 font-normal normal-case">
                                            ({tracking.total_events.toLocaleString("pt-BR")} eventos)
                                        </span>
                                    </p>
                                    <div className="space-y-2">
                                        {Object.entries(tracking.uso_funcionalidades).map(([key, item]) => {
                                            const Icon = FuncIcon[key] ?? Activity;
                                            return (
                                                <div key={key} className="flex items-center gap-3">
                                                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-sm font-medium text-foreground">{item.label}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {item.count.toLocaleString("pt-BR")} · {item.pct}%
                                                            </span>
                                                        </div>
                                                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full bg-primary transition-all duration-500"
                                                                style={{ width: `${item.pct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>

                                {/* Performance semanal */}
                                <section>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                        Performance semanal — questões
                                    </p>

                                    {semanaAtual && (
                                        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 mb-2">
                                            <div className="flex-1">
                                                <p className="text-xs text-muted-foreground">Semana atual</p>
                                                <p className="text-base font-bold text-foreground">
                                                    {semanaAtual.accuracy_pct}%
                                                    <span className="text-xs text-muted-foreground font-normal ml-1.5">
                                                        de acerto ({semanaAtual.correct}/{semanaAtual.total_questions} questões)
                                                    </span>
                                                </p>
                                            </div>
                                            {evolucao !== null && (
                                                <div className={`flex items-center gap-1 text-sm font-semibold ${evolucao >= 0 ? "text-success" : "text-destructive"}`}>
                                                    {evolucao > 0 ? <TrendingUp className="h-4 w-4" />
                                                        : evolucao < 0 ? <TrendingDown className="h-4 w-4" />
                                                            : <Minus className="h-4 w-4" />}
                                                    {evolucao > 0 ? "+" : ""}{evolucao}pp
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="rounded-xl border border-border overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-muted/50 border-b border-border">
                                                    <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Semana</th>
                                                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2">Questões</th>
                                                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2">Acertos</th>
                                                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2">% Acerto</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {semanas.map((s, i) => (
                                                    <tr key={s.week_start}
                                                        className={`border-b border-border last:border-0 ${i === semanas.length - 1 ? "bg-primary/5 font-medium" : ""}`}>
                                                        <td className="px-3 py-2 text-foreground">
                                                            <span className="text-xs">{s.label}</span>
                                                            <span className="block text-xs text-muted-foreground font-normal">
                                                                {new Date(s.week_start + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                                                                {" – "}
                                                                {new Date(s.week_end + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-foreground">{s.total_questions.toLocaleString("pt-BR")}</td>
                                                        <td className="px-3 py-2 text-right text-foreground">{s.correct.toLocaleString("pt-BR")}</td>
                                                        <td className="px-3 py-2 text-right"><PctBadge value={s.accuracy_pct} /></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            </>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}