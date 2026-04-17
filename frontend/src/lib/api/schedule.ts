// frontend/src/lib/api/schedule.ts
import { apiClient } from "./client";

export const uncheckinItem = (itemId: string) =>
    apiClient.delete(`/schedule/checkin/${itemId}`);

export const scheduleApi = {
    generate: async (courseId: string, targetDate?: string) => {
        const res = await apiClient.post("/schedule/generate", {
            course_id: courseId,
            target_date: targetDate || null,
        });
        return res.data;
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
