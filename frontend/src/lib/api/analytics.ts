// frontend/src/lib/api/analytics.ts

import { apiClient } from "./client";
import { StudentDashboard } from "@/types/api";

export const analyticsApi = {
    studentDashboard: async (userId?: string) => {
        const res = await apiClient.get<StudentDashboard>(
            "/analytics/student/dashboard",
            { params: userId ? { user_id: userId } : {} }
        );
        return res.data;
    },

    producerOverview: async (courseId?: string) => {
        const res = await apiClient.get("/analytics/producer/overview", {
            params: courseId ? { course_id: courseId } : {},
        });
        return res.data;
    },

    producerStudents: async (params?: {
        page?: number;
        per_page?: number;
        search?: string;
    }) => {
        const res = await apiClient.get("/analytics/producer/students", {
            params,
        });
        return res.data;
    },
};