// frontend/src/lib/stores/tenantStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Tenant } from "@/types/tenant";

interface TenantState {
  tenant: Tenant | null;
  setTenant: (tenant: Tenant) => void;
  clearTenant: () => void;
  getBranding: () => {
    primary_color: string;
    secondary_color: string;
    platform_name: string;
    support_email: string;
    logo_url?: string;
    favicon_url?: string;
  };
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set, get) => ({
      tenant: null,

      setTenant: (tenant) => set({ tenant }),

      clearTenant: () => set({ tenant: null }),

      getBranding: () => {
        const tenant = get().tenant;
        const b = tenant?.branding as Record<string, string | undefined> | undefined;
        return {
          primary_color:   b?.primary_color   || "#4F46E5",
          secondary_color: b?.secondary_color || "#10B981",
          platform_name:   b?.platform_name   || "Plataforma de Estudos",
          support_email:   b?.support_email   || "",
          logo_url:        b?.logo_url,
          favicon_url:     b?.favicon_url,
        };
      },
    }),
    {
      name: "tenant-store",
      partialize: (state) => ({ tenant: state.tenant }),
    }
  )
);