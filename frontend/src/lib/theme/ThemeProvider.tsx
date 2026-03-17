// frontend/src/lib/theme/ThemeProvider.tsx
// Injeta as CSS variables do tenant no :root.
// É aqui que o white-label acontece visualmente.

"use client";

import { useEffect } from "react";
import { useTenantStore } from "@/lib/stores/tenantStore";

// Converte hex para HSL para usar com Tailwind (que usa hsl())
function hexToHsl(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return "243 75% 59%";

    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { getBranding } = useTenantStore();
    const branding = getBranding();

    useEffect(() => {
        const root = document.documentElement;

        // Injeta cores do tenant como CSS variables
        if (branding.primary_color) {
            const primaryHsl = hexToHsl(branding.primary_color);
            root.style.setProperty("--primary", primaryHsl);
            root.style.setProperty("--ring", primaryHsl);
        }

        if (branding.secondary_color) {
            const secondaryHsl = hexToHsl(branding.secondary_color);
            root.style.setProperty("--secondary", secondaryHsl);
            root.style.setProperty("--success", secondaryHsl);
        }

        // Atualiza título e favicon da plataforma
        if (branding.platform_name) {
            document.title = branding.platform_name;
        }

        if (branding.favicon_url) {
            const favicon = document.querySelector<HTMLLinkElement>(
                "link[rel='icon']"
            );
            if (favicon) favicon.href = branding.favicon_url;
        }
    }, [branding]);

    return <>{children}</>;
}