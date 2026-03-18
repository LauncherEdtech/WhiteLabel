// frontend/src/app/(auth)/forgot-password/page.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { GraduationCap, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { AxiosError } from "axios";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
});

type Form = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const { getBranding } = useTenantStore();
  const branding = getBranding();

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (d: Form) => authApi.forgotPassword(d.email),
    onSuccess: () => setSent(true),
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-foreground">
            {branding.platform_name}
          </span>
        </div>

        {sent ? (
          /* Estado de sucesso */
          <div className="text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">
                E-mail enviado!
              </h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Se este e-mail estiver cadastrado, você receberá as instruções
                para redefinir sua senha em breve.
              </p>
            </div>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4" />
                Voltar ao login
              </Button>
            </Link>
          </div>
        ) : (
          /* Formulário */
          <>
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">
                Recuperar senha
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Digite seu e-mail para receber as instruções.
              </p>
            </div>

            <form
              onSubmit={handleSubmit((d) => mutation.mutate(d))}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    {...register("email")}
                    type="email"
                    placeholder="seu@email.com"
                    className="pl-9"
                    error={!!errors.email}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={mutation.isPending}
              >
                Enviar instruções
              </Button>
            </form>

            <Link
              href="/login"
              className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}