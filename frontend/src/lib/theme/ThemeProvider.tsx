// frontend/src/lib/theme/ThemeProvider.tsx
// Injeta as CSS variables do tenant no :root.
// CORRIGIDO: delegava apenas primary_color/secondary_color e sobrescrevia
// a paleta completa toda vez que o branding mudava. Agora usa applyBrandingCssVars
// que aplica as ~16 CSS vars da paleta escolhida + gerencia dark/light mode.

"use client";

import { useEffect } from "react";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { applyBrandingCssVars } from "@/components/TenantBrandingLoader";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { tenant } = useTenantStore();

    useEffect(() => {
        if (!tenant?.branding) return;
        applyBrandingCssVars(tenant.branding as any);
    }, [tenant?.branding]);

    return <>{children}</>;
}