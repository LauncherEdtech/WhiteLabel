// frontend/src/lib/api/client.ts
import axios, { AxiosError, AxiosInstance } from "axios";
import Cookies from "js-cookie";

// URL da API:
// - Servidor (SSR/RSC): usa NEXT_PUBLIC_API_URL diretamente (HTTPS absoluto)
// - Cliente (browser): usa NEXT_PUBLIC_API_URL se disponível (Vercel, produção)
//   OU usa "/api/v1" relativo (dev local com rewrite do next.config.ts)
// Isso elimina a dependência de rewrites em produção e evita Mixed Content.
const isServer = typeof window === "undefined";
const API_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    (isServer ? "http://localhost:5000/api/v1" : "/api/v1");

const DEFAULT_TENANT = "concurso-demo";
const PLATFORM_DOMAIN = "launcheredu.com.br";

function resolveTenantSlug(): string {
    if (typeof window === "undefined") return DEFAULT_TENANT;

    const hostname = window.location.hostname;

    // Localhost / Codespaces → sempre concurso-demo
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    const isCodespaces = hostname.includes("app.github.dev");
    if (isLocal || isCodespaces) {
        Cookies.set("tenant_slug", DEFAULT_TENANT, { sameSite: "lax", expires: 1 });
        return DEFAULT_TENANT;
    }

    // ALB direto → lê do cookie (setado pelo proxy.ts via URL path)
    const isALB = hostname.includes(".elb.amazonaws.com");
    if (isALB) {
        const cookieSlug = Cookies.get("tenant_slug");
        if (cookieSlug) return cookieSlug;
        return DEFAULT_TENANT;
    }

    // APEX domain (launcheredu.com.br ou www.launcheredu.com.br) →
    // não é tenant. Sem isso, "launcheredu" seria extraído como slug → 404.
    const isApex =
        hostname === PLATFORM_DOMAIN || hostname === `www.${PLATFORM_DOMAIN}`;
    if (isApex) {
        // Rotas /admin-login e /admin/* sempre usam o tenant "platform"
        // (onde o super admin está cadastrado)
        const path = window.location.pathname;
        if (path.startsWith("/admin")) {
            return "platform";
        }
        const cookieSlug = Cookies.get("tenant_slug");
        if (cookieSlug && cookieSlug !== PLATFORM_DOMAIN) return cookieSlug;
        return DEFAULT_TENANT;
    }

    // Subdomínio de tenant: quarteconcurso.launcheredu.com.br → quarteconcurso
    if (hostname.endsWith(`.${PLATFORM_DOMAIN}`)) {
        const slug = hostname.split(".")[0];
        Cookies.set("tenant_slug", slug, { sameSite: "lax", expires: 1, secure: true });
        return slug;
    }

    // Domínio customizado do produtor (Fase 2) → lê do cookie
    const cookieSlug = Cookies.get("tenant_slug");
    if (cookieSlug) return cookieSlug;

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