// frontend/src/lib/api/event-metrics.ts
// Client para os endpoints de event metrics do painel admin.

import { apiClient } from "./client";

// ── Tipos compartilhados ─────────────────────────────────────────────────────

export interface DateRangeFilter {
    start_date?: string;  // YYYY-MM-DD
    end_date?: string;
    tenant_id?: string;
}

// ── Heatmap ──────────────────────────────────────────────────────────────────

export interface HeatmapDailyEntry {
    date: string;
    total: number;
    unique_users: number;
}

export interface HeatmapRow {
    event_type: string;
    feature_name: string | null;
    daily: HeatmapDailyEntry[];
    totals: {
        total: number;
        unique_users_peak: number;
    };
}

export interface HeatmapResponse {
    start_date: string;
    end_date: string;
    tenant_id: string | null;
    rows: HeatmapRow[];
}

// ── Funnel ───────────────────────────────────────────────────────────────────

export interface FunnelStage {
    name: string;
    label: string;
    event_types: string[];
    unique_users: number;
    pct_of_base: number;
}

export interface FunnelDropOff {
    from: string;
    to: string;
    lost: number;
    pct: number;
}

export interface FunnelResponse {
    feature_name: string;
    start_date: string;
    end_date: string;
    tenant_id: string | null;
    stages: FunnelStage[];
    drop_off: FunnelDropOff[];
}

export const FUNNEL_FEATURES = [
    { value: "mentor", label: "Mentor inteligente" },
    { value: "questoes", label: "Questões" },
    { value: "simulados", label: "Simulados" },
    { value: "aulas", label: "Aulas" },
    { value: "gamification", label: "Gamificação" },
    { value: "onboarding", label: "Onboarding" },
    { value: "cronograma", label: "Cronograma" },
];

// ── Cohort ───────────────────────────────────────────────────────────────────

export interface CohortRetention {
    d0: number;
    d1: number;
    d3: number;
    d7: number;
    d14: number;
    d30: number;
}

export interface CohortRow {
    cohort_week: string;
    size: number;
    retention: CohortRetention;
}

export interface CohortResponse {
    weeks: number;
    tenant_id: string | null;
    cohorts: CohortRow[];
}

// ── User journey ─────────────────────────────────────────────────────────────

export interface UserJourneyEvent {
    id: string;
    event_type: string;
    feature_name: string | null;
    target_id: string | null;
    metadata: Record<string, any>;
    session_id: string | null;
    created_at: string;
}

export interface UserJourneyResponse {
    user_id: string;
    user_name: string;
    user_email: string;
    tenant_id: string;
    tenant_name: string;
    stats: {
        total_events_all_time: number;
        first_event_at: string | null;
        last_event_at: string | null;
    };
    filters: {
        start_date: string;
        end_date: string;
        limit: number;
    };
    events: UserJourneyEvent[];
}

// ── API ──────────────────────────────────────────────────────────────────────

export const eventMetricsApi = {
    heatmap: (filters: DateRangeFilter & { top?: number } = {}) =>
        apiClient.get<HeatmapResponse>("/admin/event-metrics/heatmap", { params: filters })
            .then(r => r.data),

    funnel: (feature_name: string, filters: DateRangeFilter = {}) =>
        apiClient.get<FunnelResponse>("/admin/event-metrics/funnel", {
            params: { feature_name, ...filters },
        }).then(r => r.data),

    cohort: (weeks: number = 12, tenant_id?: string) =>
        apiClient.get<CohortResponse>("/admin/event-metrics/cohort", {
            params: { weeks, tenant_id },
        }).then(r => r.data),

    userJourney: (user_id: string, filters: DateRangeFilter & { limit?: number } = {}) =>
        apiClient.get<UserJourneyResponse>(`/admin/event-metrics/user-journey/${user_id}`, {
            params: filters,
        }).then(r => r.data),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Converte array de objetos em string CSV. */
export function arrayToCsv(rows: Record<string, any>[]): string {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const escape = (val: any) => {
        if (val === null || val === undefined) return "";
        const s = String(val);
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };
    const lines = [
        headers.join(","),
        ...rows.map(r => headers.map(h => escape(r[h])).join(",")),
    ];
    return lines.join("\n");
}

/** Dispara download de CSV no browser. */
export function downloadCsv(filename: string, csv: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}