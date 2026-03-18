// frontend/src/lib/api/simulados.ts
import { apiClient } from "./client";

export const simuladosApi = {
    list: async (courseId?: string) => {
        const res = await apiClient.get("/simulados/", {
            params: courseId ? { course_id: courseId } : {},
        });
        return res.data.simulados;
    },

    get: async (id: string) => {
        const res = await apiClient.get(`/simulados/${id}`);
        return res.data.simulado;
    },

    start: async (simuladoId: string) => {
        const res = await apiClient.post(`/simulados/${simuladoId}/start`);
        return res.data;
    },

    answer: async (
        attemptId: string,
        payload: { question_id: string; chosen_alternative_key?: string; response_time_seconds?: number }
    ) => {
        const res = await apiClient.post(`/simulados/attempts/${attemptId}/answer`, payload);
        return res.data;
    },

    finish: async (attemptId: string) => {
        const res = await apiClient.post(`/simulados/attempts/${attemptId}/finish`);
        return res.data;
    },

    getAttemptResult: async (attemptId: string) => {
        const res = await apiClient.get(`/simulados/attempts/${attemptId}`);
        return res.data;
    },

    myAttempts: async () => {
        const res = await apiClient.get("/simulados/my-attempts");
        return res.data;
    },
};