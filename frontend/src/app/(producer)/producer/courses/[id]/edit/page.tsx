// frontend/src/app/(producer)/producer/courses/[id]/edit/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toaster";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";
import { ChevronLeft, BookOpen, Image, AlignLeft, ToggleLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

interface CourseEditForm {
  name: string;
  description: string;
  thumbnail_url: string;
  is_active: boolean;
}

export default function CourseEditPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: course, isLoading } = useQuery({
    queryKey: QUERY_KEYS.COURSE(courseId),
    queryFn: () => apiClient.get(`/courses/${courseId}`).then(r => r.data.course),
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isDirty } } = useForm<CourseEditForm>({
    defaultValues: {
      name: "",
      description: "",
      thumbnail_url: "",
      is_active: true,
    },
  });

  // Popula o form quando o curso carregar
  useEffect(() => {
    if (course) {
      reset({
        name: course.name || "",
        description: course.description || "",
        thumbnail_url: course.thumbnail_url || "",
        is_active: course.is_active ?? true,
      });
    }
  }, [course, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: CourseEditForm) =>
      apiClient.put(`/courses/${courseId}`, {
        name: data.name,
        description: data.description || null,
        thumbnail_url: data.thumbnail_url || null,
        is_active: data.is_active,
      }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSES });
      toast.success("Curso atualizado!", "As alterações foram salvas.");
      router.push(`/producer/courses/${courseId}`);
    },
    onError: (err: any) => {
      toast.error(
        "Erro ao salvar",
        err?.response?.data?.message || "Tente novamente."
      );
    },
  });

  const isActive = watch("is_active");
  const thumbnailUrl = watch("thumbnail_url");

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/producer/courses/${courseId}`}>
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </Link>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Editar Curso</h1>
          <p className="text-sm text-muted-foreground">{course?.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(d => updateMutation.mutate(d))} className="space-y-4">

        {/* Nome */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Nome do Concurso / Curso *
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              {...register("name", { required: "Nome obrigatório", minLength: { value: 2, message: "Mínimo 2 caracteres" } })}
              placeholder="Ex: Aprovação PCDF 2025 — Delegado"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </CardContent>
        </Card>

        {/* Descrição */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlignLeft className="h-4 w-4" />
              Descrição
            </CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              {...register("description")}
              rows={4}
              placeholder="Descreva o conteúdo do curso, público-alvo e objetivos..."
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </CardContent>
        </Card>

        {/* Thumbnail */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Image className="h-4 w-4" />
              Imagem de Capa (URL)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              {...register("thumbnail_url")}
              placeholder="https://exemplo.com/imagem.jpg"
              type="url"
            />
            {thumbnailUrl && (
              <div className="relative h-40 rounded-lg overflow-hidden border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbnailUrl}
                  alt="Preview"
                  className="h-full w-full object-cover"
                  onError={e => (e.currentTarget.style.display = "none")}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Cole a URL de uma imagem (JPG, PNG ou WebP). Tamanho recomendado: 1280×720px.
            </p>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ToggleLeft className="h-4 w-4" />
              Status do Curso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {[
                { value: true, label: "Ativo", desc: "Visível para alunos matriculados" },
                { value: false, label: "Inativo", desc: "Oculto para todos os alunos" },
              ].map(opt => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setValue("is_active", opt.value, { shouldDirty: true })}
                  className={cn(
                    "flex-1 p-3 rounded-lg border-2 text-left transition-all",
                    isActive === opt.value
                      ? opt.value
                        ? "border-success bg-success/5"
                        : "border-destructive bg-destructive/5"
                      : "border-border hover:border-muted-foreground/40"
                  )}
                >
                  <p className={cn(
                    "text-sm font-medium",
                    isActive === opt.value
                      ? opt.value ? "text-success" : "text-destructive"
                      : "text-foreground"
                  )}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Link href={`/producer/courses/${courseId}`} className="flex-1">
            <Button variant="outline" className="w-full" type="button">
              Cancelar
            </Button>
          </Link>
          <Button
            type="submit"
            className="flex-1"
            disabled={updateMutation.isPending || !isDirty}
          >
            {updateMutation.isPending
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
              : "Salvar Alterações"
            }
          </Button>
        </div>
      </form>
    </div>
  );
}