// frontend/src/proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Slugs reservados que NÃO são tenants
const RESERVED_SLUGS = new Set([
  "admin", "api", "_next", "static", "public",
  "favicon.ico", "login", "register", "dashboard",
  "producer", "courses", "questions", "simulados", "schedule",
  "analytics", "profile", "settings",
]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get("access_token")?.value;

  // ── Admin: /admin-login é rota exclusiva, sem tenant ──────────────────
  if (pathname.startsWith("/admin-login")) {
    if (accessToken) {
      return NextResponse.redirect(new URL("/admin/tenants", request.url));
    }
    return NextResponse.next();
  }

  // ── Rotas internas do Next.js ─────────────────────────────────────────
  if (pathname.startsWith("/_next") || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // ── Detecta tenant pelo path: /[tenant]/login, /[tenant]/register etc ─
  const parts = pathname.split("/").filter(Boolean); // ["qgconcursos", "login"]
  const firstSegment = parts[0] ?? "";
  const isTenantPath = firstSegment &&
    !RESERVED_SLUGS.has(firstSegment) &&
    /^[a-z0-9-]+$/.test(firstSegment);

  if (isTenantPath) {
    const tenantSlug = firstSegment;
    const subPath = "/" + parts.slice(1).join("/"); // "/login", "/register" etc

    const response = NextResponse.next();

    // Seta o tenant cookie a partir da URL — sem precisar de TenantSwitcher!
    response.cookies.set("tenant_slug", tenantSlug, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 86400, // 1 dia
    });

    // Rotas públicas do tenant (sem token necessário)
    const tenantPublicPaths = ["/login", "/register", "/forgot-password", "/reset-password", ""];
    const isPublic = tenantPublicPaths.some(p => subPath === p || subPath.startsWith(p + "?"));

    if (isPublic) {
      // Se já logado, redireciona para dentro do app
      if (accessToken && (subPath === "/login" || subPath === "" || subPath === "/register")) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      return response;
    }

    // Rota protegida do tenant sem token → login do tenant
    if (!accessToken) {
      const loginUrl = new URL(`/${tenantSlug}/login`, request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  // ── Raiz / ────────────────────────────────────────────────────────────
  if (pathname === "/") {
    const tenantSlug = request.cookies.get("tenant_slug")?.value;
    if (accessToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (tenantSlug && tenantSlug !== "concurso-demo") {
      return NextResponse.redirect(new URL(`/${tenantSlug}/login`, request.url));
    }
    return NextResponse.redirect(new URL("/concurso-demo/login", request.url));
  }

  // ── /login sem tenant → redireciona para /concurso-demo/login ────────
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/concurso-demo/login", request.url));
  }

  // ── Rotas protegidas (dashboard, producer, etc) ───────────────────────
  if (!accessToken) {
    const tenantSlug = request.cookies.get("tenant_slug")?.value || "concurso-demo";
    const loginUrl = new URL(`/${tenantSlug}/login`, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
