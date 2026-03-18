// frontend/src/app/(producer)/producer/settings/page.tsx
"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { ChevronRight, Palette, Globe, Bell, Shield } from "lucide-react";

const SETTINGS_ITEMS = [
  {
    href: "/producer/settings/branding",
    icon: Palette,
    label: "Branding",
    description: "Logo, cores e nome da plataforma",
    color: "text-primary bg-primary/10",
  },
  {
    href: "/producer/settings/domain",
    icon: Globe,
    label: "Domínio customizado",
    description: "Configure seu domínio próprio",
    color: "text-secondary bg-secondary/10",
  },
  {
    href: "/producer/settings/notifications",
    icon: Bell,
    label: "Notificações",
    description: "Envie mensagens para seus alunos",
    color: "text-warning bg-warning/10",
  },
];

export default function ProducerSettingsPage() {
  const { tenant } = useTenantStore();

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Personalize sua plataforma
        </p>
      </div>

      {/* Info do tenant */}
      {tenant && (
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{tenant.name}</p>
                <p className="text-xs text-muted-foreground">
                  Plano: <span className="font-medium capitalize">{tenant.plan}</span> •
                  Slug: <span className="font-mono">{tenant.slug}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Menu de configurações */}
      <div className="space-y-2">
        {SETTINGS_ITEMS.map(({ href, icon: Icon, label, description, color }) => (
          <Link key={href} href={href}>
            <Card className="hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{label}</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}