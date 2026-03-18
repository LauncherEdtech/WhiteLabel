// frontend/src/app/api/tenant/route.ts
// Route handler Next.js — resolve o tenant pelo slug (cookie ou header)
// Usado pelo ThemeProvider para buscar o branding no SSR
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const slug =
    request.cookies.get("tenant_slug")?.value ||
    request.headers.get("x-tenant-slug") ||
    "concurso-demo";

  try {
    const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:5000";
    const res = await fetch(`${apiUrl}/api/v1/tenants/by-slug/${slug}`, {
      headers: { "X-Tenant-Slug": slug },
      next: { revalidate: 300 }, // cache 5min
    });

    if (!res.ok) {
      return NextResponse.json({ slug, branding: { primary_color: "#4F46E5", platform_name: "Plataforma de Estudos" } });
    }

    const data = await res.json();
    return NextResponse.json(data.tenant || data);
  } catch {
    // Fallback se API não estiver disponível
    return NextResponse.json({
      slug,
      branding: { primary_color: "#4F46E5", platform_name: "Plataforma de Estudos", support_email: "" },
      features: {},
      plan: "pro",
    });
  }
}
