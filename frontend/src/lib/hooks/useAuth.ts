// frontend/src/lib/hooks/useAuth.ts
// CORRIGIDO: useLogin aceita tenantSlug e passa direto para authApi.login,
// garantindo que o header X-Tenant-Slug seja sempre correto independente de cookie.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/stores/authStore";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { applyBrandingCssVars } from "@/components/TenantBrandingLoader";

export const AUTH_KEYS = {
    me: ["auth", "me"] as const,
};

export function useMe() {
    const { setUser } = useAuthStore();
    const { tenant, setTenant } = useTenantStore();

    return useQuery({
        queryKey: AUTH_KEYS.me,
        queryFn: async () => {
            const user = await authApi.me();
            setUser(user);

            if (!tenant?.id) {
                const slug = Cookies.get("tenant_slug") || "concurso-demo";
                try {
                    const res = await fetch(`/api/v1/tenants/by-slug/${slug}`, {
                        headers: { "X-Tenant-Slug": slug },
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data?.tenant?.id) {
                            setTenant(data.tenant);
                            applyBrandingCssVars(data.tenant.branding || {});
                        }
                    }
                } catch { /* silencioso */ }
            }
            return user;
        },
        enabled: !Cookies.get("access_token") ? false : true,
        staleTime: 5 * 60 * 1000,
        retry: false,
    });
}

export function useLogin() {
    const { setUser, setTokens } = useAuthStore();
    const { setTenant } = useTenantStore();
    const queryClient = useQueryClient();
    const router = useRouter();

    return useMutation({
        mutationFn: ({
            email,
            password,
            tenantSlug,   // ← recebe o slug e passa direto para authApi
        }: {
            email: string;
            password: string;
            tenantSlug?: string;
        }) => authApi.login(email, password, tenantSlug),

        onSuccess: (data) => {
            setTokens(data.access_token, data.refresh_token);
            setUser(data.user);
            queryClient.setQueryData(AUTH_KEYS.me, data.user);

            if ((data as any).tenant?.id) {
                setTenant((data as any).tenant);
                applyBrandingCssVars((data as any).tenant.branding || {});
            }

            if (data.user.role === "student") {
                router.push("/dashboard");
            } else if (
                data.user.role === "producer_admin" ||
                data.user.role === "producer_staff"
            ) {
                router.push("/producer/dashboard");
            } else {
                router.push("/admin/tenants");
            }
        },
    });
}

export function useLogout() {
    const { logout } = useAuthStore();
    const { clearTenant } = useTenantStore();
    const queryClient = useQueryClient();
    const router = useRouter();

    return () => {
        const tenantSlug = Cookies.get("tenant_slug") || "concurso-demo";
        Cookies.remove("access_token");
        Cookies.remove("refresh_token");
        logout();
        clearTenant();
        queryClient.clear();
        router.push(`/${tenantSlug}/login`);
    };
}