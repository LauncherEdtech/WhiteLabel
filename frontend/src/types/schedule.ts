// frontend/src/types/schedule.ts
// Tipos alinhados com o contrato REAL da API (api/app/routes/schedule.py)
//
// Status real do backend: "pending" | "done" | "skipped" | "rescheduled"
// NÃO usa "completed" nem "overdue" — esses valores não existem na API.

export type ItemType = "lesson" | "questions" | "review" | "simulado";

// Valores exatos retornados pela API (model ScheduleItem.status)
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
    hours_per_day: number | null;
    days: number[] | null;
    break_minutes: number;
}

// A API retorna days como array de { date, items } — sem is_today nem day_label
// Esses campos são computados no frontend (ver ScheduleDay.tsx > parseDayMeta)
export interface ScheduleDay {
    date: string;   // ISO date "YYYY-MM-DD"
    items: ScheduleItem[];
}

export interface ScheduleItem {
    id: string;
    item_type: ItemType;   // campo real da API (não "type")
    status: ItemStatus;
    scheduled_date: string;
    order: number;
    estimated_minutes: number;
    priority_reason: string | null;
    has_checkin: boolean;
    question_filters: {
        _adaptive?: boolean;
        tags?: string[];
        difficulty?: "easy" | "medium" | "hard" | "expert";
        quantity?: number;
    } | null;
    template_item_title: string | null;
    template_item_notes: string | null;
    // lesson e subject são opcionais dependendo do item_type
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
    break_minutes: number;
}

export interface ScheduleResponse {
    schedule: StudySchedule | null;
    days: ScheduleDay[];
    stats: ScheduleStats | null;
}