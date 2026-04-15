// frontend/src/lib/hooks/useAnalytics.ts

import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api/analytics";

export const ANALYTICS_KEYS = {
    studentDashboard: (userId?: string) =>
        ["analytics", "student", "dashboard", userId] as const,
    producerOverview: (courseId?: string) =>
        ["analytics", "producer", "overview", courseId] as const,
    producerStudents: (params?: object) =>
        ["analytics", "producer", "students", params] as const,
};

export function useStudentDashboard(userId?: string) {
    return useQuery({
        queryKey: ANALYTICS_KEYS.studentDashboard(userId),
        queryFn: () => analyticsApi.studentDashboard(userId),
        staleTime: 60 * 60 * 1000,        // 1 hora (sincronizado com backend)
        refetchOnWindowFocus: false,      // Não refaz ao ganhar foco da janela
    });
}

export function useProducerOverview(courseId?: string) {
    return useQuery({
        queryKey: ANALYTICS_KEYS.producerOverview(courseId),
        queryFn: () => analyticsApi.producerOverview(courseId),
        staleTime: 5 * 60 * 1000,
    });
}