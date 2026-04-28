// frontend/src/components/TrackingProvider.tsx
// Inicializa o cliente de tracking, gerencia ciclo de vida da sessão
// e ativa o tracking automático de páginas.
//
// Deve estar dentro de QueryClientProvider e ter acesso ao authStore.

"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/lib/stores/authStore";
import {
    initTracking,
    track,
    getSessionId,
    isSessionStarted,
    markSessionStarted,
    clearSession,
    flush,
} from "@/lib/tracking/client";
import { postEventBatch } from "@/lib/tracking/api";
import { usePageTracking } from "@/lib/hooks/usePageTracking";

export function TrackingProvider({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated } = useAuthStore();
    const lastUserIdRef = useRef<string | null>(null);
    const sessionStartedRef = useRef(false);

    // Inicializa o cliente UMA VEZ
    useEffect(() => {
        initTracking(postEventBatch);
    }, []);

    // Gerencia ciclo de vida da sessão
    useEffect(() => {
        // Não autenticado → finaliza sessão se havia uma
        if (!isAuthenticated || !user) {
            if (sessionStartedRef.current) {
                track({ event_type: "session_end", feature_name: "session" });
                flush().catch(() => { });
                clearSession();
                sessionStartedRef.current = false;
                lastUserIdRef.current = null;
            }
            return;
        }

        // Mudou de usuário (logout + login com outro email) → reseta sessão
        if (lastUserIdRef.current && lastUserIdRef.current !== user.id) {
            clearSession();
            sessionStartedRef.current = false;
        }

        if (!sessionStartedRef.current) {
            // Já existe sessão no storage (reload da página, p.ex.) → não dispara session_start de novo
            if (isSessionStarted()) {
                getSessionId(); // garante que está em memória
                sessionStartedRef.current = true;
                lastUserIdRef.current = user.id;
                return;
            }

            // Nova sessão real
            getSessionId();
            track({
                event_type: "session_start",
                feature_name: "session",
                metadata: {
                    user_agent:
                        typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
                    screen:
                        typeof window !== "undefined"
                            ? `${window.innerWidth}x${window.innerHeight}`
                            : null,
                    language: typeof navigator !== "undefined" ? navigator.language : null,
                },
            });
            markSessionStarted();
            sessionStartedRef.current = true;
            lastUserIdRef.current = user.id;
        }
    }, [isAuthenticated, user]);

    // Page tracking automático em mudanças de rota
    usePageTracking();

    return <>{children}</>;
}