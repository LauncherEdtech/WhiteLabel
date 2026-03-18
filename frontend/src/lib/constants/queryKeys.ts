// frontend/src/lib/constants/queryKeys.ts

export const QUERY_KEYS = {
    // Auth
    ME: ["auth", "me"],

    // Courses
    COURSES: ["courses"],
    COURSE: (id: string) => ["courses", id],

    // Questions
    QUESTIONS: (params?: object) => ["questions", params],
    QUESTION: (id: string) => ["questions", id],
    MY_HISTORY: ["questions", "my-history"],

    // Analytics
    STUDENT_DASHBOARD: (userId?: string) => ["analytics", "student", "dashboard", userId],
    PRODUCER_OVERVIEW: (courseId?: string) => ["analytics", "producer", "overview", courseId],
    PRODUCER_STUDENTS: (params?: object) => ["analytics", "producer", "students", params],

    // Schedule
    SCHEDULE: (courseId: string, days?: number) => ["schedule", courseId, days],

    // Simulados
    SIMULADOS: (courseId?: string) => ["simulados", courseId],
    SIMULADO: (id: string) => ["simulados", id],
    MY_ATTEMPTS: ["simulados", "my-attempts"],
    ATTEMPT_RESULT: (id: string) => ["simulados", "attempts", id],

    // Tenants (admin)
    TENANTS: ["tenants"],
    TENANT: (id: string) => ["tenants", id],
} as const;