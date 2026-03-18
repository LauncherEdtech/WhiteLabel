// frontend/src/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Eye, EyeOff, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { useLogin } from "@/lib/hooks/useAuth";
import { TenantSwitcher } from "@/components/dev/TenantSwitcher";
import { cn } from "@/lib/utils/cn";
import { AxiosError } from "axios";

const loginSchema = z.object({
    email: z.string().email("E-mail inválido"),
    password: z.string().min(1, "Senha obrigatória"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const [showPassword, setShowPassword] = useState(false);
    const [serverError, setServerError] = useState("");
    const { getBranding } = useTenantStore();
    const branding = getBranding();
    const login = useLogin();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginForm) => {
        setServerError("");
        try {
            await login.mutateAsync(data);
        } catch (err) {
            const e = err as AxiosError<{ message: string }>;
            setServerError(
                e.response?.data?.message || "Erro ao fazer login. Tente novamente."
            );
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* ── Lado esquerdo — decorativo ── */}
            <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <GraduationCap className="h-6 w-6 text-white" />
                    </div>
                    <span className="font-display font-bold text-white text-lg">
                        {branding.platform_name}
                    </span>
                </div>

                <div>
                    <h1 className="font-display text-4xl font-bold text-white leading-tight">
                        Sua aprovação
                        <br />
                        começa aqui.
                    </h1>
                    <p className="text-white/70 mt-4 text-lg leading-relaxed">
                        Estudo inteligente com cronograma adaptativo,
                        questões com feedback e simulados completos.
                    </p>
                </div>

                <div className="flex items-center gap-6">
                    {[
                        { value: "10k+", label: "Aprovados" },
                        { value: "50k+", label: "Questões" },
                        { value: "98%", label: "Satisfação" },
                    ].map(({ value, label }) => (
                        <div key={label}>
                            <p className="font-display text-2xl font-bold text-white">{value}</p>
                            <p className="text-white/60 text-sm">{label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Lado direito — formulário ── */}
            <div className="flex-1 flex items-center justify-center p-8 bg-background overflow-y-auto">
                <div className="w-full max-w-sm">

                    {/* Mobile: logo */}
                    <div className="flex items-center gap-3 mb-8 lg:hidden">
                        <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
                            <GraduationCap className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <span className="font-display font-bold text-foreground">
                            {branding.platform_name}
                        </span>
                    </div>

                    <div className="mb-8">
                        <h2 className="font-display text-2xl font-bold text-foreground">
                            Entrar
                        </h2>
                        <p className="text-muted-foreground text-sm mt-1">
                            Acesse sua conta para continuar estudando.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {/* E-mail */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground">
                                E-mail
                            </label>
                            <input
                                {...register("email")}
                                type="email"
                                autoComplete="email"
                                placeholder="seu@email.com"
                                className={cn(
                                    "w-full h-10 px-3 rounded-lg border bg-background text-sm",
                                    "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                                    "transition-colors placeholder:text-muted-foreground",
                                    errors.email ? "border-destructive" : "border-input hover:border-ring"
                                )}
                            />
                            {errors.email && (
                                <p className="text-xs text-destructive">{errors.email.message}</p>
                            )}
                        </div>

                        {/* Senha */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-foreground">Senha</label>
                                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                                    Esqueceu a senha?
                                </Link>
                            </div>
                            <div className="relative">
                                <input
                                    {...register("password")}
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    className={cn(
                                        "w-full h-10 px-3 pr-10 rounded-lg border bg-background text-sm",
                                        "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                                        "transition-colors placeholder:text-muted-foreground",
                                        errors.password ? "border-destructive" : "border-input hover:border-ring"
                                    )}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="text-xs text-destructive">{errors.password.message}</p>
                            )}
                        </div>

                        {/* Erro do servidor */}
                        {serverError && (
                            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                                <p className="text-xs text-destructive">{serverError}</p>
                            </div>
                        )}

                        <Button type="submit" className="w-full" size="lg" loading={login.isPending}>
                            {login.isPending ? "Entrando..." : "Entrar"}
                        </Button>
                    </form>

                    <p className="text-center text-sm text-muted-foreground mt-6">
                        Não tem conta?{" "}
                        <Link href="/register" className="text-primary font-medium hover:underline">
                            Criar conta
                        </Link>
                    </p>

                    {/* ✅ Seletor de tenant — client-side com useEffect, sem hydration error */}
                    <TenantSwitcher />

                </div>
            </div>
        </div>
    );
}