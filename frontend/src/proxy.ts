// frontend/src/proxy.ts
// Next.js 16+ usa proxy.ts em vez de middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

export function proxy(request: NextRequest) {
    const { pathname, hostname } = request.nextUrl;
    const response = NextResponse.next();

    // ── Resolve tenant slug ───────────────────────────────────────────────────
    const slug = hostname.split(".")[0];
    const isCodespaces = hostname.includes("app.github.dev");
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

    if (!isLocal && !isCodespaces && slug && slug !== "www") {
        // Domínio customizado do produtor
        response.cookies.set("tenant_slug", slug, {
            httpOnly: false,
            sameSite: "lax",
            path: "/",
        });
    } else {
        // Em dev/Codespaces: usa tenant de demo se não tiver cookie
        const existingSlug = request.cookies.get("tenant_slug")?.value;
        if (!existingSlug) {
            response.cookies.set("tenant_slug", "concurso-demo", {
                httpOnly: false,
                sameSite: "lax",
                path: "/",
            });
        }
    }

    // ── Autenticação ──────────────────────────────────────────────────────────
    const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));
    const accessToken = request.cookies.get("access_token")?.value;

    if (isPublicRoute && accessToken) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (!isPublicRoute && !accessToken && pathname !== "/") {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
    }

    if (pathname === "/") {
        return NextResponse.redirect(
            new URL(accessToken ? "/dashboard" : "/login", request.url)
        );
    }

    return response;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};