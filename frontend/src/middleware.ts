// frontend/src/middleware.ts
// Resolve o tenant pelo domínio ANTES de qualquer renderização.
// Redireciona para login se não autenticado em rotas protegidas.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rotas que não precisam de autenticação
const PUBLIC_ROUTES = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
];

// Rotas exclusivas por papel
const PRODUCER_ROUTES = ["/producer"];
const ADMIN_ROUTES = ["/admin"];

export function middleware(request: NextRequest) {
    const { pathname, hostname } = request.nextUrl;
    const response = NextResponse.next();

    // ── 1. Resolve tenant pelo hostname ──────────────────────────────────────
    // Ex: curso-juridico.plataforma.com → slug = "curso-juridico"
    // Ex: www.cursojuridico.com.br → usa o hostname completo
    const slug = hostname.split(".")[0];

    // Define o slug do tenant em cookie para o apiClient usar
    if (slug && slug !== "www" && slug !== "localhost") {
        response.cookies.set("tenant_slug", slug, {
            httpOnly: false, // Precisa ser lido pelo JS do cliente
            sameSite: "lax",
            path: "/",
        });
    }

    // ── 2. Verifica autenticação ──────────────────────────────────────────────
    const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));
    const accessToken = request.cookies.get("access_token")?.value;

    // Rota pública + tem token → redireciona para dashboard
    if (isPublicRoute && accessToken) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Rota protegida + sem token → redireciona para login
    if (!isPublicRoute && !accessToken && pathname !== "/") {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
    }

    // ── 3. Controle de acesso por papel ──────────────────────────────────────
    // (Verificação completa acontece no layout de cada grupo)
    const isProducerRoute = PRODUCER_ROUTES.some((r) => pathname.startsWith(r));
    const isAdminRoute = ADMIN_ROUTES.some((r) => pathname.startsWith(r));

    // Rota raiz → redireciona conforme estado
    if (pathname === "/") {
        if (accessToken) {
            return NextResponse.redirect(new URL("/dashboard", request.url));
        }
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return response;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};