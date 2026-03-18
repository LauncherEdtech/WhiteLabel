// frontend/src/lib/hooks/useQuestions.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { questionsApi } from "@/lib/api/questions";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";

export function useQuestions(params?: object) {
    return useQuery({
        queryKey: QUERY_KEYS.QUESTIONS(params),
        queryFn: () => questionsApi.list(params as Parameters<typeof questionsApi.list>[0]),
        staleTime: 60 * 1000,
    });
}

export function useAnswerQuestion() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            questionId,
            chosen_alternative_key,
            response_time_seconds,
            context,
        }: {
            questionId: string;
            chosen_alternative_key: string;
            response_time_seconds?: number;
            context?: string;
        }) => questionsApi.answer(questionId, { chosen_alternative_key, response_time_seconds, context }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["analytics"] });
        },
    });
}

export function useMyHistory() {
    return useQuery({
        queryKey: QUERY_KEYS.MY_HISTORY,
        queryFn: () => questionsApi.myHistory(),
        staleTime: 2 * 60 * 1000,
    });
}