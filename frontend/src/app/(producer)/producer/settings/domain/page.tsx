// frontend/src/app/(producer)/producer/settings/domain/page.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toaster";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { Globe, ChevronLeft, CheckCircle2, Copy, ExternalLink, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function DomainSettingsPage() {
  const { tenant } = useTenantStore();
  const toast = useToast();
  const [domain, setDomain] = useState(tenant?.custom_domain || "");
  const [saving, setSaving] = useState(false);

  const defaultDomain = tenant ? `${tenant.slug}.plataforma.com` : "";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const handleSave = async () => {
    setSaving(true);
    setTimeout(() => {
      toast.info(
        "Domínio salvo!",
        "Configure o DNS conforme as instruções abaixo para ativar."
      );
      setSaving(false);
    }, 1000);
  };

  return (
    <div className="max-w-2xl space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/producer/settings">
          <Button variant="ghost" size="sm"><ChevronLeft className="h-4 w-4" /> Voltar</Button>
        </Link>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Domínio customizado</h1>
          <p className="text-sm text-muted-foreground">Configure seu domínio próprio</p>
        </div>
      </div>

      {/* Domínio atual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Domínio atual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">{defaultDomain}</p>
              <p className="text-xs text-muted-foreground">Domínio padrão da plataforma</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success">Ativo</Badge>
              <Button variant="ghost" size="icon-sm" onClick={() => copyToClipboard(defaultDomain)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {tenant?.custom_domain && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div>
                <p className="text-sm font-medium text-foreground">{tenant.custom_domain}</p>
                <p className="text-xs text-muted-foreground">Domínio customizado</p>
              </div>
              <Badge variant={tenant.domain_verified ? "success" : "warning"}>
                {tenant.domain_verified ? "Verificado" : "Pendente"}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configurar domínio */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar domínio customizado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Seu domínio</label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="alunos.seusite.com.br"
            />
            <p className="text-xs text-muted-foreground">
              Ex: alunos.cursojuridico.com.br
            </p>
          </div>
          <Button onClick={handleSave} loading={saving} disabled={!domain.trim()}>
            Salvar domínio
          </Button>
        </CardContent>
      </Card>

      {/* Instruções DNS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-warning" />
            Configuração DNS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Para ativar seu domínio customizado, adicione os seguintes registros no painel DNS do seu provedor:
          </p>

          {[
            { type: "CNAME", name: "alunos (ou subdomínio)", value: defaultDomain },
            { type: "TXT", name: "_verify", value: `plataforma-verify=${tenant?.slug}` },
          ].map(({ type, name, value }) => (
            <div key={type} className="p-3 rounded-xl bg-muted/50 border border-border font-mono text-xs">
              <div className="flex items-center justify-between mb-1">
                <Badge variant="outline">{type}</Badge>
                <Button variant="ghost" size="icon-sm" onClick={() => copyToClipboard(value)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-muted-foreground">Nome: <span className="text-foreground">{name}</span></p>
              <p className="text-muted-foreground">Valor: <span className="text-foreground">{value}</span></p>
            </div>
          ))}

          <p className="text-xs text-muted-foreground">
            ⏱ A propagação DNS pode levar até 48 horas após a configuração.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}