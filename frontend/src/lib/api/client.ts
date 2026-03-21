// frontend/src/lib/api/client.ts
import axios, { AxiosError, AxiosInstance } from "axios";
import Cookies from "js-cookie";

// URL relativa no browser → Next.js proxia via rewrite /api/* → Flask
// URL absoluta no servidor (SSR) → direto para o Flask
const isServer = typeof window === "undefined";
const API_URL = isServer
    ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1")
    : "/api/v1";

// Em dev/Codespaces sempre usa este tenant
const DEFAULT_TENANT = "concurso-demo";

function resolveTenantSlug(): string {
    if (typeof window === "undefined") return DEFAULT_TENANT;

    const hostname = window.location.hostname;

    // Codespaces ou localhost → sempre concurso-demo
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    const isCodespaces = hostname.includes("app.github.dev");

    if (isLocal || isCodespaces) {
        Cookies.set("tenant_slug", DEFAULT_TENANT, { sameSite: "lax", expires: 1 });
        return DEFAULT_TENANT;
    }

    // ALB ou localhost — lê do cookie (setado pelo proxy.ts via URL)
    const isALB = hostname.includes(".elb.amazonaws.com");
    if (isALB || isLocal) {
        const cookieSlug = Cookies.get("tenant_slug");
        if (cookieSlug) return cookieSlug;
        return DEFAULT_TENANT;
    }

    // Produção com domínio customizado: extrai do subdomínio
    // Ex: cursojuridico.plataforma.com → cursojuridico
    const parts = hostname.split(".");
    if (parts.length >= 3) {
        const slug = parts[0];
        Cookies.set("tenant_slug", slug, { sameSite: "lax", expires: 1 });
        return slug;
    }

    return DEFAULT_TENANT;
}

export const apiClient: AxiosInstance = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    headers: {
        "Content-Type": "application/json",
        "X-Tenant-Slug": DEFAULT_TENANT,
    },
});

apiClient.interceptors.request.use((config) => {
    const token = Cookies.get("access_token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // Sempre resolve o tenant corretamente
    const tenantSlug = resolveTenantSlug();
    config.headers["X-Tenant-Slug"] = tenantSlug;

    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as typeof error.config & {
            _retry?: boolean;
        };

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = Cookies.get("refresh_token");
            if (refreshToken) {
                try {
                    const res = await axios.post(
                        `/api/v1/auth/refresh`,
                        {},
                        {
                            headers: {
                                Authorization: `Bearer ${refreshToken}`,
                                "X-Tenant-Slug": resolveTenantSlug(),
                            },
                        }
                    );
                    const { access_token } = res.data;
                    Cookies.set("access_token", access_token, {
                        expires: 1 / 24,
                        secure: process.env.NODE_ENV === "production",
                        sameSite: "lax",
                    });
                    if (originalRequest.headers) {
                        originalRequest.headers.Authorization = `Bearer ${access_token}`;
                    }
                    return apiClient(originalRequest);
                } catch {
                    Cookies.remove("access_token");
                    Cookies.remove("refresh_token");
                    window.location.href = "/login";
                }
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;