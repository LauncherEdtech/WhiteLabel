// frontend/src/lib/constants/routes.ts

export const ROUTES = {
    // Auth
    LOGIN: "/login",
    REGISTER: "/register",
    FORGOT_PASSWORD: "/forgot-password",
    RESET_PASSWORD: "/reset-password",

    // Student
    DASHBOARD: "/dashboard",
    COURSES: "/courses",
    COURSE: (id: string) => `/courses/${id}`,
    LESSON: (courseId: string, lessonId: string) => `/courses/${courseId}/lessons/${lessonId}`,
    QUESTIONS: "/questions",
    SIMULADOS: "/simulados",
    SIMULADO: (id: string) => `/simulados/${id}`,
    SIMULADO_RESULT: (id: string) => `/simulados/${id}/result`,
    SCHEDULE: "/schedule",
    ANALYTICS: "/analytics",
    PROFILE: "/profile",

    // Producer
    PRODUCER: {
        DASHBOARD: "/producer/dashboard",
        COURSES: "/producer/courses",
        COURSE_NEW: "/producer/courses/new",
        COURSE: (id: string) => `/producer/courses/${id}`,
        QUESTIONS: "/producer/questions",
        SIMULADOS: "/producer/simulados",
        STUDENTS: "/producer/students",
        STUDENT: (id: string) => `/producer/students/${id}`,
        ANALYTICS: "/producer/analytics",
        SETTINGS: "/producer/settings",
        BRANDING: "/producer/settings/branding",
    },

    // Admin
    ADMIN: {
        TENANTS: "/admin/tenants",
        TENANT: (id: string) => `/admin/tenants/${id}`,
    },
} as const;