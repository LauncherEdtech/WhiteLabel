// frontend/src/lib/api/auth.ts
import { apiClient } from "./client";
import { User, AuthTokens } from "@/types/user";
import Cookies from "js-cookie";

// Garante que o tenant slug está sempre definido antes de qualquer chamada
function ensureTenantSlug(): void {
    if (!Cookies.get("tenant_slug")) {
        // Em Codespaces/dev, usa o tenant demo como padrão
        Cookies.set("tenant_slug", "concurso-demo", {
            expires: 1,
            sameSite: "lax",
        });
    }
}

export const authApi = {
    login: async (email: string, password: string) => {
        ensureTenantSlug();
        const res = await apiClient.post<AuthTokens & { user: User }>(
            "/auth/login",
            { email, password }
        );
        return res.data;
    },

    register: async (name: string, email: string, password: string) => {
        ensureTenantSlug();
        const res = await apiClient.post("/auth/register", { name, email, password });
        return res.data;
    },

    me: async () => {
        const res = await apiClient.get<User>("/auth/me");
        return res.data;
    },

    forgotPassword: async (email: string) => {
        ensureTenantSlug();
        const res = await apiClient.post("/auth/forgot-password", { email });
        return res.data;
    },

    resetPassword: async (token: string, new_password: string) => {
        const res = await apiClient.post("/auth/reset-password", { token, new_password });
        return res.data;
    },
};
