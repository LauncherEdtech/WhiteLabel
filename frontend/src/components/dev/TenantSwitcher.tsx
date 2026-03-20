"use client";

import { useState, useEffect } from "react";
import Cookies from "js-cookie";

const TENANTS = [
  {
    slug: "concurso-demo",
    label: "Concurso Demo",
    icon: "👨‍🏫",
    credentials: "aluno@teste.com ou produtor@concursodemo.com",
  },
  {
    slug: "platform",
    label: "Super Admin",
    icon: "🔑",
    credentials: "admin@platform.com",
  },
];

export function TenantSwitcher() {
  const [current, setCurrent] = useState("concurso-demo");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const slug = Cookies.get("tenant_slug") || "concurso-demo";
    setCurrent(slug);

    // Mostra em dev sempre, em produção mostra no domínio ALB (sem domínio customizado)
    const hostname = window.location.hostname;
    const isDev = hostname === "localhost" || hostname.includes("app.github.dev");
    const isALB = hostname.includes(".elb.amazonaws.com");
    setVisible(isDev || isALB);
  }, []);

  const switchTenant = (slug: string) => {
    // Limpa tokens e troca o tenant
    Cookies.remove("access_token");
    Cookies.remove("refresh_token");
    Cookies.set("tenant_slug", slug, { expires: 1, sameSite: "lax" });
    localStorage.clear();
    setCurrent(slug);
    window.location.href = "/login";
  };

  if (!visible) return null;

  return (
    <div className="mt-6 p-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/50">
      <p className="text-xs font-bold text-amber-700 mb-3">
        🏢 Selecionar plataforma
      </p>
      <div className="space-y-2">
        {TENANTS.map(({ slug, label, icon, credentials }) => (
          <button
            key={slug}
            type="button"
            onClick={() => switchTenant(slug)}
            className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
              current === slug
                ? "border-amber-400 bg-amber-100"
                : "border-transparent bg-white hover:border-amber-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{icon}</span>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-800">{label}</p>
                <p className="text-xs text-gray-500 font-mono">{credentials}</p>
              </div>
              {current === slug && (
                <span className="text-xs bg-amber-400 text-white px-2 py-0.5 rounded-full font-bold">
                  ATIVO
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
      <p className="text-xs text-amber-600 mt-2 text-center">
        Ao trocar, você será redirecionado para o login
      </p>
    </div>
  );
}
