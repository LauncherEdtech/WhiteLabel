// frontend/src/lib/tracking/types.ts
// Tipagens dos eventos de tracking — alinhadas com a whitelist do backend.
// Manter em sincronia com api/app/routes/events.py (ALLOWED_EVENT_TYPES, ALLOWED_FEATURE_NAMES).

export type EventType =
    // Sessão
    | "session_start"
    | "session_end"
    // Navegação
    | "page_view"
    | "page_leave"
    // Mentor inteligente
    | "mentor_click"
    | "mentor_response_received"
    | "insight_view"
    | "insight_followed"
    // Questões
    | "question_filter_used"
    | "explanation_read"
    // Simulados
    | "simulado_abandon"
    | "result_viewed"
    // Cronograma
    | "schedule_choice_made"
    | "item_rescheduled"
    // Gamificação
    | "hall_of_fame_view"
    | "ranking_view"
    | "badge_view"
    | "capsule_shared"
    // Aulas
    | "lesson_started"
    | "lesson_paused"
    | "lesson_resumed"
    | "material_downloaded"
    | "lesson_completed"
    | "lesson_rated"
    // Onboarding
    | "onboarding_step_view"
    | "onboarding_completed"
    | "onboarding_skipped"
    // Anúncios
    | "ad_impression"
    | "ad_click"
    | "ad_dismissed"
    // Paywall
    | "feature_blocked_hit"
    | "paywall_view"
    | "paywall_dismiss";

export type FeatureName =
    | "mentor"
    | "simulados"
    | "questoes"
    | "cronograma"
    | "aulas"
    | "gamificacao"
    | "hall_of_fame"
    | "onboarding"
    | "ads"
    | "paywall"
    | "navigation"
    | "session";

export interface TrackEvent {
    event_type: EventType;
    feature_name?: FeatureName;
    target_id?: string;
    metadata?: Record<string, any>;
    client_timestamp?: string;
}

// Versão interna que inclui session_id (adicionado pelo cliente)
export interface QueuedEvent extends TrackEvent {
    session_id: string;
    client_timestamp: string;
}