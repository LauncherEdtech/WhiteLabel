// frontend/src/app/(producer)/producer/questions/new/page.tsx
"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils/cn";
import { Plus, Trash2, Check, ChevronLeft } from "lucide-react";
import Link from "next/link";

interface AlternativeField {
  key: string;
  text: string;
  distractor_justification: string;
}

interface QuestionForm {
  statement: string;
  discipline: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  exam_board: string;
  exam_year: string;
  correct_alternative_key: string;
  correct_justification: string;
  alternatives: AlternativeField[];
}

const KEYS = ["a", "b", "c", "d", "e"];

export default function NewQuestionPage() {
  const router = useRouter();
  const toast = useToast();

  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<QuestionForm>({
    defaultValues: {
      difficulty: "medium",
      correct_alternative_key: "a",
      alternatives: KEYS.slice(0, 4).map((key) => ({
        key,
        text: "",
        distractor_justification: "",
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "alternatives" });
  const correctKey = watch("correct_alternative_key");

  const createMutation = useMutation({
    mutationFn: (data: QuestionForm) =>
      apiClient.post("/questions/", {
        ...data,
        exam_year: data.exam_year ? parseInt(data.exam_year) : null,
        alternatives: data.alternatives.map((a) => ({
          key: a.key,
          text: a.text,
          distractor_justification: a.distractor_justification || null,
        })),
      }).then((r) => r.data),
    onSuccess: () => {
      toast.success("Questão criada com sucesso!");
      router.push("/producer/questions");
    },
    onError: () => toast.error("Erro ao criar questão"),
  });

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/producer/questions">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
        </Link>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Nova questão</h1>
          <p className="text-sm text-muted-foreground">Crie uma questão manualmente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-5">
        {/* Enunciado */}
        <Card>
          <CardHeader><CardTitle className="text-base">Enunciado</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <textarea
              {...register("statement", { required: "Obrigatório" })}
              placeholder="Digite o enunciado da questão..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {errors.statement && (
              <p className="text-xs text-destructive">{errors.statement.message}</p>
            )}
          </CardContent>
        </Card>

        {/* Metadados */}
        <Card>
          <CardHeader><CardTitle className="text-base">Metadados</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Disciplina</label>
              <Input {...register("discipline")} placeholder="Ex: Direito Penal" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Tema</label>
              <Input {...register("topic")} placeholder="Ex: Teoria Geral do Crime" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Banca</label>
              <Input {...register("exam_board")} placeholder="Ex: CESPE" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Ano</label>
              <Input {...register("exam_year")} placeholder="Ex: 2023" type="number" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium text-foreground">Dificuldade</label>
              <div className="flex gap-2">
                {(["easy", "medium", "hard"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setValue("difficulty", d)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-medium border transition-all",
                      watch("difficulty") === d
                        ? d === "easy" ? "bg-success text-success-foreground border-success"
                          : d === "medium" ? "bg-warning text-warning-foreground border-warning"
                            : "bg-destructive text-destructive-foreground border-destructive"
                        : "border-border text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {d === "easy" ? "Fácil" : d === "medium" ? "Médio" : "Difícil"}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alternativas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Alternativas</CardTitle>
              {fields.length < 5 && (
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => append({ key: KEYS[fields.length], text: "", distractor_justification: "" })}
                >
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, i) => (
              <div
                key={field.id}
                className={cn(
                  "p-4 rounded-xl border-2 space-y-3 transition-all",
                  correctKey === field.key
                    ? "border-success bg-success/5"
                    : "border-border"
                )}
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setValue("correct_alternative_key", field.key)}
                    className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all shrink-0",
                      correctKey === field.key
                        ? "bg-success text-success-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                    title="Marcar como correta"
                  >
                    {correctKey === field.key ? <Check className="h-4 w-4" /> : field.key.toUpperCase()}
                  </button>

                  <Input
                    {...register(`alternatives.${i}.text`, { required: "Obrigatório" })}
                    placeholder={`Texto da alternativa ${field.key.toUpperCase()}`}
                    className="flex-1"
                  />

                  {fields.length > 2 && correctKey !== field.key && (
                    <Button
                      type="button" variant="ghost" size="icon-sm"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => remove(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {correctKey !== field.key && (
                  <Input
                    {...register(`alternatives.${i}.distractor_justification`)}
                    placeholder="Por que esta alternativa está errada? (opcional)"
                    className="text-xs"
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Justificativa da correta */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Check className="h-4 w-4 text-success" />
              Justificativa da resposta correta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              {...register("correct_justification")}
              placeholder="Explique por que a alternativa correta está certa..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Link href="/producer/questions" className="flex-1">
            <Button variant="outline" className="w-full">Cancelar</Button>
          </Link>
          <Button type="submit" className="flex-1" loading={createMutation.isPending}>
            Criar questão
          </Button>
        </div>
      </form>
    </div>
  );
}