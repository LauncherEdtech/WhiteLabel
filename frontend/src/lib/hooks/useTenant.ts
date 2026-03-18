"use client";
import { useTenantStore } from "@/lib/stores/tenantStore";

export function useTenant() {
  const { tenant, getBranding } = useTenantStore();
  const features = (tenant?.features ?? {}) as Record<string, boolean>;
  return {
    tenant,
    branding: getBranding(),
    features,
    hasFeature: (f: string) => !!features[f],
    plan: tenant?.plan || "basic",
    isWhiteLabel: !!tenant?.custom_domain,
  };
}
