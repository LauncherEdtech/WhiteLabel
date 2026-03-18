// frontend/src/app/(auth)/reset-password/page.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { GraduationCap, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { AxiosError } from "axios";

const schema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Senhas não coincidem",
    path: ["confirm"],
  });

type Form = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [showPass, setShowPass] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState("");
  const { getBranding } = useTenantStore();
  const branding = getBranding();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (d: Form) => authApi.resetPassword(token, d.password),
    onSuccess: () => setDone(true),
    onError: (err: AxiosError<{ message: string }>) => {
      setServerError(err.response?.data?.message || "Token inválido ou expirado.");
    },
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <p className="font-semibold text-foreground">Link inválido</p>
          <p className="text-sm text-muted-foreground">
            Este link de redefinição é inválido ou expirou.
          </p>
          <Link href="/forgot-password">
            <Button variant="outline">Solicitar novo link</Button>
          </Link>
        </div>
      </div>
    );
  }

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

        {done ? (
          <div className="text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">
                Senha redefinida!
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Sua senha foi atualizada com sucesso.
              </p>
            </div>
            <Button className="w-full" onClick={() => router.push("/login")}>
              Ir para o login
            </Button>
          </div>
        ) : (
          <>
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">
                Nova senha
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Defina uma nova senha segura para sua conta.
              </p>
            </div>

            <form
              onSubmit={handleSubmit((d) => mutation.mutate(d))}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Nova senha
                </label>
                <div className="relative">
                  <Input
                    {...register("password")}
                    type={showPass ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                    error={!!errors.password}
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
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Confirmar senha
                </label>
                <Input
                  {...register("confirm")}
                  type="password"
                  placeholder="Repita a nova senha"
                  error={!!errors.confirm}
                />
                {errors.confirm && (
                  <p className="text-xs text-destructive">{errors.confirm.message}</p>
                )}
              </div>

              {serverError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-xs text-destructive">{serverError}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={mutation.isPending}
              >
                Redefinir senha
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}