// frontend/src/types/tenant.ts
// Com suporte a appearance: layouts, paletas e login customizado

export interface TenantBranding {
    primary_color: string;
    secondary_color: string;
    logo_url: string | null;
    favicon_url: string | null;
    platform_name: string;
    support_email: string | null;

    // ── Aparência (NOVO) ──────────────────────────────────────────────────────
    /** Paleta de cores predefinida ou "custom" */
    color_palette?: ColorPaletteKey | "custom";
    /** CSS vars customizadas (usado quando color_palette === "custom") */
    custom_vars?: Record<string, string>;
    /** Layout do portal do aluno */
    layout_student?: StudentLayout;
    /** Layout do portal do produtor */
    layout_producer?: ProducerLayout;
    /** Layout da tela de login */
    login_layout?: LoginLayout;
    /** URL de imagem de fundo do login */
    login_bg_url?: string | null;
    /** Cor de fundo do login (hex) */
    login_bg_color?: string | null;
    capsule_style?: CapsuleStyle;
}

export type ColorPaletteKey =
    | "midnight"
    | "tactical"
    | "carbon"
    | "slate_dark"
    | "classic"
    | "emerald"
    | "warm";

export type StudentLayout = "sidebar" | "topbar" | "minimal";
export type ProducerLayout = "sidebar" | "topbar";
export type LoginLayout = "split" | "centered" | "fullbg" | "minimal";
export type CapsuleStyle = "operativo" | "campeao" | "relatorio";

export interface ColorPalette {
    key: ColorPaletteKey | "custom";
    name: string;
    description: string;
    preview: [string, string, string]; // 3 cores de preview
    dark: boolean;
    vars?: Record<string, string>;
}

export interface AppearanceConfig {
    color_palette: ColorPaletteKey | "custom";
    custom_vars: Record<string, string>;
    layout_student: StudentLayout;
    layout_producer: ProducerLayout;
    login_layout: LoginLayout;
    login_bg_url?: string | null;
    login_bg_color?: string | null;
}

export interface TenantFeatures {
    ai_schedule: boolean;
    ai_question_extract: boolean;
    simulados: boolean;
    analytics_producer: boolean;
    ai_tutor_chat: boolean;
}

export interface TenantSettings {
    timezone: string;
    default_language: string;
    max_students: number;
    session_duration_hours: number;
}

export interface Tenant {
    id: string;
    name: string;
    slug: string;
    domain_verified?: boolean;
    custom_domain: string | null;
    plan: "basic" | "pro" | "enterprise";
    is_active: boolean;
    branding: TenantBranding;
    features: TenantFeatures;
    settings: TenantSettings;
}