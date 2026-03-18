// frontend/src/types/tenant.ts

export interface TenantBranding {
    primary_color: string;        // ex: "#7C3AED"
    secondary_color: string;
    logo_url: string | null;
    favicon_url: string | null;
    platform_name: string;
    support_email: string | null;
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