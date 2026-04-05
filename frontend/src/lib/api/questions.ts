// frontend/src/lib/api/questions.ts
import { apiClient } from "./client";
import { Question, AnswerResult } from "@/types/api";

export const questionsApi = {
  list: async (params?: {
    discipline?: string;
    topic?: string;
    difficulty?: string;
    exam_board?: string;
    previously_wrong?: boolean;
    previously_correct?: boolean;
    not_answered?: boolean;
    page?: number;
    per_page?: number;
  }) => {
    const res = await apiClient.get("/questions/", { params });
    return res.data;
  },

  get: async (id: string) => {
    const res = await apiClient.get<{ question: Question }>(`/questions/${id}`);
    return res.data.question;
  },

  answer: async (
    questionId: string,
    payload: {
      chosen_alternative_key: string;
      response_time_seconds?: number;
      context?: string;
    }
  ) => {
    const res = await apiClient.post<AnswerResult>(
      `/questions/${questionId}/answer`,
      payload
    );
    return res.data;
  },

  myHistory: async () => {
    const res = await apiClient.get("/questions/my-history");
    return res.data;
  },
};