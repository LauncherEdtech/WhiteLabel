// frontend/src/lib/stores/tenantStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Tenant, TenantBranding } from "@/types/tenant";

interface TenantState {
    tenant: Tenant | null;
    setTenant: (tenant: Tenant) => void;
    getBranding: () => TenantBranding;
    isFeatureEnabled: (feature: keyof Tenant["features"]) => boolean;
}

const DEFAULT_BRANDING: TenantBranding = {
    primary_color: "#4F46E5",
    secondary_color: "#10B981",
    logo_url: null,
    favicon_url: null,
    platform_name: "Plataforma de Estudos",
    support_email: null,
};

export const useTenantStore = create<TenantState>()(
    persist(
        (set, get) => ({
            tenant: null,

            setTenant: (tenant) => set({ tenant }),

            getBranding: () => get().tenant?.branding ?? DEFAULT_BRANDING,

            isFeatureEnabled: (feature) =>
                get().tenant?.features?.[feature] ?? false,
        }),
        {
            name: "tenant-store",
        }
    )
);