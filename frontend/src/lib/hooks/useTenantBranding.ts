// frontend/src/lib/hooks/useTenantBranding.ts
// Carrega o branding do servidor na inicialização do app
// Garante que o branding persiste entre sessões e reloads

"use client";

import { useEffect } from "react";
import { useTenantStore } from "@/lib/stores/tenantStore";
import Cookies from "js-cookie";

export function useTenantBranding() {
  const { setTenant, tenant } = useTenantStore();

  useEffect(() => {
    const slug = Cookies.get("tenant_slug") || "concurso-demo";

    // Sempre recarrega do servidor para garantir dados frescos
    fetch(`/api/tenant`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.id) {
          setTenant(data);
        }
      })
      .catch(() => {
        // Falhou — usa o cache do localStorage (tenantStore já persistido)
      });
  }, []); // Só executa uma vez ao montar

  return tenant;
}
