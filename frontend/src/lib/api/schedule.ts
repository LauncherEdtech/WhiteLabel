// frontend/src/lib/api/schedule.ts
import { apiClient } from "./client";

export const uncheckinItem = (itemId: string) =>
    apiClient.delete(`/schedule/checkin/${itemId}`);

// ── Tipos para geração assíncrona ─────────────────────────────────────────────

export interface ScheduleGeneratePending {
    status: "pending";
    task_id: string;
    poll_url: string;
}

export interface ScheduleGenerateReady {
    status: "ready";
    message: string;
    schedule: unknown;
    abandonment_risk: number;
    coverage_gap?: unknown;
}

export interface ScheduleGenerateError {
    status: "error";
    message: string;
}

export type ScheduleStatusResponse =
    | { status: "pending" }
    | ScheduleGenerateReady
    | ScheduleGenerateError;

// ── API ───────────────────────────────────────────────────────────────────────

export const scheduleApi = {
    /**
     * Enfileira geração do cronograma (async via Celery).
     * Retorna task_id imediatamente. Use generateAndWait() para aguardar resultado.
     */
    generate: async (courseId: string, targetDate?: string): Promise<ScheduleGeneratePending> => {
        const res = await apiClient.post("/schedule/generate", {
            course_id: courseId,
            target_date: targetDate || null,
        });
        return res.data;
    },

    /**
     * Polling de status da geração assíncrona.
     * Chamar a cada 2s até status="ready" ou "error".
     */
    status: async (taskId: string): Promise<ScheduleStatusResponse> => {
        const res = await apiClient.get(`/schedule/status/${taskId}`);
        return res.data;
    },

    /**
     * Helper completo: enfileira geração e aguarda conclusão com polling automático.
     * Resolve com { status: "ready", schedule, ... } quando pronto.
     * Rejeita com Error após timeout ou se a task retornar erro.
     */
    generateAndWait: async (
        courseId: string,
        targetDate?: string,
        maxWaitMs = 120_000,
        intervalMs = 2_000,
    ): Promise<ScheduleGenerateReady> => {
        const initial = await scheduleApi.generate(courseId, targetDate);
        const { task_id } = initial;

        const deadline = Date.now() + maxWaitMs;

        return new Promise((resolve, reject) => {
            const poll = async () => {
                if (Date.now() > deadline) {
                    reject(new Error("Timeout aguardando geração do cronograma"));
                    return;
                }

                try {
                    const state = await scheduleApi.status(task_id);

                    if (state.status === "ready") {
                        resolve(state as ScheduleGenerateReady);
                    } else if (state.status === "error") {
                        reject(new Error((state as ScheduleGenerateError).message || "Erro ao gerar cronograma"));
                    } else {
                        // pending → aguarda e tenta novamente
                        setTimeout(poll, intervalMs);
                    }
                } catch {
                    // Erro de rede transitório → tenta novamente
                    setTimeout(poll, intervalMs);
                }
            };

            setTimeout(poll, intervalMs);
        });
    },

    get: async (courseId: string, days: number = 14) => {
        const res = await apiClient.get("/schedule/", {
            params: { course_id: courseId, days },
        });
        return res.data;
    },

    checkin: async (
        itemId: string,
        payload: {
            completed: boolean;
            note?: string;
            perceived_difficulty?: "easy" | "ok" | "hard";
        }
    ) => {
        const res = await apiClient.post(`/schedule/checkin/${itemId}`, payload);
        return res.data;
    },

    reorganize: async (courseId: string) => {
        const res = await apiClient.post("/schedule/reorganize", { course_id: courseId });
        return res.data;
    },

    updateAvailability: async (payload: {
        days: number[];
        hours_per_day: number;
        preferred_start_time?: string;
        break_minutes?: number;
    }) => {
        const res = await apiClient.put("/schedule/availability", payload);
        return res.data;
    },

    delete: async (courseId: string) => {
        const res = await apiClient.delete("/schedule/", {
            params: { course_id: courseId },
        });
        return res.data;
    },
};