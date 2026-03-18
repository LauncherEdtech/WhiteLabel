// frontend/src/app/(producer)/producer/questions/[id]/edit/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { questionsApi } from "@/lib/api/questions";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils/cn";
import { Check, ChevronLeft, Trash2, Plus, Save } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

const KEYS = ["a", "b", "c", "d", "e"];

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

export default function EditQuestionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  const { data: question, isLoading } = useQuery({
    queryKey: ["questions", id],
    queryFn: () => questionsApi.get(id),
    enabled: !!id,
  });

  const { register, handleSubmit, watch, setValue, control, reset } = useForm<QuestionForm>({
    defaultValues: {
      difficulty: "medium",
      correct_alternative_key: "a",
      alternatives: KEYS.slice(0, 4).map((key) => ({
        key, text: "", distractor_justification: "",
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "alternatives" });
  const correctKey = watch("correct_alternative_key");

  // Preenche o form quando a questão carrega
  useEffect(() => {
    if (question) {
      reset({
        statement: question.statement,
        discipline: question.discipline || "",
        topic: question.topic || "",
        difficulty: question.difficulty || "medium",
        exam_board: question.exam_board || "",
        exam_year: question.exam_year?.toString() || "",
        correct_alternative_key: question.correct_alternative_key || "a",
        correct_justification: question.correct_justification || "",
        alternatives: question.alternatives.map((a) => ({
          key: a.key,
          text: a.text,
          distractor_justification: a.distractor_justification || "",
        })),
      });
    }
  }, [question, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: QuestionForm) =>
      apiClient.put(`/questions/${id}`, {
        ...data,
        exam_year: data.exam_year ? parseInt(data.exam_year) : null,
        alternatives: data.alternatives.map((a) => ({
          key: a.key,
          text: a.text,
          distractor_justification: a.distractor_justification || null,
        })),
      }).then((r) => r.data),
    onSuccess: () => {
      toast.success("Questão atualizada!");
      router.push("/producer/questions");
    },
    onError: () => toast.error("Erro ao atualizar questão"),
  });

  if (isLoading) return <Skeleton className="h-64 rounded-xl animate-pulse" />;

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/producer/questions">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
        </Link>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Editar questão</h1>
          <p className="text-sm text-muted-foreground">Atualize o conteúdo e as alternativas</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="space-y-5">
        {/* Enunciado */}
        <Card>
          <CardHeader><CardTitle className="text-base">Enunciado</CardTitle></CardHeader>
          <CardContent>
            <textarea
              {...register("statement", { required: true })}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
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
              <Input {...register("exam_year")} type="number" placeholder="Ex: 2023" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-medium text-foreground">Dificuldade</label>
              <div className="flex gap-2">
                {(["easy", "medium", "hard"] as const).map((d) => (
                  <button
                    key={d} type="button"
                    onClick={() => setValue("difficulty", d)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-medium border transition-all",
                      watch("difficulty") === d
                        ? d === "easy" ? "bg-success text-white border-success"
                          : d === "medium" ? "bg-warning text-white border-warning"
                            : "bg-destructive text-white border-destructive"
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
                <Button type="button" variant="outline" size="sm"
                  onClick={() => append({ key: KEYS[fields.length], text: "", distractor_justification: "" })}
                >
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, i) => (
              <div key={field.id}
                className={cn(
                  "p-4 rounded-xl border-2 space-y-3 transition-all",
                  correctKey === field.key ? "border-success bg-success/5" : "border-border"
                )}
              >
                <div className="flex items-center gap-3">
                  <button type="button"
                    onClick={() => setValue("correct_alternative_key", field.key)}
                    className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all shrink-0",
                      correctKey === field.key
                        ? "bg-success text-success-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {correctKey === field.key ? <Check className="h-4 w-4" /> : field.key.toUpperCase()}
                  </button>
                  <Input
                    {...register(`alternatives.${i}.text`, { required: true })}
                    placeholder={`Alternativa ${field.key.toUpperCase()}`}
                    className="flex-1"
                  />
                  {fields.length > 2 && correctKey !== field.key && (
                    <Button type="button" variant="ghost" size="icon-sm"
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

        {/* Justificativa */}
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
              rows={3}
              placeholder="Explique por que a alternativa correta está certa..."
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Link href="/producer/questions" className="flex-1">
            <Button variant="outline" className="w-full">Cancelar</Button>
          </Link>
          <Button type="submit" className="flex-1" loading={updateMutation.isPending}>
            <Save className="h-4 w-4" /> Salvar alterações
          </Button>
        </div>
      </form>
    </div>
  );
}