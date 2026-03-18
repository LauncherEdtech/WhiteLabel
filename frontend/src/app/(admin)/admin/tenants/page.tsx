// frontend/src/app/(admin)/admin/tenants/page.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tenantsApi } from "@/lib/api/tenants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Plus, Globe, CheckCircle2, XCircle } from "lucide-react";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";

const schema = z.object({
    name: z.string().min(2),
    slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens"),
    plan: z.enum(["basic", "pro", "enterprise"]),
    admin_name: z.string().min(2),
    admin_email: z.string().email(),
    admin_password: z.string().min(8),
});

type Form = z.infer<typeof schema>;

export default function TenantsPage() {
    const [showCreate, setShowCreate] = useState(false);
    const toast = useToast();
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: QUERY_KEYS.TENANTS,
        queryFn: () => tenantsApi.list(),
    });

    const createMutation = useMutation({
        mutationFn: (d: Form) => tenantsApi.create(d),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TENANTS });
            toast.success("Tenant criado!", "O infoprodutor foi cadastrado com sucesso.");
            setShowCreate(false);
            reset();
        },
        onError: () => toast.error("Erro ao criar tenant"),
    });

    const { register, handleSubmit, formState: { errors }, reset } = useForm<Form>({
        resolver: zodResolver(schema),
        defaultValues: { plan: "pro" },
    });

    const tenants = data || [];

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">Tenants</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {tenants.length} infoprodutores cadastrados
                    </p>
                </div>
                <Button onClick={() => setShowCreate(true)}>
                    <Plus className="h-4 w-4" />
                    Novo tenant
                </Button>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="space-y-3">
                    {tenants.map((tenant: {
                        id: string; name: string; slug: string; plan: string;
                        is_active: boolean; custom_domain: string | null; created_at: string;
                    }) => (
                        <Card key={tenant.id} className="hover:shadow-sm transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                        <Building2 className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-foreground">{tenant.name}</p>
                                            <Badge variant={tenant.plan === "enterprise" ? "default" : tenant.plan === "pro" ? "secondary" : "outline"}>
                                                {tenant.plan}
                                            </Badge>
                                            {tenant.is_active
                                                ? <CheckCircle2 className="h-4 w-4 text-success" />
                                                : <XCircle className="h-4 w-4 text-destructive" />
                                            }
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            <p className="text-xs text-muted-foreground font-mono">{tenant.slug}</p>
                                            {tenant.custom_domain && (
                                                <p className="text-xs text-primary flex items-center gap-1">
                                                    <Globe className="h-3 w-3" /> {tenant.custom_domain}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Modal criar tenant */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Novo infoprodutor</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-3">
                        {[
                            { field: "name" as const, label: "Nome da empresa" },
                            { field: "slug" as const, label: "Slug (URL)" },
                            { field: "admin_name" as const, label: "Nome do admin" },
                            { field: "admin_email" as const, label: "E-mail do admin" },
                            { field: "admin_password" as const, label: "Senha do admin" },
                        ].map(({ field, label }) => (
                            <div key={field} className="space-y-1">
                                <label className="text-sm font-medium text-foreground">{label}</label>
                                <Input
                                    {...register(field)}
                                    type={field.includes("password") ? "password" : field.includes("email") ? "email" : "text"}
                                    error={!!errors[field]}
                                />
                                {errors[field] && (
                                    <p className="text-xs text-destructive">{errors[field]?.message}</p>
                                )}
                            </div>
                        ))}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-foreground">Plano</label>
                            <select
                                {...register("plan")}
                                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="basic">Basic</option>
                                <option value="pro">Pro</option>
                                <option value="enterprise">Enterprise</option>
                            </select>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" loading={createMutation.isPending}>
                                Criar tenant
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}