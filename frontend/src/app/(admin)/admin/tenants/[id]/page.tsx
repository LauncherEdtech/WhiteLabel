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
} from "lucide-react";
import Link from "next/link";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmToggle, setConfirmToggle] = useState(false);

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

  return (
    <div className="max-w-2xl space-y-5 animate-fade-in">
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