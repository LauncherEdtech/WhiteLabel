// frontend/src/lib/api/auth.ts
// CORRIGIDO: login() e register() aceitam tenantSlug como parâmetro opcional.
// Quando fornecido, passa X-Tenant-Slug diretamente no header da requisição —
// sem depender de cookie estar setado. Elimina a race condition do useEffect.

import { apiClient } from "./client";
import { User, AuthTokens } from "@/types/user";
import Cookies from "js-cookie";

function ensureTenantSlug(slug?: string): string {
    const resolved = slug || Cookies.get("tenant_slug") || "concurso-demo";
    // Sempre sincroniza o cookie com o slug resolvido
    Cookies.set("tenant_slug", resolved, { expires: 1, sameSite: "lax" });
    return resolved;
}

export const authApi = {
    login: async (email: string, password: string, tenantSlug?: string) => {
        const slug = ensureTenantSlug(tenantSlug);
        const res = await apiClient.post<AuthTokens & { user: User }>(
            "/auth/login",
            { email, password },
            // Passa o header diretamente — não depende do interceptor ler o cookie
            { headers: { "X-Tenant-Slug": slug } }
        );
        return res.data;
    },

    register: async (name: string, email: string, password: string, tenantSlug?: string) => {
        const slug = ensureTenantSlug(tenantSlug);
        const res = await apiClient.post(
            "/auth/register",
            { name, email, password },
            { headers: { "X-Tenant-Slug": slug } }
        );
        return res.data;
    },

    me: async () => {
        const res = await apiClient.get<User>("/auth/me");
        return res.data;
    },

    forgotPassword: async (email: string, tenantSlug?: string) => {
        const slug = ensureTenantSlug(tenantSlug);
        const res = await apiClient.post(
            "/auth/forgot-password",
            { email },
            { headers: { "X-Tenant-Slug": slug } }
        );
        return res.data;
    },

    resetPassword: async (token: string, new_password: string) => {
        const res = await apiClient.post("/auth/reset-password", { token, new_password });
        return res.data;
    },
};