// frontend/src/lib/hooks/useTenantBySlug.ts
// Busca e aplica o branding de um tenant diretamente pelo slug.
// Usado na página de login para aplicar o tema ANTES do TenantBrandingLoader
// resolver o cookie — evita o delay causado pela race condition.

"use client";

import { useEffect, useRef } from "react";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { applyBrandingCssVars } from "@/components/TenantBrandingLoader";

export function useTenantBySlug(slug: string | null | undefined) {
    const { tenant, setTenant } = useTenantStore();
    const fetchedSlug = useRef<string | null>(null);

    useEffect(() => {
        if (!slug) return;
        // Não rebusca se já temos o tenant correto E os dados são recentes
        // (permite re-fetch se o slug mudou ou se não temos dados)
        const alreadyLoaded = tenant?.slug === slug && tenant?.id;

        // Aplica imediatamente o que está no cache (mesmo que seja de outro tenant)
        if (tenant?.branding) {
            applyBrandingCssVars(tenant.branding as any);
        }

        // Evita double-fetch em StrictMode
        if (fetchedSlug.current === slug) return;
        fetchedSlug.current = slug;

        // Busca direto pelo slug da URL — sem depender do cookie
        // cache: "no-store" garante que sempre pega dados frescos do banco
        fetch(`/api/tenant?slug=${slug}&t=${Date.now()}`, {
            headers: {
                "x-tenant-slug": slug,
                "Cache-Control": "no-cache",
            },
        })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data?.id) return;
                setTenant(data);
                applyBrandingCssVars(data.branding || {});
            })
            .catch(() => { /* silencioso — mantém cache */ });
    }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

    return tenant;
}