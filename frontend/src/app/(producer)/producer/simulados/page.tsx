// frontend/src/app/(producer)/producer/simulados/page.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { useForm } from "react-hook-form";
import { useCourses } from "@/lib/hooks/useCourses";
import { ClipboardList, Plus, Clock, HelpCircle, Sparkles } from "lucide-react";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";
import type { Simulado } from "@/types/api";

export default function ProducerSimuladosPage() {
  const [showCreate, setShowCreate] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: courses } = useCourses();

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.SIMULADOS(),
    queryFn: async () => {
      const res = await apiClient.get<{ simulados: Simulado[] }>("/simulados/");
      return res.data.simulados;
    },
  });

  const createMutation = useMutation({
    mutationFn: (d: {
      course_id: string; title: string;
      time_limit_minutes: number; total_questions: number; difficulty?: string;
    }) => apiClient.post("/simulados/auto-generate", d).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SIMULADOS() });
      toast.success("Simulado criado com sucesso!");
      setShowCreate(false);
      reset();
    },
    onError: () => toast.error("Erro ao criar simulado. Verifique se há questões no banco."),
  });

  const { register, handleSubmit, reset } = useForm({
    defaultValues: { course_id: "", title: "", time_limit_minutes: 60, total_questions: 20 },
  });

  const simulados = data || [];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Simulados</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {simulados.length} simulado(s) criado(s)
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Sparkles className="h-4 w-4" /> Gerar com IA
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : simulados.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-4">
            <ClipboardList className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="font-semibold text-foreground">Nenhum simulado ainda</p>
              <p className="text-sm text-muted-foreground mt-1">
                Gere um simulado automaticamente com IA.
              </p>
            </div>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Criar primeiro simulado
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {simulados.map((sim: Simulado) => {
            const attempts = (sim as any).total_attempts || 0;
            return (
              <Card key={sim.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <ClipboardList className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground truncate">{sim.title}</p>
                        <Badge variant={sim.is_active ? "success" : "outline"}>
                          {sim.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                        {sim.is_ai_generated && (
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="h-2.5 w-2.5 mr-1" /> IA
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <HelpCircle className="h-3 w-3" />
                          {sim.total_questions} questões
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {sim.time_limit_minutes}min
                        </span>
                        <span>
                          Aprovação: {Math.round((sim.settings?.passing_score || 0.6) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal criar simulado */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Gerar simulado com IA
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((d) => createMutation.mutate({
              ...d,
              time_limit_minutes: Number(d.time_limit_minutes),
              total_questions: Number(d.total_questions),
            }))}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Título</label>
              <Input {...register("title", { required: true })} placeholder="Ex: Simulado Geral — Abril 2025" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Curso</label>
              <select
                {...register("course_id", { required: true })}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Selecione um curso</option>
                {(courses || []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Questões</label>
                <Input
                  {...register("total_questions", { valueAsNumber: true })}
                  type="number" min="5" max="100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Tempo (min)</label>
                <Input
                  {...register("time_limit_minutes", { valueAsNumber: true })}
                  type="number" min="10" max="480"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground bg-primary/5 p-3 rounded-lg">
              💡 A IA selecionará automaticamente as questões priorizando as mais difíceis para a turma.
            </p>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Gerar simulado
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}