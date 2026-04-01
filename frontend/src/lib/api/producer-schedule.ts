// frontend/src/lib/api/producer-schedule.ts

import { apiClient } from "./client";
import type {
    ProducerScheduleTemplate,
    CreateTemplateItemPayload,
    CourseTemplateResponse,
} from "@/types/producer-schedule";

// ── Produtor ──────────────────────────────────────────────────────────────

export const producerScheduleApi = {
    /** Cria template para um curso */
    createTemplate: (payload: {
        course_id: string;
        title?: string;
        description?: string;
        allow_student_custom_schedule?: boolean;
    }) =>
        apiClient
            .post<{ template: ProducerScheduleTemplate }>(
                "/producer-schedule/templates",
                payload
            )
            .then((r) => r.data),

    /** Busca template pelo curso */
    getTemplateByCourse: (courseId: string) =>
        apiClient
            .get<{ template: ProducerScheduleTemplate | null }>(
                `/producer-schedule/templates/by-course/${courseId}`
            )
            .then((r) => r.data),

    /** Atualiza configurações do template */
    updateTemplate: (
        templateId: string,
        payload: Partial<{
            title: string;
            description: string;
            allow_student_custom_schedule: boolean;
        }>
    ) =>
        apiClient
            .put<{ template: ProducerScheduleTemplate }>(
                `/producer-schedule/templates/${templateId}`,
                payload
            )
            .then((r) => r.data),

    /** Publica / despublica o template */
    togglePublish: (templateId: string) =>
        apiClient
            .post<{ is_published: boolean; message: string }>(
                `/producer-schedule/templates/${templateId}/publish`
            )
            .then((r) => r.data),

    /** Remove o template */
    deleteTemplate: (templateId: string) =>
        apiClient.delete(`/producer-schedule/templates/${templateId}`),

    /** Adiciona item ao template */
    addItem: (templateId: string, payload: CreateTemplateItemPayload) =>
        apiClient
            .post(`/producer-schedule/templates/${templateId}/items`, payload)
            .then((r) => r.data),

    /** Atualiza item */
    updateItem: (
        templateId: string,
        itemId: string,
        payload: Partial<CreateTemplateItemPayload>
    ) =>
        apiClient
            .put(`/producer-schedule/templates/${templateId}/items/${itemId}`, payload)
            .then((r) => r.data),

    /** Remove item */
    deleteItem: (templateId: string, itemId: string) =>
        apiClient.delete(
            `/producer-schedule/templates/${templateId}/items/${itemId}`
        ),

    /** Reordena itens */
    reorderItems: (
        templateId: string,
        items: { id: string; day_number: number; order: number }[]
    ) =>
        apiClient
            .post(`/producer-schedule/templates/${templateId}/reorder`, { items })
            .then((r) => r.data),
};

// ── Aluno ─────────────────────────────────────────────────────────────────

export const studentScheduleTemplateApi = {
    /** Verifica se há template disponível para o curso */
    getCourseTemplate: (courseId: string) =>
        apiClient
            .get<CourseTemplateResponse>(`/producer-schedule/course/${courseId}`)
            .then((r) => r.data),

    /** Adota o cronograma do produtor */
    adoptTemplate: (courseId: string) =>
        apiClient
            .post<{ message: string; schedule_id: string }>("/producer-schedule/adopt", {
                course_id: courseId,
            })
            .then((r) => r.data),
};