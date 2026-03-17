// frontend/src/lib/stores/authStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";
import Cookies from "js-cookie";
import { User } from "@/types/user";

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    setUser: (user: User) => void;
    setTokens: (access: string, refresh: string) => void;
    logout: () => void;
    setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            isLoading: true,

            setUser: (user) => set({ user, isAuthenticated: true, isLoading: false }),

            setTokens: (access, refresh) => {
                // SEGURANÇA: Cookies com flags de segurança em produção
                const isProd = process.env.NODE_ENV === "production";
                Cookies.set("access_token", access, {
                    expires: 1 / 24,      // 1 hora
                    secure: isProd,
                    sameSite: "lax",
                });
                Cookies.set("refresh_token", refresh, {
                    expires: 30,          // 30 dias
                    secure: isProd,
                    sameSite: "lax",
                });
            },

            logout: () => {
                Cookies.remove("access_token");
                Cookies.remove("refresh_token");
                set({ user: null, isAuthenticated: false });
            },

            setLoading: (v) => set({ isLoading: v }),
        }),
        {
            name: "auth-store",
            // Persiste apenas dados não sensíveis
            partialize: (state) => ({ user: state.user }),
        }
    )
);