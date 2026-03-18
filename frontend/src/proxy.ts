// frontend/src/proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password", "/admin-login"];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const response = NextResponse.next();

    // Só define o cookie se ainda NÃO existir
    // Nunca sobrescreve o que o usuário setou manualmente
    const existingSlug = request.cookies.get("tenant_slug")?.value;

    if (!existingSlug) {
        response.cookies.set("tenant_slug", "concurso-demo", {
            httpOnly: false,
            sameSite: "lax",
            path: "/",
        });
    }

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