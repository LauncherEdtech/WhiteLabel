// frontend/src/lib/theme/palettes.ts
// Paletas de cores — SEM "use client", pode ser importado por Server Components.
// TenantBrandingLoader e page.tsx de login importam daqui.

export const COLOR_PALETTES: Record<string, {
    name: string;
    description: string;
    preview: string[];
    dark: boolean;
    vars: Record<string, string>;
}> = {
    midnight: {
        name: "Meia-Noite", description: "Escuro profundo com azul elétrico",
        preview: ["#0F1117", "#1E2230", "#3B82F6"], dark: true,
        vars: {
            "background": "222 47% 7%", "foreground": "213 31% 91%",
            "card": "222 40% 10%", "card-foreground": "213 31% 91%",
            "border": "222 30% 16%", "input": "222 30% 16%",
            "primary": "217 91% 60%", "primary-foreground": "222 47% 7%",
            "secondary": "222 30% 18%", "secondary-foreground": "213 31% 80%",
            "muted": "222 30% 15%", "muted-foreground": "213 20% 55%",
            "accent": "222 30% 18%", "accent-foreground": "213 31% 91%",
            "destructive": "0 72% 51%", "destructive-foreground": "0 0% 100%",
            "success": "142 71% 45%", "warning": "38 92% 50%",
            "ring": "217 91% 60%", "radius": "0.5rem",
        },
    },
    tactical: {
        name: "Tático", description: "Verde militar com cinza grafite",
        preview: ["#111318", "#1C2420", "#22C55E"], dark: true,
        vars: {
            "background": "225 18% 8%", "foreground": "120 10% 88%",
            "card": "225 15% 11%", "card-foreground": "120 10% 88%",
            "border": "225 12% 18%", "input": "225 12% 18%",
            "primary": "142 71% 45%", "primary-foreground": "225 18% 8%",
            "secondary": "225 12% 16%", "secondary-foreground": "120 10% 75%",
            "muted": "225 12% 14%", "muted-foreground": "120 5% 50%",
            "accent": "225 12% 16%", "accent-foreground": "120 10% 88%",
            "destructive": "0 72% 51%", "destructive-foreground": "0 0% 100%",
            "success": "142 71% 45%", "warning": "38 92% 50%",
            "ring": "142 71% 45%", "radius": "0.375rem",
        },
    },
    carbon: {
        name: "Carbono", description: "Preto carvão com vermelho intenso",
        preview: ["#0C0C0F", "#18181F", "#EF4444"], dark: true,
        vars: {
            "background": "240 10% 4%", "foreground": "0 0% 90%",
            "card": "240 8% 7%", "card-foreground": "0 0% 90%",
            "border": "240 6% 14%", "input": "240 6% 14%",
            "primary": "0 72% 51%", "primary-foreground": "0 0% 100%",
            "secondary": "240 6% 12%", "secondary-foreground": "0 0% 75%",
            "muted": "240 6% 10%", "muted-foreground": "0 0% 45%",
            "accent": "240 6% 12%", "accent-foreground": "0 0% 90%",
            "destructive": "0 72% 51%", "destructive-foreground": "0 0% 100%",
            "success": "142 71% 45%", "warning": "38 92% 50%",
            "ring": "0 72% 51%", "radius": "0.25rem",
        },
    },
    slate_dark: {
        name: "Slate Dark", description: "Cinza elegante com violeta",
        preview: ["#0D1117", "#161B27", "#8B5CF6"], dark: true,
        vars: {
            "background": "220 27% 5%", "foreground": "220 14% 90%",
            "card": "220 24% 8%", "card-foreground": "220 14% 90%",
            "border": "220 18% 14%", "input": "220 18% 14%",
            "primary": "262 83% 58%", "primary-foreground": "0 0% 100%",
            "secondary": "220 18% 13%", "secondary-foreground": "220 14% 75%",
            "muted": "220 18% 11%", "muted-foreground": "220 8% 46%",
            "accent": "220 18% 13%", "accent-foreground": "220 14% 90%",
            "destructive": "0 72% 51%", "destructive-foreground": "0 0% 100%",
            "success": "142 71% 45%", "warning": "38 92% 50%",
            "ring": "262 83% 58%", "radius": "0.5rem",
        },
    },
    classic: {
        name: "Clássico", description: "Branco limpo com azul índigo",
        preview: ["#FFFFFF", "#F8FAFC", "#4F46E5"], dark: false,
        vars: {
            "background": "0 0% 100%", "foreground": "222 47% 11%",
            "card": "0 0% 100%", "card-foreground": "222 47% 11%",
            "border": "214 32% 91%", "input": "214 32% 91%",
            "primary": "243 75% 59%", "primary-foreground": "0 0% 100%",
            "secondary": "214 32% 95%", "secondary-foreground": "222 47% 11%",
            "muted": "214 32% 96%", "muted-foreground": "215 16% 47%",
            "accent": "214 32% 95%", "accent-foreground": "222 47% 11%",
            "destructive": "0 84% 60%", "destructive-foreground": "0 0% 100%",
            "success": "142 71% 45%", "warning": "38 92% 50%",
            "ring": "243 75% 59%", "radius": "0.5rem",
        },
    },
    emerald: {
        name: "Esmeralda", description: "Branco com verde esmeralda",
        preview: ["#FFFFFF", "#F0FDF4", "#10B981"], dark: false,
        vars: {
            "background": "0 0% 100%", "foreground": "162 47% 8%",
            "card": "0 0% 100%", "card-foreground": "162 47% 8%",
            "border": "162 20% 90%", "input": "162 20% 90%",
            "primary": "160 84% 39%", "primary-foreground": "0 0% 100%",
            "secondary": "162 20% 95%", "secondary-foreground": "162 47% 8%",
            "muted": "162 20% 96%", "muted-foreground": "162 16% 44%",
            "accent": "162 20% 95%", "accent-foreground": "162 47% 8%",
            "destructive": "0 84% 60%", "destructive-foreground": "0 0% 100%",
            "success": "160 84% 39%", "warning": "38 92% 50%",
            "ring": "160 84% 39%", "radius": "0.5rem",
        },
    },
    warm: {
        name: "Âmbar", description: "Tom quente com laranja dourado",
        preview: ["#FFFBF5", "#FEF3C7", "#F59E0B"], dark: false,
        vars: {
            "background": "40 100% 99%", "foreground": "25 47% 11%",
            "card": "0 0% 100%", "card-foreground": "25 47% 11%",
            "border": "38 40% 88%", "input": "38 40% 88%",
            "primary": "38 92% 50%", "primary-foreground": "25 47% 11%",
            "secondary": "38 40% 94%", "secondary-foreground": "25 47% 11%",
            "muted": "38 40% 96%", "muted-foreground": "25 16% 44%",
            "accent": "38 40% 94%", "accent-foreground": "25 47% 11%",
            "destructive": "0 84% 60%", "destructive-foreground": "0 0% 100%",
            "success": "142 71% 45%", "warning": "38 92% 50%",
            "ring": "38 92% 50%", "radius": "0.75rem",
        },
    },
};

/** Retorna as CSS vars da paleta (ou custom vars) */
export function getPaletteVars(
    paletteKey: string,
    customVars?: Record<string, string>
): Record<string, string> {
    if (paletteKey === "custom" && customVars) return customVars;
    return COLOR_PALETTES[paletteKey]?.vars ?? COLOR_PALETTES.classic.vars;
}

/** Retorna se a paleta é dark */
export function isPaletteDark(paletteKey: string): boolean {
    return COLOR_PALETTES[paletteKey]?.dark ?? false;
}

/** Gera string de CSS vars para injetar em <style> */
export function buildCssVarsString(
    paletteKey: string,
    customVars?: Record<string, string>
): string {
    const vars = getPaletteVars(paletteKey, customVars);
    return Object.entries(vars)
        .map(([k, v]) => `  --${k}: ${v};`)
        .join("\n");
}