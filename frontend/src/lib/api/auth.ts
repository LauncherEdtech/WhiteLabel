// frontend/src/lib/api/auth.ts

import { apiClient } from "./client";
import { User, AuthTokens } from "@/types/user";

export const authApi = {
    login: async (email: string, password: string) => {
        const res = await apiClient.post<AuthTokens & { user: User }>(
            "/auth/login",
            { email, password }
        );
        return res.data;
    },

    register: async (name: string, email: string, password: string) => {
        const res = await apiClient.post("/auth/register", {
            name,
            email,
            password,
        });
        return res.data;
    },

    me: async () => {
        const res = await apiClient.get<User>("/auth/me");
        return res.data;
    },

    forgotPassword: async (email: string) => {
        const res = await apiClient.post("/auth/forgot-password", { email });
        return res.data;
    },

    resetPassword: async (token: string, new_password: string) => {
        const res = await apiClient.post("/auth/reset-password", {
            token,
            new_password,
        });
        return res.data;
    },
};