// frontend/src/proxy.ts
// Middleware Next.js — resolve tenant por SUBDOMÍNIO ou por PATH (fallback dev/ALB).
//
// MODO SUBDOMÍNIO (produção):
//   quarteconcurso.launcheredu.com.br → tenant_slug = "quarteconcurso"
//   Cookie scoped ao subdomínio (sem domain=) → isolamento total entre tenants
//
// MODO PATH (fallback dev/ALB direto):
//   /quarteconcurso/login → tenant_slug = "quarteconcurso"
//   Comportamento original mantido para compatibilidade

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PLATFORM_DOMAIN = "launcheredu.com.br";

// Subdomínios reservados — nunca são slugs de tenant
const RESERVED_SUBDOMAINS = new Set([
  "www", "api", "admin", "mail", "smtp", "ftp", "dev", "staging",
]);

// Slugs reservados no roteamento por path (compatibilidade)
const RESERVED_SLUGS = new Set([
  "admin", "api", "_next", "static", "public",
  "favicon.ico", "login", "register", "dashboard",
  "producer", "courses", "questions", "simulados", "schedule",
  "analytics", "profile", "settings", "hall-of-fame", "desempenho",
  "sharing", "study-capsule", "landing"
]);

// Headers de segurança adicionados em todas as respostas HTTPS
function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  // HSTS: força HTTPS por 1 ano após o domínio estar estável
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get("access_token")?.value;
  const host = (request.headers.get("host") || "").toLowerCase();

  // ── APEX DOMAIN → Landing page ────────────────────────────────────────────
  // launcheredu.com.br e www.launcheredu.com.br → /landing
  // Não é tenant, não é admin — é o site institucional da plataforma.
  const isApexDomain =
    host === PLATFORM_DOMAIN ||
    host === `www.${PLATFORM_DOMAIN}`;

  if (isApexDomain) {
    if (pathname.startsWith("/_next") || pathname.startsWith("/api/")) {
      return NextResponse.next();
    }
    // Admin e suas sub-rotas passam livremente no apex
    if (pathname.startsWith("/admin")) {
      // Protege /admin/* — se não tiver token, vai para /admin-login
      if (!pathname.startsWith("/admin-login") && !accessToken) {
        return NextResponse.redirect(new URL("/admin-login", request.url));
      }
      return addSecurityHeaders(NextResponse.next());
    }
    // Qualquer outra rota no apex → landing page
    if (pathname !== "/landing") {
      return NextResponse.redirect(new URL("/landing", request.url));
    }
    return addSecurityHeaders(NextResponse.next());
  }

  // ── MODO SUBDOMÍNIO ────────────────────────────────────────────────────────
  // Detecta: quarteconcurso.launcheredu.com.br
  // NÃO detecta: www.launcheredu.com.br, launcheredu.com.br,
  //              *.elb.amazonaws.com, localhost
  const isSubdomainRequest =
    host.endsWith(`.${PLATFORM_DOMAIN}`) &&
    !host.startsWith("www.") &&
    !host.includes("elb.amazonaws.com") &&
    !host.includes("localhost") &&
    !host.includes("app.github.dev");

  if (isSubdomainRequest) {
    const tenantSlug = host.split(".")[0];

    // Subdomínio reservado → passa sem intervenção
    if (RESERVED_SUBDOMAINS.has(tenantSlug)) {
      return NextResponse.next();
    }

    // Next.js internals e route handlers → não interceptar
    if (pathname.startsWith("/_next") || pathname.startsWith("/api/")) {
      return NextResponse.next();
    }

    // SEGURANÇA: Admin nunca acessível via subdomínio de tenant.
    // Redireciona para o apex para evitar ataques de contexto cruzado.
    if (pathname.startsWith("/admin-login") || pathname.startsWith("/admin")) {
      return NextResponse.redirect(
        new URL(`https://${PLATFORM_DOMAIN}/admin-login`, request.url)
      );
    }

    // ── Cookie de tenant ──────────────────────────────────────────────────
    // SEM domain= → cookie restrito a este subdomínio apenas.
    // Isso garante que tenant A não lê cookie do tenant B.
    const response = addSecurityHeaders(NextResponse.next());
    response.cookies.set("tenant_slug", tenantSlug, {
      httpOnly: false,   // legível pelo JS do client.ts para enviar no header
      sameSite: "lax",
      path: "/",
      maxAge: 86400,     // 1 dia
      secure: true,      // HTTPS obrigatório (garantido pela infra)
    });

    // Paths públicos (acessíveis sem token)
    const PUBLIC_PATHS = [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
    ];
    const isPublic = PUBLIC_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + "?")
    );

    // Raiz / → dashboard (logado) ou login (não logado)
    if (pathname === "/") {
      if (accessToken) {
        return addSecurityHeaders(
          NextResponse.redirect(new URL("/dashboard", request.url))
        );
      }
      return addSecurityHeaders(
        NextResponse.redirect(new URL("/login", request.url))
      );
    }

    if (isPublic) {
      // Já autenticado tentando acessar /login → vai pro dashboard
      if (accessToken && (pathname === "/login" || pathname === "/register")) {
        return addSecurityHeaders(
          NextResponse.redirect(new URL("/dashboard", request.url))
        );
      }
      return response;
    }

    // Rota protegida sem token → /login do tenant
    if (!accessToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return addSecurityHeaders(NextResponse.redirect(loginUrl));
    }

    return response;
  }

  // ── MODO PATH-BASED (fallback: dev local, acesso via ALB direto) ───────────

  // Admin login: rota exclusiva, sem tenant
  if (pathname.startsWith("/admin-login")) {
    if (accessToken) {
      return NextResponse.redirect(new URL("/admin/tenants", request.url));
    }
    return NextResponse.next();
  }

  // Next.js internals e API routes
  if (pathname.startsWith("/_next") || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }
  // ── LANDING PAGE (acesso local) ───────────────────────────────────────────
  if (pathname.startsWith("/landing")) {
    return NextResponse.next();
  }

  // Detecta tenant pelo path: /[tenant]/login, /[tenant]/register
  const parts = pathname.split("/").filter(Boolean);
  const firstSegment = parts[0] ?? "";
  const isTenantPath =
    firstSegment &&
    !RESERVED_SLUGS.has(firstSegment) &&
    /^[a-z0-9-]+$/.test(firstSegment);

  if (isTenantPath) {
    const tenantSlug = firstSegment;
    const subPath = "/" + parts.slice(1).join("/");

    const response = NextResponse.next();
    response.cookies.set("tenant_slug", tenantSlug, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    });

    const tenantPublicPaths = [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "",
    ];
    const isPublic = tenantPublicPaths.some(
      (p) => subPath === p || subPath.startsWith(p + "?")
    );

    if (isPublic) {
      if (
        accessToken &&
        (subPath === "/login" || subPath === "" || subPath === "/register")
      ) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      return response;
    }

    if (!accessToken) {
      const loginUrl = new URL(`/${tenantSlug}/login`, request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  // Raiz /
  if (pathname === "/") {
    const tenantSlug = request.cookies.get("tenant_slug")?.value;
    if (accessToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (tenantSlug && tenantSlug !== "concurso-demo") {
      return NextResponse.redirect(
        new URL(`/${tenantSlug}/login`, request.url)
      );
    }
    return NextResponse.redirect(new URL("/concurso-demo/login", request.url));
  }

  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/concurso-demo/login", request.url));
  }

  // Rotas protegidas sem token
  if (!accessToken) {
    const tenantSlug =
      request.cookies.get("tenant_slug")?.value || "concurso-demo";
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