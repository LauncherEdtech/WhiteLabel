// frontend/src/components/layout/TopBar.tsx
"use client";

import { Bell } from "lucide-react";
import { useAuthStore } from "@/lib/stores/authStore";
import { useTenantStore } from "@/lib/stores/tenantStore";

export function TopBar() {
    const { user } = useAuthStore();
    const { getBranding } = useTenantStore();
    const branding = getBranding();

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return "Bom dia";
        if (h < 18) return "Boa tarde";
        return "Boa noite";
    };

    return (
        <header className="h-16 shrink-0 border-b border-border bg-card/50 backdrop-blur-sm px-6 flex items-center justify-between">
            <div>
                <p className="text-sm text-muted-foreground">
                    {greeting()},{" "}
                    <span className="font-medium text-foreground">
                        {user?.name?.split(" ")[0]}
                    </span>{" "}
                    👋
                </p>
            </div>

            <div className="flex items-center gap-3">
                <button className="relative h-9 w-9 rounded-lg border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                    <Bell className="h-4 w-4" />
                </button>
            </div>
        </header>
    );
}