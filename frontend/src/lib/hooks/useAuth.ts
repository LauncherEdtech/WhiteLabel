// frontend/src/lib/hooks/useAuth.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/stores/authStore";

export const AUTH_KEYS = {
    me: ["auth", "me"] as const,
};

export function useMe() {
    const { setUser } = useAuthStore();

    return useQuery({
        queryKey: AUTH_KEYS.me,
        queryFn: async () => {
            const user = await authApi.me();
            setUser(user);
            return user;
        },
        // Só busca se tiver token
        enabled: !!Cookies.get("access_token"),
        staleTime: 5 * 60 * 1000, // 5 minutos
        retry: false,
    });
}

export function useLogin() {
    const { setUser, setTokens } = useAuthStore();
    const queryClient = useQueryClient();
    const router = useRouter();

    return useMutation({
        mutationFn: ({
            email,
            password,
        }: {
            email: string;
            password: string;
        }) => authApi.login(email, password),

        onSuccess: (data) => {
            setTokens(data.access_token, data.refresh_token);
            setUser(data.user);
            queryClient.setQueryData(AUTH_KEYS.me, data.user);

            // Redireciona conforme o papel
            if (data.user.role === "student") {
                router.push("/dashboard");
            } else if (
                data.user.role === "producer_admin" ||
                data.user.role === "producer_staff"
            ) {
                router.push("/producer/dashboard");
            } else {
                router.push("/admin/tenants");
            }
        },
    });
}

export function useLogout() {
    const { logout } = useAuthStore();
    const queryClient = useQueryClient();
    const router = useRouter();

    return () => {
        logout();
        queryClient.clear();
        router.push("/login");
    };
}