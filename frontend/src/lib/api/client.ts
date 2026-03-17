// frontend/src/lib/api/client.ts
// Cliente HTTP base com interceptors de auth e tenant.
// SEGURANÇA: Token JWT injetado automaticamente em toda requisição.

import axios, { AxiosError, AxiosInstance } from "axios";
import Cookies from "js-cookie";

const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

// Cria instância base
export const apiClient: AxiosInstance = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    headers: {
        "Content-Type": "application/json",
    },
});

// ── Request interceptor ───────────────────────────────────────────────────────
// Injeta token JWT e header de tenant em toda requisição
apiClient.interceptors.request.use((config) => {
    // Token JWT do cookie ou localStorage
    const token = Cookies.get("access_token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // Tenant slug do cookie (resolvido pelo middleware Next.js)
    const tenantSlug = Cookies.get("tenant_slug");
    if (tenantSlug) {
        config.headers["X-Tenant-Slug"] = tenantSlug;
    }

    return config;
});

// ── Response interceptor ──────────────────────────────────────────────────────
// Trata expiração de token e erros globais
apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as typeof error.config & {
            _retry?: boolean;
        };

        // Token expirado → tenta renovar com refresh_token
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const refreshToken = Cookies.get("refresh_token");
            if (refreshToken) {
                try {
                    const tenantSlug = Cookies.get("tenant_slug");
                    const res = await axios.post(
                        `${API_URL}/auth/refresh`,
                        {},
                        {
                            headers: {
                                Authorization: `Bearer ${refreshToken}`,
                                ...(tenantSlug && { "X-Tenant-Slug": tenantSlug }),
                            },
                        }
                    );

                    const { access_token } = res.data;
                    Cookies.set("access_token", access_token, {
                        expires: 1 / 24, // 1 hora
                        secure: process.env.NODE_ENV === "production",
                        sameSite: "lax",
                    });

                    // Retenta a requisição original com o novo token
                    if (originalRequest.headers) {
                        originalRequest.headers.Authorization = `Bearer ${access_token}`;
                    }
                    return apiClient(originalRequest);
                } catch {
                    // Refresh falhou → limpa sessão e redireciona para login
                    Cookies.remove("access_token");
                    Cookies.remove("refresh_token");
                    Cookies.remove("user");
                    if (typeof window !== "undefined") {
                        window.location.href = "/login";
                    }
                }
            }
        }

        return Promise.reject(error);
    }
);

export default apiClient;