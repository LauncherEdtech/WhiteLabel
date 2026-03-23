// frontend/src/app/api/tenant/route.ts
// Route handler Next.js — resolve o tenant pelo slug (cookie ou header)
// IMPORTANTE: cache desabilitado (no-store) para garantir branding sempre fresco.
// O cache de 5min anterior causava o bug de branding "sumindo" após atualizar.

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const slug =
    request.cookies.get("tenant_slug")?.value ||
    request.headers.get("x-tenant-slug") ||
    "concurso-demo";

  const fallback = {
    slug,
    branding: { primary_color: "#4F46E5", platform_name: "Plataforma de Estudos", support_email: "" },
    features: {},
    plan: "basic",
  };

  try {
    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:5000";

    const res = await fetch(`${apiUrl}/api/v1/tenants/by-slug/${slug}`, {
      headers: { "X-Tenant-Slug": slug },
      // ── FIX: era `next: { revalidate: 300 }` — cache de 5 min causava
      // branding stale mesmo após o produtor salvar novas configurações.
      // Desabilitado: cada request busca diretamente do banco via Flask.
      cache: "no-store",
    });

    if (!res.ok) return NextResponse.json(fallback);

    const data = await res.json();
    const tenant = data.tenant || data;

    if (!tenant?.id) return NextResponse.json(fallback);

    // Headers anti-cache para garantir que o browser também não armazene
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