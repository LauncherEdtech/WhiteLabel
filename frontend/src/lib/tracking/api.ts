// frontend/src/lib/tracking/api.ts
import { apiClient } from "@/lib/api/client";
import type { QueuedEvent } from "./types";

/**
 * Envia um batch de eventos para /events/track.
 * Timeout curto (5s) — tracking não pode bloquear nada.
 */
export async function postEventBatch(events: QueuedEvent[]): Promise<void> {
    await apiClient.post("/events/track", { events }, { timeout: 5000 });
}