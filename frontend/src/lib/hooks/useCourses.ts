// frontend/src/lib/hooks/useCourses.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { coursesApi } from "@/lib/api/courses";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";

export function useCourses() {
    return useQuery({
        queryKey: QUERY_KEYS.COURSES,
        queryFn: () => coursesApi.list(),
        staleTime: 10 * 60 * 1000,        // 10 minutos (lista de cursos não muda frequentemente)
        refetchOnWindowFocus: false,      // Não refaz ao ganhar foco
    });
}

export function useCourse(id: string) {
    return useQuery({
        queryKey: QUERY_KEYS.COURSE(id),
        queryFn: () => coursesApi.get(id),
        enabled: !!id,
        staleTime: 0,        // 10 minutos (dados de curso não mudam frequentemente)
        refetchOnWindowFocus: true,      // Não refaz ao ganhar foco
    });
}

export function useCheckinLesson() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            lessonId,
            completed,
            perceived_difficulty,
        }: {
            lessonId: string;
            completed: boolean;
            perceived_difficulty?: "easy" | "ok" | "hard";
        }) => coursesApi.checkinLesson(lessonId, { completed, perceived_difficulty }),
        onSuccess: (_, { lessonId }) => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSES });
            queryClient.invalidateQueries({ queryKey: ["schedule"] });
            queryClient.invalidateQueries({ queryKey: ["analytics"] });
        },
    });
}