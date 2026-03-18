// frontend/src/app/(auth)/admin-login/page.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/authStore";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { AxiosError } from "axios";

const schema = z.object({
    email: z.string().email("E-mail inválido"),
    password: z.string().min(1, "Senha obrigatória"),
});

type Form = z.infer<typeof schema>;

export default function AdminLoginPage() {
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { setUser, setTokens } = useAuthStore();
    const router = useRouter();

    const { register, handleSubmit, formState: { errors } } = useForm<Form>({
        resolver: zodResolver(schema),
    });

    const onSubmit = async (data: Form) => {
        setLoading(true);
        setError("");
        try {
            // Força o tenant correto ANTES da requisição
            Cookies.set("tenant_slug", "platform", { sameSite: "lax", expires: 1 });

            const res = await apiClient.post("/auth/login", data, {
                headers: { "X-Tenant-Slug": "platform" },
            });

            const { access_token, refresh_token, user } = res.data;

            // Valida se é realmente super_admin
            if (user.role !== "super_admin") {
                setError("Acesso negado. Esta área é exclusiva para administradores.");
                return;
            }

            // Salva tokens e usuário
            Cookies.set("access_token", access_token, { expires: 1 / 24, sameSite: "lax" });
            Cookies.set("refresh_token", refresh_token, { expires: 30, sameSite: "lax" });
            setUser(user);
            setTokens(access_token, refresh_token);

            router.push("/admin/tenants");
        } catch (err) {
            const e = err as AxiosError<{ message: string }>;
            setError(e.response?.data?.message || "Credenciais inválidas.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-8">
            <div className="w-full max-w-sm">

                {/* Logo */}
                <div className="flex flex-col items-center mb-8">
                    <div className="h-14 w-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-4">
                        <Shield className="h-7 w-7 text-primary" />
                    </div>
                    <h1 className="font-display text-2xl font-bold text-white">
                        Painel Administrativo
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Acesso restrito — Concurso Platform
                    </p>
                </div>

                {/* Card do form */}
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-300">
                                E-mail administrativo
                            </label>
                            <input
                                {...register("email")}
                                type="email"
                                autoComplete="email"
                                placeholder="admin@platform.com"
                                className={cn(
                                    "w-full h-10 px-3 rounded-lg border bg-slate-900 text-white text-sm",
                                    "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                                    "placeholder:text-slate-600 transition-colors",
                                    errors.email ? "border-red-500" : "border-slate-600 hover:border-slate-500"
                                )}
                            />
                            {errors.email && (
                                <p className="text-xs text-red-400">{errors.email.message}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-300">Senha</label>
                            <div className="relative">
                                <input
                                    {...register("password")}
                                    type={showPass ? "text" : "password"}
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    className={cn(
                                        "w-full h-10 px-3 pr-10 rounded-lg border bg-slate-900 text-white text-sm",
                                        "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                                        "placeholder:text-slate-600 transition-colors",
                                        errors.password ? "border-red-500" : "border-slate-600 hover:border-slate-500"
                                    )}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                >
                                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="text-xs text-red-400">{errors.password.message}</p>
                            )}
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                <p className="text-xs text-red-400">{error}</p>
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full"
                            size="lg"
                            loading={loading}
                        >
                            <Shield className="h-4 w-4" />
                            {loading ? "Verificando..." : "Acessar painel"}
                        </Button>
                    </form>
                </div>

                <p className="text-center text-xs text-slate-600 mt-6">
                    Acesso monitorado e registrado
                </p>
            </div>
        </div>
    );
}