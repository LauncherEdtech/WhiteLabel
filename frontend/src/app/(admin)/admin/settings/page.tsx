// frontend/src/app/(admin)/admin/settings/page.tsx
"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações do Sistema"
        description="Informações e configurações globais da plataforma."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ambiente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Modo</span>
              <Badge variant="default">Produção</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Região AWS</span>
              <span className="text-sm font-medium">sa-east-1 (São Paulo)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Banco de Dados</span>
              <Badge className="bg-green-100 text-green-800">PostgreSQL 16</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Cache</span>
              <Badge className="bg-green-100 text-green-800">Redis 7</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Infraestrutura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">API</span>
              <Badge className="bg-green-100 text-green-800">ECS Fargate (2 tasks)</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Frontend</span>
              <Badge className="bg-green-100 text-green-800">ECS Fargate (1 task)</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Load Balancer</span>
              <Badge className="bg-green-100 text-green-800">ALB (HTTP)</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">IA</span>
              <Badge className="bg-purple-100 text-purple-800">Gemini 1.5 Flash</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Acesso Rápido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Para gerenciar tenants, acesse a seção <strong>Tenants</strong> no menu lateral.
              Configurações avançadas de infraestrutura são gerenciadas via Terraform e GitHub Actions.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
