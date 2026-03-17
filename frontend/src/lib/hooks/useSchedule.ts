// frontend/src/lib/hooks/useSchedule.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { scheduleApi } from "@/lib/api/schedule";

export const SCHEDULE_KEYS = {
    get: (courseId: string, daysAhead?: number) =>
        ["schedule", courseId, daysAhead] as const,
};

export function useSchedule(courseId: string, daysAhead = 7) {
    return useQuery({
        queryKey: SCHEDULE_KEYS.get(courseId, daysAhead),
        queryFn: () => scheduleApi.get(courseId, daysAhead),
        enabled: !!courseId,
        staleTime: 60 * 1000,
    });
}

export function useGenerateSchedule() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            courseId,
            targetDate,
        }: {
            courseId: string;
            targetDate?: string;
        }) => scheduleApi.generate(courseId, targetDate),
        onSuccess: (_, { courseId }) => {
            queryClient.invalidateQueries({ queryKey: ["schedule", courseId] });
        },
    });
}

export function useCheckinItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            itemId,
            completed,
            perceived_difficulty,
        }: {
            itemId: string;
            completed: boolean;
            perceived_difficulty?: "easy" | "ok" | "hard";
        }) => scheduleApi.checkin(itemId, { completed, perceived_difficulty }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["schedule"] });
            queryClient.invalidateQueries({ queryKey: ["analytics"] });
        },
    });
}