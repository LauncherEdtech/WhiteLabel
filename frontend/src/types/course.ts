export interface Course { id: string; name: string; description?: string; thumbnail_url?: string; is_active: boolean; subjects?: Subject[]; enrollment?: { enrolled_at: string; is_active: boolean }; }
export interface Subject { id: string; name: string; color: string; edital_weight: number; order: number; modules?: Module[]; }
export interface Module { id: string; name: string; order: number; lessons?: Lesson[]; }
export interface Lesson { id: string; title: string; description?: string; video_url?: string; material_url?: string, external_url?: string; duration_minutes: number; order: number; is_published: boolean; is_free_preview: boolean; has_ai_summary: boolean; ai_summary?: string; ai_topics?: string[]; progress?: LessonProgress; }
export interface LessonProgress { status: "not_started" | "in_progress" | "watched"; perceived_difficulty?: "easy" | "ok" | "hard"; watched_at?: string; }
