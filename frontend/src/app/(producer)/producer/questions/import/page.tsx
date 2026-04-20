// frontend/src/app/(producer)/producer/questions/import/page.tsx
"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toaster";
import { useCourses } from "@/lib/hooks/useCourses";
import { cn } from "@/lib/utils/cn";
import {
  Sparkles, Upload, FileText, Check,
  ChevronLeft, AlertCircle, BookOpen,
  HelpCircle, X,
} from "lucide-react";
import Link from "next/link";

interface ExtractedQuestion {
  statement: string;
  discipline: string;
  topic: string;
  difficulty: string;
  exam_board: string;
  exam_year: number | null;
  correct_alternative_key: string;
  correct_justification: string;
  alternatives: { key: string; text: string; distractor_justification?: string }[];
  selected?: boolean;
}

export default function ImportQuestionsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: courses } = useCourses();

  const [step, setStep] = useState<"upload" | "review" | "done">("upload");
  const [courseId, setCourseId] = useState("");
  const [context, setContext] = useState("");
  const [questions, setQuestions] = useState<ExtractedQuestion[]>([]);
  const [file, setFile] = useState<File | null>(null);

  // Extração via Gemini
  const extractMutation = useMutation({
    mutationFn: async () => {
      const body = file
        ? (() => {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("course_id", courseId);
          fd.append("context", context);
          return apiClient.post("/questions/extract", fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        })()
        : apiClient.post("/questions/extract-text", { context, course_id: courseId });

      const res = await body;
      return res.data;
    },
    onSuccess: (data) => {
      const extracted = (data.questions || []).map((q: ExtractedQuestion) => ({
        ...q,
        selected: true,
      }));
      if (extracted.length === 0) {
        toast.error("Nenhuma questão encontrada no conteúdo fornecido.");
        return;
      }
      setQuestions(extracted);
      setStep("review");
      toast.success(`${extracted.length} questões extraídas!`);
    },
    onError: () => {
      // Fallback: se o endpoint não existir ainda, mostra mensagem informativa
      toast.info(
        "Pipeline Mentor Inteligente não configurado",
        "Configure GEMINI_API_KEY no .env e implemente o endpoint /questions/extract."
      );
    },
  });

  // Salva questões selecionadas
  const saveMutation = useMutation({
    mutationFn: async () => {
      const selected = questions.filter((q) => q.selected);
      const results = await Promise.allSettled(
        selected.map((q) =>
          apiClient.post("/questions/", {
            statement: q.statement,
            discipline: q.discipline,
            topic: q.topic,
            difficulty: q.difficulty,
            exam_board: q.exam_board,
            exam_year: q.exam_year,
            correct_alternative_key: q.correct_alternative_key,
            correct_justification: q.correct_justification,
            alternatives: q.alternatives,
          })
        )
      );
      return results.filter((r) => r.status === "fulfilled").length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["questions"] });
      toast.success(`${count} questões importadas!`);
      setStep("done");
    },
    onError: () => toast.error("Erro ao salvar questões"),
  });

  const toggleQuestion = (i: number) => {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === i ? { ...q, selected: !q.selected } : q))
    );
  };

  const selectedCount = questions.filter((q) => q.selected).length;

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/producer/questions">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
        </Link>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Importar questões com IA
          </h1>
          <p className="text-sm text-muted-foreground">
            O Gemini extrai e estrutura questões automaticamente
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2">
        {["upload", "review", "done"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
              step === s ? "bg-primary text-primary-foreground" :
                ["review", "done"].indexOf(step) > ["review", "done"].indexOf(s)
                  ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
            )}>
              {["review", "done"].indexOf(step) > i ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span className={cn(
              "text-xs font-medium",
              step === s ? "text-foreground" : "text-muted-foreground"
            )}>
              {s === "upload" ? "Conteúdo" : s === "review" ? "Revisão" : "Concluído"}
            </span>
            {i < 2 && <div className="h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuração</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Curso de destino</label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">Selecione um curso (opcional)</option>
                  {(courses || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Upload de arquivo */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  PDF ou arquivo de questões (opcional)
                </label>
                <div
                  className={cn(
                    "border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer",
                    file ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30"
                  )}
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept=".pdf,.txt,.docx"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  {file ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium text-foreground">{file.name}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Arraste um PDF ou clique para selecionar
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        PDF, TXT, DOCX — máx. 10MB
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Texto/contexto */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Ou cole o conteúdo diretamente
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Cole aqui as questões, texto do edital, prova anterior..."
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </CardContent>
          </Card>

          {/* Info sobre o Gemini */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Como funciona</p>
                  <ul className="text-xs text-muted-foreground mt-1.5 space-y-1">
                    <li>• O Gemini analisa o conteúdo e identifica questões</li>
                    <li>• Extrai: enunciado, alternativas, gabarito e disciplina</li>
                    <li>• Gera justificativas para alternativas corretas e distratores</li>
                    <li>• Classifica dificuldade e competência avaliada</li>
                    <li>• Você revisa e aprova antes de salvar</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={() => extractMutation.mutate()}
            loading={extractMutation.isPending}
            disabled={!file && !context.trim()}
          >
            <Sparkles className="h-4 w-4" />
            {extractMutation.isPending ? "Extraindo questões..." : "Extrair com Gemini"}
          </Button>
        </div>
      )}

      {/* Step 2: Review */}
      {step === "review" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedCount} de {questions.length} questões selecionadas
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm"
                onClick={() => setQuestions((q) => q.map((x) => ({ ...x, selected: true })))}>
                Selecionar todas
              </Button>
              <Button variant="outline" size="sm"
                onClick={() => setQuestions((q) => q.map((x) => ({ ...x, selected: false })))}>
                Limpar
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {questions.map((q, i) => (
              <Card
                key={i}
                className={cn(
                  "cursor-pointer transition-all",
                  q.selected ? "border-primary/50 bg-primary/5" : "opacity-60"
                )}
                onClick={() => toggleQuestion(i)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "h-5 w-5 rounded flex items-center justify-center border-2 shrink-0 mt-0.5 transition-all",
                      q.selected ? "bg-primary border-primary" : "border-border"
                    )}>
                      {q.selected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground line-clamp-2">{q.statement}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {q.discipline && (
                          <Badge variant="outline" className="text-xs">{q.discipline}</Badge>
                        )}
                        {q.difficulty && (
                          <Badge variant={
                            q.difficulty === "easy" ? "success" :
                              q.difficulty === "hard" ? "destructive" : "warning"
                          } className="text-xs">
                            {q.difficulty === "easy" ? "Fácil" : q.difficulty === "hard" ? "Difícil" : "Médio"}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Gabarito: {q.correct_alternative_key?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("upload")}>
              Voltar
            </Button>
            <Button
              className="flex-1"
              onClick={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
              disabled={selectedCount === 0}
            >
              Importar {selectedCount} questão(ões)
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === "done" && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-success" />
            </div>
            <div>
              <p className="font-display text-xl font-bold text-foreground">
                Importação concluída!
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                As questões foram adicionadas ao banco com sucesso.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => { setStep("upload"); setQuestions([]); setFile(null); setContext(""); }}>
                Importar mais
              </Button>
              <Link href="/producer/questions">
                <Button>Ver questões</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}