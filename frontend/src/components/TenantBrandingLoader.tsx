// frontend/src/components/TenantBrandingLoader.tsx
// ATUALIZADO: importa COLOR_PALETTES de @/lib/theme/palettes (sem "use client")
// em vez de definir localmente — permite import em Server Components.
// FIX: usePathname garante que o document.title do tenant é reaplicado após
// cada navegação client-side do Next.js (que reseta o título via metadata estático).
// FIX: favicon usa logo_url como fallback quando favicon_url não está definido.
// FIX: setFavicon helper cria a tag <link rel="icon"> se não existir e limpa
// o atributo type para evitar mime errado quando a logo for png/svg/webp.
// FIX: landing page (/landing) é ignorada pelo branding de tenant.

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTenantStore } from "@/lib/stores/tenantStore";
import Cookies from "js-cookie";
import { COLOR_PALETTES, getPaletteVars, isPaletteDark } from "@/lib/theme/palettes";

export { COLOR_PALETTES }; // re-exporta para retrocompatibilidade

// ── applyPalette ──────────────────────────────────────────────────────────────
export function applyPalette(paletteKey: string, customVars?: Record<string, string>) {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const vars = getPaletteVars(paletteKey, customVars);
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
    if (isPaletteDark(paletteKey)) {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
}

// ── setFavicon ────────────────────────────────────────────────────────────────
// Atualiza (ou cria) a tag <link rel="icon"> com a URL fornecida.
// Cria a tag caso não exista no <head> — garante funcionamento mesmo se
// o root layout não tiver declarado o link.
function setFavicon(url: string) {
    if (typeof document === "undefined") return;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
    }
    // Remove o type para não forçar mime errado quando a URL for png/svg/webp
    link.removeAttribute("type");
    link.href = url;
}

// ── applyBrandingCssVars ──────────────────────────────────────────────────────
export function applyBrandingCssVars(branding: Record<string, any>) {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const paletteKey: string = branding.color_palette ?? "classic";

    applyPalette(paletteKey, branding.custom_vars);

    // Retrocompatibilidade com tenants que só têm primary_color/secondary_color
    if (!branding.color_palette && branding.primary_color) {
        const hsl = hexToHsl(branding.primary_color);
        root.style.setProperty("--primary", hsl);
        root.style.setProperty("--ring", hsl);
    }
    if (!branding.color_palette && branding.secondary_color) {
        const hsl = hexToHsl(branding.secondary_color);
        root.style.setProperty("--secondary", hsl);
        root.style.setProperty("--success", hsl);
    }

    if (branding.platform_name) document.title = branding.platform_name;

    // Usa favicon_url se disponível, senão cai para logo_url
    const faviconHref: string | undefined = branding.favicon_url || branding.logo_url;
    if (faviconHref) {
        setFavicon(faviconHref);
    }
}

// ── reloadBranding ────────────────────────────────────────────────────────────
export async function reloadBranding(setTenant: (t: any) => void): Promise<void> {
    // Landing page institucional: não aplica branding de tenant
    if (typeof window !== "undefined" && window.location.pathname === "/landing") return;

    const slug = Cookies.get("tenant_slug") ?? "concurso-demo";
    try {
        const res = await fetch(`/api/tenant?t=${Date.now()}`, {
            headers: { "x-tenant-slug": slug, "Cache-Control": "no-cache" },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.id) return;
        setTenant(data);
        applyBrandingCssVars(data.branding ?? {});
    } catch { /* silencioso */ }
}

// ── TenantBrandingLoader ──────────────────────────────────────────────────────
export function TenantBrandingLoader() {
    const { setTenant, tenant } = useTenantStore();
    const pathname = usePathname();

    // Aplica branding inicial + faz fetch fresco do servidor
    useEffect(() => {
        // Landing page institucional: não aplica branding de tenant
        if (pathname === "/landing") return;
        if (tenant?.branding) {
            applyBrandingCssVars(tenant.branding as any);
        }
        reloadBranding(setTenant);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-aplica título e favicon do tenant a cada navegação client-side.
    // O Next.js App Router reseta document.title baseado no metadata estático
    // após cada rota — este efeito corrige isso.
    useEffect(() => {
        // Landing page institucional: preserva título e favicon da Launcher
        if (pathname === "/landing") return;
        const branding = tenant?.branding as any;
        if (!branding) return;
        if (branding.platform_name) document.title = branding.platform_name;
        const faviconHref: string | undefined = branding.favicon_url || branding.logo_url;
        if (faviconHref) setFavicon(faviconHref);
    }, [pathname, tenant?.branding]);

    return null;
}

// ── hexToHsl ──────────────────────────────────────────────────────────────────
export function hexToHsl(hex: string): string {
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