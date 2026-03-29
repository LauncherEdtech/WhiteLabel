// frontend/src/lib/hooks/useTenantFeatures.ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

/**
 * Retorna as features do tenant do produtor autenticado.
 * Usado para mostrar/esconder UI de features premium (ex: video_hosting).
 * Cache de 5 min — features mudam raramente.
 */
export function useTenantFeatures() {
  return useQuery({
    queryKey: ["tenant", "my-features"],
    queryFn: () =>
      apiClient
        .get("/tenants/my-features")
        .then((r) => r.data.features as Record<string, boolean>),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}