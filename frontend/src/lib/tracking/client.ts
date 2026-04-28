// frontend/src/lib/tracking/client.ts
// Singleton de tracking — buffer + batching + flush automático.
// Fire-and-forget: nunca bloqueia o usuário.

import type { TrackEvent, QueuedEvent } from "./types";

const SESSION_KEY = "tracking_session_id";
const SESSION_STARTED_KEY = "tracking_session_started";
const BUFFER_KEY = "tracking_buffer";
const MAX_BUFFER_SIZE = 15;
const MAX_BATCH_SIZE = 50; // bate com o limite do backend
const FLUSH_INTERVAL_MS = 5000;
const MAX_RETRY = 3;

let sessionId: string | null = null;
let buffer: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushFn: ((events: QueuedEvent[]) => Promise<void>) | null = null;
let isInitialized = false;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

function generateUuid(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function loadBufferFromStorage(): QueuedEvent[] {
    if (typeof sessionStorage === "undefined") return [];
    try {
        const raw = sessionStorage.getItem(BUFFER_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function persistBuffer(events: QueuedEvent[]) {
    if (typeof sessionStorage === "undefined") return;
    try {
        sessionStorage.setItem(BUFFER_KEY, JSON.stringify(events));
    } catch {
        // sessionStorage cheio — descarta silenciosamente
    }
}

function clearPersistedBuffer() {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.removeItem(BUFFER_KEY);
}

function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return m ? decodeURIComponent(m[1]) : null;
}

function resolveApiUrl(): string {
    // Mesma lógica do apiClient: usa NEXT_PUBLIC_API_URL se disponível,
    // senão cai em /api/v1 relativo.
    return process.env.NEXT_PUBLIC_API_URL || "/api/v1";
}

// ─────────────────────────────────────────────────────────────────────────────
// Sessão
// ─────────────────────────────────────────────────────────────────────────────

export function getSessionId(): string {
    if (typeof window === "undefined") return "";
    if (!sessionId) {
        sessionId = sessionStorage.getItem(SESSION_KEY);
        if (!sessionId) {
            sessionId = generateUuid();
            sessionStorage.setItem(SESSION_KEY, sessionId);
        }
    }
    return sessionId;
}

export function isSessionStarted(): boolean {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(SESSION_STARTED_KEY) === "true";
}

export function markSessionStarted() {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(SESSION_STARTED_KEY, "true");
}

export function clearSession() {
    if (typeof window === "undefined") return;
    sessionId = null;
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_STARTED_KEY);
    clearPersistedBuffer();
    buffer = [];
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────────

export function initTracking(flushFunction: (events: QueuedEvent[]) => Promise<void>) {
    if (isInitialized || typeof window === "undefined") return;
    isInitialized = true;
    flushFn = flushFunction;

    // Recupera buffer persistido (caso a aba tenha sido fechada com pendências)
    buffer = loadBufferFromStorage();

    // Flush periódico
    flushTimer = setInterval(() => {
        if (buffer.length > 0) flush().catch(() => { });
    }, FLUSH_INTERVAL_MS);

    // Flush ao sair da página — usa fetch keepalive (axios é cancelado no unload)
    window.addEventListener("beforeunload", flushBeacon);
    // Flush quando a aba fica hidden (mobile, troca de tab, lock screen)
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flushBeacon();
    });
}

export function track(event: TrackEvent) {
    if (typeof window === "undefined") return;

    const queuedEvent: QueuedEvent = {
        ...event,
        session_id: getSessionId(),
        client_timestamp: event.client_timestamp || new Date().toISOString(),
    };

    buffer.push(queuedEvent);
    persistBuffer(buffer);

    if (buffer.length >= MAX_BUFFER_SIZE) {
        flush().catch(() => { });
    }
}

export async function flush(): Promise<void> {
    if (!flushFn || buffer.length === 0) return;

    const events = buffer.splice(0, MAX_BATCH_SIZE);
    persistBuffer(buffer);

    let attempt = 0;
    while (attempt < MAX_RETRY) {
        try {
            await flushFn(events);
            // Sucesso — buffer já foi reduzido, persiste o restante (pode ter chegado mais)
            if (buffer.length > 0) persistBuffer(buffer);
            else clearPersistedBuffer();
            return;
        } catch {
            attempt++;
            if (attempt >= MAX_RETRY) {
                // Descarta após 3 tentativas — não vale a pena re-bufferar indefinidamente
                if (buffer.length > 0) persistBuffer(buffer);
                else clearPersistedBuffer();
                return;
            }
            await new Promise((r) => setTimeout(r, 500 * attempt));
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Flush no unload — fetch com keepalive (suporta headers de auth)
// ─────────────────────────────────────────────────────────────────────────────

function flushBeacon() {
    if (buffer.length === 0) return;

    const token = getCookie("access_token");
    const tenantSlug = getCookie("tenant_slug");
    if (!token || !tenantSlug) {
        // Sem auth → não tenta enviar, só descarta para liberar storage
        buffer = [];
        clearPersistedBuffer();
        return;
    }

    const events = buffer.splice(0, MAX_BATCH_SIZE);
    clearPersistedBuffer();

    try {
        fetch(`${resolveApiUrl()}/events/track`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                "X-Tenant-Slug": tenantSlug,
            },
            body: JSON.stringify({ events }),
            keepalive: true,
        }).catch(() => { });
    } catch {
        // Browser pode bloquear fetch durante unload — descarta silenciosamente
    }
}