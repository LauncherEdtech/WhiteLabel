// frontend/src/lib/hooks/useSimulados.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";
import type { Simulado, SimuladoAttemptSummary } from "@/types/api";

export function useSimulados(courseId?: string) {
    return useQuery({
        queryKey: QUERY_KEYS.SIMULADOS(courseId),
        queryFn: async () => {
            const res = await apiClient.get<{ simulados: Simulado[] }>("/simulados/", {
                params: courseId ? { course_id: courseId } : {},
            });
            return res.data.simulados;
        },
        staleTime: 2 * 60 * 1000,
    });
}

export function useSimulado(id: string) {
    return useQuery({
        queryKey: QUERY_KEYS.SIMULADO(id),
        queryFn: async () => {
            const res = await apiClient.get(`/simulados/${id}`);
            return res.data.simulado;
        },
        enabled: !!id,
    });
}

export function useStartAttempt() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (simuladoId: string) => {
            const res = await apiClient.post(`/simulados/${simuladoId}/start`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["simulados"] });
        },
    });
}

export function useAnswerSimulado() {
    return useMutation({
        mutationFn: async ({
            attemptId,
            questionId,
            chosenKey,
            responseTime,
        }: {
            attemptId: string;
            questionId: string;
            chosenKey: string;
            responseTime?: number;
        }) => {
            const res = await apiClient.post(`/simulados/attempts/${attemptId}/answer`, {
                question_id: questionId,
                chosen_alternative_key: chosenKey,
                response_time_seconds: responseTime,
            });
            return res.data;
        },
    });
}

export function useFinishAttempt() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (attemptId: string) => {
            const res = await apiClient.post(`/simulados/attempts/${attemptId}/finish`);
            return res.data;
        },
        onSuccess: (_, attemptId) => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ATTEMPT_RESULT(attemptId) });
            queryClient.invalidateQueries({ queryKey: ["simulados"] });
            queryClient.invalidateQueries({ queryKey: ["analytics"] });
        },
    });
}

export function useAttemptResult(attemptId: string) {
    return useQuery({
        queryKey: QUERY_KEYS.ATTEMPT_RESULT(attemptId),
        queryFn: async () => {
            const res = await apiClient.get(`/simulados/attempts/${attemptId}`);
            return res.data;
        },
        enabled: !!attemptId,
    });
}