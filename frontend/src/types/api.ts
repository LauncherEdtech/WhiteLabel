// frontend/src/types/api.ts
// Tipos de resposta da API Flask

export interface ApiError {
    error: string;
    message: string;
    details?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        per_page: number;
        total: number;
        pages: number;
        has_next: boolean;
        has_prev: boolean;
    };
}

// ── Courses ──────────────────────────────────────────────────────────────────

export interface Course {
    id: string;
    name: string;
    description: string | null;
    thumbnail_url: string | null;
    is_active: boolean;
    created_at: string;
}

export interface Subject {
    id: string;
    name: string;
    description: string | null;
    color: string;
    edital_weight: number;
    order: number;
    modules?: Module[];
}

export interface Module {
    id: string;
    name: string;
    description: string | null;
    order: number;
    lessons?: Lesson[];
    total_lessons?: number;
}

export interface LessonProgress {
    status: "not_started" | "watched" | "not_watched" | "partial";
    watch_percentage: number;
    last_watched_at: string | null;
}

export interface Lesson {
    id: string;
    title: string;
    description: string | null;
    duration_minutes: number;
    video_url: string | null;
    material_url: string | null;
    is_published: boolean;
    is_free_preview: boolean;
    order: number;
    has_ai_summary: boolean;
    ai_summary: string | null;
    ai_topics: string[];
    progress: LessonProgress;
}

// ── Questions ─────────────────────────────────────────────────────────────────

export type DifficultyLevel = "easy" | "medium" | "hard";

export interface Alternative {
    key: string;
    text: string;
    distractor_justification?: string | null;
}

export interface QuestionStats {
    total_attempts: number;
    accuracy_rate: number;
    avg_response_time_seconds: number;
}

export interface Question {
    id: string;
    statement: string;
    context: string | null;
    discipline: string | null;
    topic: string | null;
    subtopic: string | null;
    difficulty: DifficultyLevel | null;
    exam_board: string | null;
    exam_year: number | null;
    exam_name: string | null;
    competency: string | null;
    tip: string | null;
    alternatives: Alternative[];
    correct_alternative_key?: string;
    correct_justification?: string | null;
    stats: QuestionStats;
    my_status: {
        answered: boolean;
        is_correct: boolean | null;
        chosen_key: string | null;
    };
}

export interface AnswerAlternative {
    key: string;
    text: string;
    is_correct: boolean;
    is_chosen: boolean;
    justification?: string | null;
}

export interface AnswerResult {
    is_correct: boolean;
    chosen_key: string;
    correct_key: string;
    xp_gained: number;
    attempt_id: string;
    alternatives: AnswerAlternative[];
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface Insight {
    type: "motivation" | "weakness" | "next_step" | "alert" | "warning" | "positive" | "suggestion";
    icon: string;
    title: string;
    message: string;
}

export interface DisciplinePerformance {
    discipline: string;
    total_answered: number;
    total_attempts: number;  // alias do backend — mesmo valor que total_answered
    correct: number;
    wrong: number;
    accuracy_rate: number;
    avg_response_time_seconds: number;
    performance_label: "forte" | "regular" | "fraco";
}

// ── Missão Semanal ────────────────────────────────────────────────────────────

export interface WeeklyMissionPendingItem {
    id: string;
    item_type: string;
    scheduled_date: string;
    estimated_minutes: number;
    lesson?: { id: string; title: string } | null;
    subject?: { id: string; name: string; color: string } | null;
}

export interface WeeklyMissionDisciplineAlert {
    discipline: string;
    current_accuracy: number;
    target_accuracy: number;
    total_attempts: number;
    urgent: boolean;
    done: boolean;
}

export type WeeklyMissionItemType = "schedule" | "discipline_cluster";

export interface WeeklyMissionItem {
    type: WeeklyMissionItemType;
    title: string;
    done: boolean;
    // schedule
    total?: number;
    completed?: number;
    progress_pct?: number;
    pending_items?: WeeklyMissionPendingItem[];
    // discipline_cluster
    disciplines?: WeeklyMissionDisciplineAlert[];
    done_count?: number;
}

export interface WeeklyMission {
    has_schedule: boolean;
    week_start: string;
    week_end: string;
    items: WeeklyMissionItem[];
    total_items: number;
    completed_items: number;
}

// ── Student Dashboard ─────────────────────────────────────────────────────────

export interface StudentDashboard {
    student: { id: string; name: string };
    questions: {
        total_answered: number;
        total_correct: number;
        overall_accuracy: number;
        today: { answered: number; correct: number; accuracy: number };
        this_week: { answered: number; correct: number; accuracy: number };
    };
    discipline_performance: DisciplinePerformance[];
    lesson_progress: {
        total_watched: number;
        total_available: number;
        completion_rate: number;
    };
    time_studied: {
        today_minutes: number;
        week_minutes: number;
        weekly_goal_hours: number;
        weekly_goal_minutes: number;
        weekly_progress_percent: number;
    };
    todays_pending: ScheduleItem[];
    weekly_mission: WeeklyMission;
    insights: Insight[];
    generated_at: string;
}

// ── Schedule ──────────────────────────────────────────────────────────────────

export interface ScheduleItem {
    id: string;
    type: "lesson" | "questions" | "review" | "simulado";
    status: "pending" | "done" | "skipped" | "rescheduled";
    estimated_minutes: number;
    priority_reason: string | null;
    scheduled_date: string;
    order: number;
    has_checkin: boolean;
    lesson?: {
        id: string;
        title: string;
        duration_minutes: number;
        video_url: string | null;
    };
    subject?: {
        id: string;
        name: string;
        color: string;
    };
}

export interface ScheduleDay {
    date: string;
    is_today: boolean;
    is_past: boolean;
    total_minutes: number;
    completed_minutes: number;
    completion_rate: number;
    pending_count: number;
    items: ScheduleItem[];
}

// ── Simulados ─────────────────────────────────────────────────────────────────

export interface Simulado {
    id: string;
    title: string;
    description: string | null;
    course_id: string;
    time_limit_minutes: number;
    total_questions: number;
    is_active: boolean;
    is_ai_generated: boolean;
    settings: {
        shuffle_questions: boolean;
        passing_score: number;
    };
    created_at: string;
    my_attempt?: SimuladoAttemptSummary | null;
}

export interface SimuladoAttemptSummary {
    id: string;
    simulado_id: string;
    status: "in_progress" | "completed" | "timed_out" | "abandoned";
    score_percent: number;
    correct_answers: number;
    total_questions: number;
    total_time_seconds: number | null;
    started_at: string;
    finished_at: string | null;
}

// ── Cápsula de Estudos ────────────────────────────────────────────────────────

export interface CapsuleDiscipline {
    discipline: string;
    accuracy_rate: number;
    total: number;
}

export interface StudyCapsule {
    period_label: string;
    month: number;
    year: number;
    student_name: string;
    rank: { name: string; icon: string };
    total_minutes: number;
    questions_answered: number;
    accuracy_rate: number;
    lessons_watched: number;
    top_disciplines: CapsuleDiscipline[];
    highlight_badge: { key: string; name: string; icon: string } | null;
    streak_days: number;
    ai_phrase: string;
    tenant_name: string;
    tenant_logo_url: string | null;
    tenant_primary_color: string;
    tenant_instagram: string | null;
    capsule_style: "operativo" | "campeao" | "relatorio" | "neon" | "bold" | "elegante";
    user_since: { month: number; year: number };
    generated_at: string;
}