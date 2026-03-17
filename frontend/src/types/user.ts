// frontend/src/types/user.ts

export type UserRole =
    | "super_admin"
    | "producer_admin"
    | "producer_staff"
    | "student";

export interface StudyAvailability {
    days: number[];              // 0=seg … 6=dom
    hours_per_day: number;
    preferred_start_time: string;
}

export interface UserPreferences {
    timezone: string;
    notifications_email: boolean;
    notifications_push: boolean;
    study_reminder_time: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    tenant_id: string;
    email_verified: boolean;
    preferences: UserPreferences;
    study_availability: StudyAvailability | null;
}

export interface AuthTokens {
    access_token: string;
    refresh_token: string;
}