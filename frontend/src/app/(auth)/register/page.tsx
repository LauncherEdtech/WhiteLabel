// frontend/src/app/(auth)/register/page.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Eye, EyeOff, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/lib/api/auth";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { cn } from "@/lib/utils/cn";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";

const schema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
    confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
    message: "Senhas não coincidem",
    path: ["confirm"],
});

type Form = z.infer<typeof schema>;

export default function RegisterPage() {
    const [showPass, setShowPass] = useState(false);
    const [serverError, setServerError] = useState("");
    const { getBranding } = useTenantStore();
    const branding = getBranding();
    const router = useRouter();

    const { register, handleSubmit, formState: { errors } } = useForm<Form>({
        resolver: zodResolver(schema),
    });

    const mutation = useMutation({
        mutationFn: (d: Form) => authApi.register(d.name, d.email, d.password),
        onSuccess: () => router.push("/login?registered=true"),
        onError: (err: AxiosError<{ message: string }>) => {
            setServerError(err.response?.data?.message || "Erro ao criar conta.");
        },
    });

    return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-background">
            <div className="w-full max-w-sm space-y-6">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
                        <GraduationCap className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="font-display font-bold text-foreground">
                        {branding.platform_name}
                    </span>
                </div>

                <div>
                    <h2 className="font-display text-2xl font-bold text-foreground">Criar conta</h2>
                    <p className="text-muted-foreground text-sm mt-1">Comece sua jornada rumo à aprovação.</p>
                </div>

                <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
                    {(["name", "email"] as const).map((field) => (
                        <div key={field} className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground capitalize">
                                {field === "name" ? "Nome completo" : "E-mail"}
                            </label>
                            <Input
                                {...register(field)}
                                type={field === "email" ? "email" : "text"}
                                error={!!errors[field]}
                                placeholder={field === "name" ? "Seu nome" : "seu@email.com"}
                            />
                            {errors[field] && (
                                <p className="text-xs text-destructive">{errors[field]?.message}</p>
                            )}
                        </div>
                    ))}

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Senha</label>
                        <div className="relative">
                            <Input
                                {...register("password")}
                                type={showPass ? "text" : "password"}
                                error={!!errors.password}
                                placeholder="Mínimo 8 caracteres"
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Confirmar senha</label>
                        <Input
                            {...register("confirm")}
                            type="password"
                            error={!!errors.confirm}
                            placeholder="Repita a senha"
                        />
                        {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
                    </div>

                    {serverError && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                            <p className="text-xs text-destructive">{serverError}</p>
                        </div>
                    )}

                    <Button type="submit" className="w-full" size="lg" loading={mutation.isPending}>
                        Criar conta
                    </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground">
                    Já tem conta?{" "}
                    <Link href="/login" className="text-primary font-medium hover:underline">Entrar</Link>
                </p>
            </div>
        </div>
    );
}