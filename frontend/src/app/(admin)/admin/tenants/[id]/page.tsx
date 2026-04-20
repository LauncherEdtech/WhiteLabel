// frontend/src/app/(admin)/admin/tenants/[id]/page.tsx
"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toaster";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useState } from "react";
import {
  ChevronLeft, Building2, Globe, Users,
  CheckCircle2, XCircle, Shield, Sparkles,
  BarChart3, RefreshCw, TrendingUp, TrendingDown,
  Activity, Zap, BookOpen, CalendarCheck, HelpCircle,
  Minus,
} from "lucide-react";
import Link from "next/link";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";

// ─── tipos ───────────────────────────────────────────────────────────────────

interface TrackingData {
  tenant_id: string;
  tenant_name: string;
  computed_at: string;
  total_students: number;
  dau: number;
  mau: number;
  stickiness: number;
  taxa_ativacao: number;
  retorno_d1: number;
  retorno_d7: number;
  uso_funcionalidades: Record<string, { label: string; count: number; pct: number }>;
  total_events: number;
  performance_semanal: Array<{
    label: string;
    week_start: string;
    week_end: string;
    total_questions: number;
    correct: number;
    accuracy_pct: number;
  }>;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function pctColor(v: number, thresholds = [30, 60]): string {
  if (v >= thresholds[1]) return "text-success";
  if (v >= thresholds[0]) return "text-warning";
  return "text-destructive";
}

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

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-border p-4 space-y-1 ${highlight ? "bg-primary/5 border-primary/20" : "bg-card"}`}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ─── componente principal ─────────────────────────────────────────────────────

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [trackingEnabled, setTrackingEnabled] = useState(false);

  const { data: tenant, isLoading } = useQuery({
    queryKey: QUERY_KEYS.TENANT(id),
    queryFn: async () => {
      const res = await apiClient.get(`/tenants/${id}`);
      return res.data.tenant;
    },
    enabled: !!id,
  });

  const toggleMutation = useMutation({
    mutationFn: () =>
      apiClient.put(`/tenants/${id}`, { is_active: !tenant?.is_active }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TENANT(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TENANTS });
      toast.success(tenant?.is_active ? "Tenant desativado." : "Tenant ativado!");
      setConfirmToggle(false);
    },
    onError: () => toast.error("Erro ao atualizar tenant"),
  });

  // Tracking — lazy, só busca quando habilitado
  const {
    data: tracking,
    isLoading: trackingLoading,
    isError: trackingError,
    refetch: refetchTracking,
    isFetching: trackingFetching,
  } = useQuery<TrackingData>({
    queryKey: ["tenant-tracking", id],
    queryFn: async () => {
      const res = await apiClient.get(`/tenants/${id}/tracking`);
      return res.data;
    },
    enabled: !!id && trackingEnabled,
    staleTime: 5 * 60 * 1000, // 5 min cache local
  });

  if (isLoading) return <Skeleton className="h-64 rounded-xl animate-pulse" />;
  if (!tenant) return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">Tenant não encontrado</p>
      <Link href="/admin/tenants">
        <Button variant="outline" className="mt-3">Voltar</Button>
      </Link>
    </div>
  );

  const PLAN_COLORS: Record<string, string> = {
    basic: "outline",
    pro: "secondary",
    enterprise: "default",
  };

  // semanas ordenadas mais antiga → atual
  const semanas = tracking?.performance_semanal ?? [];
  const semanaAtual = semanas[semanas.length - 1];
  const semanaAnterior = semanas[semanas.length - 2];
  const evolucao =
    semanaAtual && semanaAnterior && semanaAnterior.accuracy_pct > 0
      ? +(semanaAtual.accuracy_pct - semanaAnterior.accuracy_pct).toFixed(1)
      : null;

  const FuncIcon: Record<string, React.ElementType> = {
    questoes: HelpCircle,
    cronograma: CalendarCheck,
    aulas: BookOpen,
  };

  return (
    <div className="max-w-2xl space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/tenants">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold text-foreground">{tenant.name}</h1>
            <Badge variant={tenant.is_active ? "success" : "destructive"}>
              {tenant.is_active ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </div>
        <Button
          variant={tenant.is_active ? "destructive" : "default"}
          size="sm"
          onClick={() => setConfirmToggle(true)}
        >
          {tenant.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {tenant.is_active ? "Desativar" : "Ativar"}
        </Button>
      </div>

      {/* Info geral */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Informações
        </CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {[
            { label: "Slug", value: tenant.slug, mono: true },
            { label: "Plano", value: tenant.plan },
            { label: "Domínio padrão", value: `${tenant.slug}.plataforma.com`, mono: true },
            { label: "Domínio customizado", value: tenant.custom_domain || "Não configurado", mono: !!tenant.custom_domain },
          ].map(({ label, value, mono }) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className={`text-sm font-medium text-foreground mt-0.5 ${mono ? "font-mono" : ""}`}>
                {value}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Features habilitadas
        </CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {Object.entries(tenant.features || {}).map(([key, enabled]) => (
            <div key={key} className="flex items-center gap-2 p-2 rounded-lg border border-border">
              {enabled
                ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              }
              <span className="text-xs font-medium text-foreground">
                {key.replace(/_/g, " ")}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader><CardTitle className="text-base">Branding</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl"
              style={{ backgroundColor: tenant.branding?.primary_color || "#4F46E5" }}
            />
            <div>
              <p className="text-sm font-medium text-foreground">
                {tenant.branding?.platform_name || "Plataforma de Estudos"}
              </p>
              <p className="text-xs font-mono text-muted-foreground">
                {tenant.branding?.primary_color}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Rastreamento de Dados ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Rastreamento de Dados
            </CardTitle>
            <div className="flex items-center gap-2">
              {tracking && (
                <span className="text-xs text-muted-foreground">
                  {new Date(tracking.computed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              {trackingEnabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => refetchTracking()}
                  disabled={trackingFetching}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${trackingFetching ? "animate-spin" : ""}`} />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Estado: não carregado ainda */}
          {!trackingEnabled && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Activity className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Métricas de engajamento, ativação e performance dos alunos.
              </p>
              <Button
                size="sm"
                onClick={() => setTrackingEnabled(true)}
              >
                <BarChart3 className="h-4 w-4" />
                Carregar métricas
              </Button>
            </div>
          )}

          {/* Estado: carregando */}
          {trackingEnabled && trackingLoading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {/* Estado: erro */}
          {trackingEnabled && !trackingLoading && trackingError && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <XCircle className="h-8 w-8 text-destructive/50" />
              <p className="text-sm text-muted-foreground">
                Erro ao carregar métricas. Verifique se a API foi deployada.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetchTracking()}>
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
            </div>
          )}

          {/* Estado: dados carregados */}
          {tracking && !trackingLoading && (
            <div className="space-y-6">

              {/* Engajamento */}
              <section>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Engajamento
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    icon={Users}
                    label="Total de alunos"
                    value={tracking.total_students}
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
                    label="Stickiness (DAU/MAU)"
                    value={<PctBadge value={tracking.stickiness} thresholds={[10, 25]} />}
                    sub="Recorrência de uso"
                    highlight
                  />
                  <div /> {/* espaço */}
                </div>
              </section>

              {/* Retenção */}
              <section>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Retenção
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    icon={RefreshCw}
                    label="Retorno D1"
                    value={<PctBadge value={tracking.retorno_d1} />}
                    sub="Voltaram no dia seguinte ao 1° acesso"
                  />
                  <MetricCard
                    icon={RefreshCw}
                    label="Retorno D7"
                    value={<PctBadge value={tracking.retorno_d7} />}
                    sub="Voltaram dentro dos primeiros 7 dias"
                  />
                </div>
              </section>

              {/* Uso por funcionalidade */}
              <section>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Uso por funcionalidade
                  <span className="ml-2 font-normal normal-case">
                    ({tracking.total_events.toLocaleString("pt-BR")} eventos totais)
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
                              {item.count.toLocaleString("pt-BR")} eventos · {item.pct}%
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
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Performance semanal — questões
                </p>

                {/* Resumo semana atual vs anterior */}
                {semanaAtual && (
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 mb-3">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Semana atual</p>
                      <p className="text-lg font-bold text-foreground">
                        {semanaAtual.accuracy_pct}%
                        <span className="text-xs text-muted-foreground font-normal ml-1.5">
                          de acerto ({semanaAtual.correct}/{semanaAtual.total_questions} questões)
                        </span>
                      </p>
                    </div>
                    {evolucao !== null && (
                      <div className={`flex items-center gap-1 text-sm font-semibold ${evolucao >= 0 ? "text-success" : "text-destructive"}`}>
                        {evolucao > 0
                          ? <TrendingUp className="h-4 w-4" />
                          : evolucao < 0
                            ? <TrendingDown className="h-4 w-4" />
                            : <Minus className="h-4 w-4" />
                        }
                        {evolucao > 0 ? "+" : ""}{evolucao}pp
                      </div>
                    )}
                  </div>
                )}

                {/* Tabela últimas 4 semanas */}
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
                        <tr
                          key={s.week_start}
                          className={`border-b border-border last:border-0 ${i === semanas.length - 1 ? "bg-primary/5 font-medium" : ""}`}
                        >
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
                          <td className="px-3 py-2 text-right">
                            <PctBadge value={s.accuracy_pct} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmToggle}
        onOpenChange={setConfirmToggle}
        title={tenant.is_active ? "Desativar tenant?" : "Ativar tenant?"}
        description={
          tenant.is_active
            ? "Os alunos não conseguirão mais acessar a plataforma."
            : "O tenant voltará a funcionar normalmente."
        }
        confirmLabel={tenant.is_active ? "Desativar" : "Ativar"}
        variant={tenant.is_active ? "destructive" : "default"}
        onConfirm={() => toggleMutation.mutate()}
        loading={toggleMutation.isPending}
      />
    </div>
  );
}