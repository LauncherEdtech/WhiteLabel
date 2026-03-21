// frontend/src/app/(auth)/[tenant]/register/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/stores/authStore";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { useToast } from "@/components/ui/toaster";
import Cookies from "js-cookie";

const schema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});
type Form = z.infer<typeof schema>;

export default function TenantRegisterPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;
  const router = useRouter();
  const { setUser, setTokens } = useAuthStore();
  const { getBranding } = useTenantStore();
  const branding = getBranding();
  const toast = useToast();

  useEffect(() => {
    if (tenantSlug) Cookies.set("tenant_slug", tenantSlug, { sameSite: "lax", expires: 1 });
  }, [tenantSlug]);

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (d: Form) => authApi.register(d.name, d.email, d.password),
    onSuccess: (data: any) => {
      setTokens(data.access_token, data.refresh_token);
      setUser(data.user);
      router.push("/dashboard");
    },
    onError: () => toast.error("Erro ao criar conta. Tente novamente."),
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-foreground">{branding.platform_name}</span>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Criar conta</h2>
          <p className="text-muted-foreground text-sm mt-1">Comece sua jornada rumo à aprovação.</p>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          {[
            { field: "name" as const, label: "Nome completo", type: "text", placeholder: "Maria Silva" },
            { field: "email" as const, label: "E-mail", type: "email", placeholder: "seu@email.com" },
            { field: "password" as const, label: "Senha", type: "password", placeholder: "Mínimo 8 caracteres" },
          ].map(({ field, label, type, placeholder }) => (
            <div key={field} className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{label}</label>
              <Input {...register(field)} type={type} placeholder={placeholder} error={!!errors[field]} />
              {errors[field] && <p className="text-xs text-destructive">{errors[field]?.message}</p>}
            </div>
          ))}
          <Button type="submit" className="w-full" size="lg" loading={mutation.isPending}>
            Criar conta
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href={`/${tenantSlug}/login`} className="text-primary font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
