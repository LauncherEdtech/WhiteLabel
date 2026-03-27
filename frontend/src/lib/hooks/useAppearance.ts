// frontend/src/lib/hooks/useAppearance.ts
// Hook para ler as configurações de aparência do tenant atual.
// Usado pelos layouts para escolher sidebar/topbar/minimal.

import { useTenantStore } from "@/lib/stores/tenantStore";
import type { StudentLayout, ProducerLayout, LoginLayout, ColorPaletteKey } from "@/types/tenant";

export function useAppearance() {
    const { tenant } = useTenantStore();
    const b = (tenant?.branding ?? {}) as Record<string, any>;

    return {
        // Layouts
        layoutStudent:  (b.layout_student  || "sidebar") as StudentLayout,
        layoutProducer: (b.layout_producer || "sidebar") as ProducerLayout,
        loginLayout:    (b.login_layout    || "split")   as LoginLayout,

        // Cores
        colorPalette: (b.color_palette || "classic") as ColorPaletteKey | "custom",
        customVars:   (b.custom_vars   || {}) as Record<string, string>,

        // Login customizado
        loginBgUrl:   b.login_bg_url   as string | null | undefined,
        loginBgColor: b.login_bg_color as string | null | undefined,
    };
}