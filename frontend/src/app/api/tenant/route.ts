// frontend/src/app/api/tenant/route.ts
// Route handler Next.js — resolve o tenant pelo slug.
//
// Ordem de prioridade (maior → menor):
//   1. query param ?slug=X  (useTenantBySlug antes do cookie existir)
//   2. HOST header          (subdomínio: quarteconcurso.launcheredu.com.br)
//   3. x-tenant-slug header (chamadas internas)
//   4. cookie tenant_slug   (sessão ativa)
//   5. "concurso-demo"      (fallback)
//
// Cache desabilitado (no-store) — branding deve ser sempre fresco.

import { NextRequest, NextResponse } from "next/server";

const PLATFORM_DOMAIN = "launcheredu.com.br";
const RESERVED_SUBDOMAINS = new Set(["www", "api", "admin", "mail"]);

function extractSlugFromHost(host: string): string | null {
  if (!host.endsWith(`.${PLATFORM_DOMAIN}`)) return null;
  if (host.startsWith("www.")) return null;

  const subdomain = host.split(".")[0].toLowerCase();
  if (RESERVED_SUBDOMAINS.has(subdomain)) return null;

  return subdomain;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const host = (request.headers.get("host") || "").toLowerCase();

  const slug =
    searchParams.get("slug") ||
    extractSlugFromHost(host) ||
    request.headers.get("x-tenant-slug") ||
    request.cookies.get("tenant_slug")?.value ||
    "concurso-demo";

  const fallback = {
    slug,
    branding: {
      primary_color: "#4F46E5",
      platform_name: "Plataforma de Estudos",
      support_email: "",
    },
    features: {},
    plan: "basic",
  };

  try {
    // Prioridade de URL para chamada server-side:
    // 1. INTERNAL_API_URL (ex: https://api.launcheredu.com.br — sem /api/v1)
    // 2. NEXT_PUBLIC_API_URL sem /api/v1 (ex: https://api.launcheredu.com.br)
    // 3. localhost (dev)
    //
    // IMPORTANTE: remove /api/v1 do final se presente (evita URL duplicada).
    // Garante que sempre use HTTPS — nunca HTTP — para evitar Mixed Content
    // e falha de SSL ao redirecionar via ALB.
    const rawUrl =
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") ||
      "http://localhost:5000";
    const apiUrl = rawUrl.replace(/\/api\/v1\/?$/, "");

    const res = await fetch(`${apiUrl}/api/v1/tenants/by-slug/${slug}`, {
      headers: { "X-Tenant-Slug": slug },
      cache: "no-store",
    });

    if (!res.ok) return NextResponse.json(fallback);

    const data = await res.json();
    const tenant = data.tenant || data;

    if (!tenant?.id) return NextResponse.json(fallback);

    return NextResponse.json(tenant, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    });
  } catch {
    return NextResponse.json(fallback);
  }
}