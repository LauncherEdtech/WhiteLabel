// frontend/src/components/dev/TenantSwitcher.tsx
"use client";

import { useState, useEffect } from "react";

const TENANTS = [
  {
    slug: "concurso-demo", label: "Produtor / Aluno", icon: "👨‍🏫",
    credentials: "produtor@concursodemo.com ou aluno@teste.com"
  },
  {
    slug: "platform", label: "Super Admin", icon: "🔑",
    credentials: "admin@platform.com / Admin@123456"
  },
];

export function TenantSwitcher() {
  const [current, setCurrent] = useState("concurso-demo");

  useEffect(() => {
    const match = document.cookie.match(/tenant_slug=([^;]+)/);
    if (match) setCurrent(match[1]);
  }, []);

  const switchTenant = (slug: string) => {
    document.cookie = "access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = `tenant_slug=${slug}; path=/; samesite=lax; max-age=86400`;
    localStorage.clear();
    setCurrent(slug);
    window.location.reload();
  };

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="mt-6 p-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/50">
      <p className="text-xs font-bold text-amber-700 mb-3 flex items-center gap-1">
        🛠 Modo desenvolvimento — Trocar tenant
      </p>
      <div className="space-y-2">
        {TENANTS.map(({ slug, label, icon, credentials }) => (
          <button
            key={slug}
            type="button"
            onClick={() => switchTenant(slug)}
            className={`w-full text-left p-3 rounded-lg border-2 transition-all ${current === slug
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
    </div>
  );
}