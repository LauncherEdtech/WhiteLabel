// frontend/src/app/(producer)/producer/courses/page.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BookOpen, Plus, Users, ChevronRight,
  Eye, EyeOff, Pencil,
} from "lucide-react";
import Link from "next/link";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";
import type { Course } from "@/types/api";

const schema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  description: z.string().optional(),
});

type Form = z.infer<typeof schema>;

export default function ProducerCoursesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.COURSES,
    queryFn: async () => {
      const res = await apiClient.get<{ courses: Course[] }>("/courses/");
      return res.data.courses;
    },
  });

  const createMutation = useMutation({
    mutationFn: (d: Form) =>
      apiClient.post("/courses/", { ...d, is_active: true }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSES });
      toast.success("Curso criado com sucesso!");
      setShowCreate(false);
      reset();
    },
    onError: () => toast.error("Erro ao criar curso"),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active, name }: { id: string; is_active: boolean; name: string }) =>
      apiClient.put(`/courses/${id}`, { name, is_active }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSES });
      toast.success("Curso atualizado!");
    },
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const courses = data || [];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Cursos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {courses.length} curso(s) criado(s)
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Novo curso
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Nenhum curso ainda</p>
              <p className="text-sm text-muted-foreground mt-1">
                Crie seu primeiro curso para começar.
              </p>
            </div>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Criar primeiro curso
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {courses.map((course: Course) => (
            <Card key={course.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground truncate">
                        {course.name}
                      </p>
                      <Badge variant={course.is_active ? "success" : "outline"}>
                        {course.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    {course.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {course.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title={course.is_active ? "Desativar" : "Ativar"}
                      onClick={() =>
                        toggleActive.mutate({
                          id: course.id,
                          name: course.name,
                          is_active: !course.is_active,
                        })
                      }
                    >
                      {course.is_active ? (
                        <Eye className="h-4 w-4 text-success" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>

                    <Link href={`/producer/courses/${course.id}`}>
                      <Button variant="outline" size="sm">
                        <Pencil className="h-3 w-3" /> Gerenciar
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal criar curso */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo curso</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Nome do curso</label>
              <Input
                {...register("name")}
                placeholder="Ex: Delegado PC-SP 2025"
                error={!!errors.name}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Descrição (opcional)</label>
              <textarea
                {...register("description")}
                placeholder="Breve descrição do curso..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Criar curso
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}