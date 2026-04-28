// frontend/src/lib/hooks/usePageTracking.ts
// Dispara page_view automático em cada mudança de rota.
// Também dispara page_leave da página anterior com a duração.

"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/tracking/client";
import { useAuthStore } from "@/lib/stores/authStore";

export function usePageTracking() {
    const pathname = usePathname();
    const { isAuthenticated } = useAuthStore();
    const prevPathRef = useRef<string | null>(null);
    const prevTimeRef = useRef<number | null>(null);

    useEffect(() => {
        if (!isAuthenticated || !pathname) return;

        const now = Date.now();

        // page_leave da página anterior — com duração real
        if (prevPathRef.current && prevTimeRef.current) {
            track({
                event_type: "page_leave",
                feature_name: "navigation",
                metadata: {
                    path: prevPathRef.current,
                    duration_ms: now - prevTimeRef.current,
                },
            });
        }

        // page_view da nova
        track({
            event_type: "page_view",
            feature_name: "navigation",
            metadata: {
                path: pathname,
                referrer: prevPathRef.current,
            },
        });

        prevPathRef.current = pathname;
        prevTimeRef.current = now;
    }, [pathname, isAuthenticated]);
}