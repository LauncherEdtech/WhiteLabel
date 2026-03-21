// frontend/src/lib/api/schedule.ts

import { apiClient } from "./client";

export const scheduleApi = {
    generate: async (courseId: string, targetDate?: string) => {
        const res = await apiClient.post("/schedule/generate", {
            course_id: courseId,
            target_date: targetDate,
        });
        return res.data;
    },

    get: async (courseId: string, daysAhead = 7) => {
        const res = await apiClient.get("/schedule/", {
            params: { course_id: courseId, days_ahead: daysAhead },
        });
        return res.data;
    },

    checkin: async (
        itemId: string,
        payload: {
            completed: boolean;
            perceived_difficulty?: "easy" | "ok" | "hard";
            note?: string;
        }
    ) => {
        const res = await apiClient.post(
            `/schedule/items/${itemId}/checkin`,
            payload
        );
        return res.data;
    },

    updateAvailability: async (availability: {
        days: number[];
        hours_per_day: number;
        preferred_start_time: string;
    }) => {
        const res = await apiClient.put("/schedule/availability", availability);
        return res.data;
    },

    delete: async (courseId: string) => {
        const res = await apiClient.delete("/schedule/", {
            data: { course_id: courseId },
        });
        return res.data;
    },
};