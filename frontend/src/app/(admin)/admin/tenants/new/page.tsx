// frontend/src/app/(admin)/admin/tenants/new/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { tenantsApi } from "@/lib/api/tenants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { ChevronLeft, Building2 } from "lucide-react";
import Link from "next/link";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";

const schema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens"),
  plan: z.enum(["basic", "pro", "enterprise"]),
  admin_name: z.string().min(2),
  admin_email: z.string().email("E-mail inválido"),
  admin_password: z.string().min(8, "Mínimo 8 caracteres"),
  custom_domain: z.string().optional(),
});

type Form = z.infer<typeof schema>;

export default function NewTenantPage() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { plan: "pro" },
  });

  const createMutation = useMutation({
    mutationFn: (d: Form) => tenantsApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TENANTS });
      toast.success("Tenant criado com sucesso!");
      router.push("/admin/tenants");
    },
    onError: () => toast.error("Erro ao criar tenant. Verifique se o slug já existe."),
  });

  const fields: { name: keyof Form; label: string; type?: string; placeholder: string }[] = [
    { name: "name", label: "Nome da empresa", placeholder: "Ex: Curso Jurídico LTDA" },
    { name: "slug", label: "Slug (URL)", placeholder: "Ex: curso-juridico" },
    { name: "admin_name", label: "Nome do administrador", placeholder: "Ex: João Silva" },
    { name: "admin_email", label: "E-mail do administrador", type: "email", placeholder: "admin@empresa.com" },
    { name: "admin_password", label: "Senha do administrador", type: "password", placeholder: "Mínimo 8 caracteres" },
    { name: "custom_domain", label: "Domínio customizado (opcional)", placeholder: "Ex: alunos.cursojuridico.com.br" },
  ];

  return (
    <div className="max-w-lg space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/admin/tenants">
          <Button variant="ghost" size="sm"><ChevronLeft className="h-4 w-4" /> Voltar</Button>
        </Link>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Novo infoprodutor</h1>
          <p className="text-sm text-muted-foreground">Cria um novo tenant na plataforma</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Dados do tenant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            {fields.map(({ name, label, type = "text", placeholder }) => (
              <div key={name} className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{label}</label>
                <Input
                  {...register(name)}
                  type={type}
                  placeholder={placeholder}
                  error={!!errors[name]}
                />
                {errors[name] && (
                  <p className="text-xs text-destructive">{errors[name]?.message}</p>
                )}
              </div>
            ))}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Plano</label>
              <select
                {...register("plan")}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="basic">Basic — Funcionalidades essenciais</option>
                <option value="pro">Pro — Inclui IA e analytics avançado</option>
                <option value="enterprise">Enterprise — Tudo ilimitado</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <Link href="/admin/tenants" className="flex-1">
                <Button variant="outline" className="w-full">Cancelar</Button>
              </Link>
              <Button type="submit" className="flex-1" loading={createMutation.isPending}>
                Criar tenant
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}