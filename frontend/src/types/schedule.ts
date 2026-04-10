// frontend/src/types/schedule.ts
// FIX Bug #4 (tipo): ItemStatus usava "completed" mas o backend envia "done".
// Corrigido para refletir os valores reais retornados pela API.

export type ItemType = "lesson" | "questions" | "review" | "simulado";

// "done" é o valor real que o backend grava e retorna (ScheduleItem.status)
// Valores: "pending" | "done" | "skipped" | "rescheduled"
export type ItemStatus = "pending" | "done" | "skipped" | "rescheduled";

export interface StudySchedule {
    id: string;
    course_id: string;
    status: "active" | "paused" | "reorganizing" | "completed";
    source_type: "ai" | "producer_template";
    target_date: string | null;
    abandonment_risk: number;
    ai_notes: string | null;
    last_reorganized_at: string | null;
}

export interface ScheduleDay {
    date: string;
    items: ScheduleItem[];
}

export interface ScheduleItem {
    id: string;
    item_type: ItemType;
    status: ItemStatus;
    scheduled_date: string;
    order: number;
    estimated_minutes: number;
    priority_reason: string | null;
    has_checkin: boolean;
    question_filters: {
        tags?: string[];
        difficulty?: "easy" | "medium" | "hard" | "expert";
        quantity?: number;
    } | null;
    template_item_title: string | null;
    template_item_notes: string | null;
    lesson?: {
        id: string;
        title: string;
        duration_minutes: number | null;
        video_url: string | null;
        video_hosted: boolean;
        external_url: string | null;
    };
    subject?: {
        id: string;
        name: string;
        color: string | null;
    };
}

export interface ScheduleStats {
    completion_rate: number;
    completed_items: number;
    total_items: number;
    pending_today: number;
    abandonment_risk: number;
    target_date: string | null;
    ai_notes: string | null;
    last_reorganized_at: string | null;
}

export interface ScheduleResponse {
    schedule: StudySchedule | null;
    days: { date: string; items: ScheduleItem[] }[];
    stats: ScheduleStats | null;
}