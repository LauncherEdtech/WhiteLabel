// frontend/src/types/producer-schedule.ts

export interface QuestionFilters {
    tags?: string[];
    difficulty?: "easy" | "medium" | "hard" | "expert";
    quantity?: number;
}

export interface TemplateItemLesson {
    id: string;
    title: string;
    duration_minutes: number | null;
}

export interface TemplateItemSubject {
    id: string;
    name: string;
    color: string | null;
}

export type TemplateItemType = "lesson" | "questions" | "review" | "simulado";

export interface ProducerTemplateItem {
    id: string;
    day_number: number;
    order: number;
    item_type: TemplateItemType;
    title: string | null;
    notes: string | null;
    estimated_minutes: number;
    question_filters: QuestionFilters | null;
    lesson?: TemplateItemLesson;
    subject?: TemplateItemSubject;
}

export interface TemplateDay {
    day_number: number;
    items: ProducerTemplateItem[];
}

export interface ProducerScheduleTemplate {
    id: string;
    course_id: string;
    title: string;
    description: string | null;
    allow_student_custom_schedule: boolean;
    is_published: boolean;
    total_days: number;
    created_at: string | null;
    days?: TemplateDay[];
    items_count?: number;
}

// ── Payload para criar item ────────────────────────────────────────────────

export interface CreateTemplateItemPayload {
    day_number: number;
    order?: number;
    item_type: TemplateItemType;
    title?: string;
    notes?: string;
    lesson_id?: string;
    subject_id?: string;
    estimated_minutes?: number;
    question_filters?: QuestionFilters;
}

// ── Resposta da rota do aluno ──────────────────────────────────────────────

export interface CourseTemplateResponse {
    template: ProducerScheduleTemplate | null;
    allow_custom: boolean;
    already_adopted: boolean;
    has_custom_schedule: boolean;
}