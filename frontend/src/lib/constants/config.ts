export const APP_CONFIG = {
  name: "Concurso Platform",
  version: "1.0.0",
  apiTimeout: 30_000,
  maxFileSize: 10 * 1024 * 1024,
  pagination: { defaultPerPage: 20, maxPerPage: 100 },
  xp: { correct: 10, wrong: 2, lessonWatched: 5, simuladoDone: 20 },
  timer: { accessTokenRefreshBuffer: 60, simuladoGracePeriod: 30 },
} as const;
export const DIFFICULTY_LABELS = { easy: "Fácil", medium: "Médio", hard: "Difícil" } as const;
export const ROLE_LABELS = { student: "Aluno", producer_staff: "Equipe", producer_admin: "Produtor", super_admin: "Super Admin" } as const;
export const PERFORMANCE_LABELS = {
  forte:   { label: "Forte",   color: "success"     },
  regular: { label: "Regular", color: "warning"     },
  fraco:   { label: "Fraco",   color: "destructive" },
} as const;
