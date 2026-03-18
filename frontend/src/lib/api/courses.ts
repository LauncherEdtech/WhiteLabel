// frontend/src/lib/api/courses.ts
import { apiClient } from "./client";
import { Course } from "@/types/api";

export const coursesApi = {
  list: async () => {
    const res = await apiClient.get<{ courses: Course[] }>("/courses/");
    return res.data.courses;
  },

  get: async (id: string) => {
    const res = await apiClient.get(`/courses/${id}`);
    return res.data.course;
  },

  getLesson: async (lessonId: string) => {
    const res = await apiClient.get(`/courses/lessons/${lessonId}`);
    return res.data.lesson;
  },

  checkinLesson: async (
    lessonId: string,
    payload: {
      completed: boolean;
      perceived_difficulty?: "easy" | "ok" | "hard";
      note?: string;
    }
  ) => {
    const res = await apiClient.post(
      `/courses/lessons/${lessonId}/checkin`,
      payload
    );
    return res.data;
  },
};