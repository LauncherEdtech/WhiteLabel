// frontend/src/components/TenantBrandingLoader.tsx
// Fonte única de verdade para carregar branding do servidor.
//
// FIXES aplicados:
// 1. Usa /api/tenant (Next.js route handler) como proxy — sem CORS, sem exposição de URL interna.
// 2. Não sobrescreve o store se o servidor retornar dado incompleto (sem id).
// 3. Exporta `reloadBranding()` para a página de branding chamar após salvar.
// 4. useTenantBranding.ts foi consolidado aqui — não use os dois juntos.

"use client";

import { useEffect, useCallback } from "react";
import { useTenantStore } from "@/lib/stores/tenantStore";
import Cookies from "js-cookie";

// Exportada para que a página de branding possa forçar reload após salvar
export async function reloadBranding(setTenant: (t: any) => void): Promise<void> {
  const slug = Cookies.get("tenant_slug") || "concurso-demo";

  try {
    // Adiciona timestamp para garantir que o browser não use cache
    const res = await fetch(`/api/tenant?t=${Date.now()}`, {
      headers: { "x-tenant-slug": slug, "Cache-Control": "no-cache" },
    });

    if (!res.ok) return;

    const data = await res.json();

    // Só atualiza se vier um tenant válido com id
    if (!data?.id) return;

    setTenant(data);
    applyBrandingCssVars(data.branding || {});
  } catch {
    // Silencioso — mantém o cache local
  }
}

export function applyBrandingCssVars(branding: Record<string, string | null | undefined>) {
  const root = document.documentElement;

  if (branding.primary_color) {
    const hsl = hexToHsl(branding.primary_color);
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--ring", hsl);
  }

  if (branding.secondary_color) {
    const hsl = hexToHsl(branding.secondary_color);
    root.style.setProperty("--secondary", hsl);
    root.style.setProperty("--success", hsl);
  }

  if (branding.platform_name) {
    document.title = branding.platform_name;
  }

  if (branding.favicon_url) {
    const favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (favicon) favicon.href = branding.favicon_url;
  }
}

export function TenantBrandingLoader() {
  const { setTenant, tenant } = useTenantStore();

  useEffect(() => {
    // Aplica imediatamente o que já temos no store (evita flash)
    if (tenant?.branding) {
      applyBrandingCssVars(tenant.branding as unknown as Record<string, string | null | undefined>);
    }

    // Depois busca do servidor para garantir dados frescos
    reloadBranding(setTenant);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "243 75% 59%";
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}