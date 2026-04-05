// frontend/src/app/(student)/courses/[id]/lessons/[lessonId]/page.tsx
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { coursesApi } from "@/lib/api/courses";
import { apiClient } from "@/lib/api/client";
import { useCheckinLesson } from "@/lib/hooks/useCourses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils/cn";
import {
  CheckCircle2, XCircle, ChevronLeft,
  FileText, Sparkles, Clock, Tag,
  ThumbsUp, ThumbsDown, Minus, ExternalLink,
  PlayCircle, ArrowUpRight, ChevronDown, ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";
import { LessonRating } from "@/components/student/LessonRating";

type Difficulty = "easy" | "ok" | "hard";

export default function LessonPage() {
  const { id: courseId, lessonId } = useParams<{ id: string; lessonId: string }>();
  const toast = useToast();
  const [checkinDone, setCheckinDone] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [showAiSummary, setShowAiSummary] = useState(false);

  const { data: lesson, isLoading } = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: () => coursesApi.getLesson(lessonId),
    enabled: !!lessonId,
  });

  const checkin = useCheckinLesson();

  const handleCheckin = async (completed: boolean, difficulty?: Difficulty) => {
    try {
      await checkin.mutateAsync({ lessonId, completed, perceived_difficulty: difficulty });
      setCheckinDone(true);
      toast.success(
        completed ? "Aula concluída! ✓" : "Registrado.",
        completed ? "Continue assim!" : "Você pode revisitar quando quiser."
      );
    } catch {
      toast.error("Erro ao registrar progresso");
    }
  };

  if (isLoading) return <LessonSkeleton />;
  if (!lesson) return null;

  const isWatched = lesson.progress?.status === "watched";
  const hasExternalUrl = !!lesson.external_url;

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <Link href={ROUTES.COURSE(courseId)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ChevronLeft className="h-4 w-4" />
        Voltar ao curso
      </Link>

      {/* ── Conteúdo principal ── */}
      {hasExternalUrl ? (
        <ExternalLessonCard externalUrl={lesson.external_url!} isWatched={isWatched} />
      ) : lesson.video_url ? (
        <div className="rounded-2xl overflow-hidden bg-black shadow-xl">
          <VideoPlayer url={lesson.video_url} />
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-muted to-muted/50 h-64 flex items-center justify-center border border-border">
          <div className="text-center">
            <div className="h-16 w-16 rounded-2xl bg-background/80 flex items-center justify-center mx-auto mb-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Esta aula não possui vídeo</p>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-foreground">{lesson.title}</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {lesson.duration_minutes > 0 && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" />{lesson.duration_minutes} minutos
            </span>
          )}
          {isWatched && (
            <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" />Assistida</Badge>
          )}
          {hasExternalUrl && (
            <Badge variant="outline" className="text-xs gap-1">
              <ExternalLink className="h-3 w-3" />Aula externa
            </Badge>
          )}
          {lesson.is_free_preview && <Badge variant="secondary">Preview gratuito</Badge>}
        </div>
        {lesson.description && (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{lesson.description}</p>
        )}
      </div>

      {/* Topics */}
      {lesson.ai_topics && lesson.ai_topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {lesson.ai_topics.map((topic: string) => (
            <span key={topic}
              className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">
              <Tag className="h-3 w-3" />{topic}
            </span>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {/* Check-in */}
        <div className="md:col-span-2">
          <Card className={cn("border-2 transition-all",
            checkinDone ? "border-success/50 bg-success/5" : "border-border")}>
            <CardContent className="p-5">
              {checkinDone ? (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-success shrink-0" />
                  <div>
                    <p className="font-semibold text-success">Progresso registrado!</p>
                    <p className="text-sm text-muted-foreground">Continue para a próxima aula ou pratique questões.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      {hasExternalUrl ? "Você assistiu à aula na plataforma externa?" : "Você assistiu a esta aula?"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Registre seu progresso para manter seu cronograma atualizado.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground shrink-0">Dificuldade:</p>
                    {(["easy", "ok", "hard"] as Difficulty[]).map(d => (
                      <button key={d}
                        onClick={() => setSelectedDifficulty(d === selectedDifficulty ? null : d)}
                        className={cn(
                          "flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all",
                          selectedDifficulty === d
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-ring"
                        )}>
                        {d === "easy" && <><ThumbsUp className="h-3 w-3" /> Fácil</>}
                        {d === "ok" && <><Minus className="h-3 w-3" /> Ok</>}
                        {d === "hard" && <><ThumbsDown className="h-3 w-3" /> Difícil</>}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleCheckin(true, selectedDifficulty ?? undefined)}
                      disabled={checkin.isPending} className="flex-1 gap-2">
                      <CheckCircle2 className="h-4 w-4" />Sim, assisti
                    </Button>
                    <Button variant="outline" onClick={() => handleCheckin(false)} disabled={checkin.isPending}>
                      <XCircle className="h-4 w-4 mr-1" />Ainda não
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Materiais de Apoio */}
        {(lesson.materials?.length > 0) && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                MATERIAL{lesson.materials.length > 1 ? "IS" : ""} DE APOIO
              </p>
              {lesson.materials.map((mat: { id: string; url: string; filename: string }) => (
                <a key={mat.id} href={mat.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full gap-2 text-sm justify-start">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1 text-left">{mat.filename}</span>
                    <ExternalLink className="h-3 w-3 ml-auto shrink-0" />
                  </Button>
                </a>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Avaliação */}
      <LessonRating lessonId={lessonId} />

      {/* Resumo IA */}
      {lesson.has_ai_summary && lesson.ai_summary && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />Resumo gerado por IA
              </CardTitle>
              <button onClick={() => setShowAiSummary(v => !v)} className="text-xs text-primary hover:underline">
                {showAiSummary ? "Ocultar" : "Ver resumo"}
              </button>
            </div>
          </CardHeader>
          {showAiSummary && (
            <CardContent className="pt-0">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{lesson.ai_summary}</p>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Questões da aula ── */}
      <LessonQuestionsSection lessonId={lessonId} />
    </div>
  );
}

// ── Seção de questões para o aluno ────────────────────────────────────────────

function LessonQuestionsSection({ lessonId }: { lessonId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["lesson-questions-student", lessonId],
    queryFn: () => apiClient.get(`/courses/lessons/${lessonId}/questions`).then(r => r.data),
    enabled: !!lessonId,
  });

  const answerMutation = useMutation({
    mutationFn: ({ questionId, alternativeKey }: { questionId: string; alternativeKey: string }) =>
      apiClient.post(`/questions/${questionId}/answer`, { chosen_alternative_key: alternativeKey, context: "lesson" }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-questions-student", lessonId] });
    },
    onError: () => toast.error("Erro ao registrar resposta"),
  });

  const questions = data?.questions || [];

  // Não renderiza nada se não há questões — sem ocupar espaço visual
  if (isLoading || questions.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple-500" />
        <h2 className="text-base font-semibold text-foreground">Questões desta aula</h2>
        <Badge variant="outline" className="text-xs">{questions.length}</Badge>
      </div>

      <div className="space-y-3">
        {questions.map((q: any, idx: number) => (
          <StudentQuestionCard
            key={q.id}
            question={q}
            index={idx + 1}
            onAnswer={(altKey) => answerMutation.mutate({ questionId: q.id, alternativeKey: altKey })}
            isAnswering={answerMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function StudentQuestionCard({ question, index, onAnswer, isAnswering }: {
  question: any; index: number;
  onAnswer: (key: string) => void;
  isAnswering: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  // Se já respondeu anteriormente (vem do backend)
  const previousAnswer = question.last_attempt?.alternative_key ?? null;
  const wasCorrect = question.last_attempt?.is_correct ?? null;

  const answered = revealed || previousAnswer !== null;
  const correctKey = answered ? question.correct_alternative_key : null;

  const handleSelect = (key: string) => {
    if (answered) return;
    setSelected(key);
  };

  const handleConfirm = () => {
    if (!selected) return;
    onAnswer(selected);
    setRevealed(true);
  };

  const diffColor: Record<string, string> = {
    easy: "text-green-600 bg-green-50 border-green-200",
    medium: "text-amber-600 bg-amber-50 border-amber-200",
    hard: "text-red-600 bg-red-50 border-red-200",
  };
  const diffLabel: Record<string, string> = { easy: "Fácil", medium: "Médio", hard: "Difícil" };

  const chosenKey = selected ?? previousAnswer;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-foreground leading-snug flex-1">
            <span className="text-muted-foreground mr-1.5">{index}.</span>
            {question.statement}
          </p>
          {question.difficulty && (
            <span className={cn("text-xs px-1.5 py-0.5 rounded border shrink-0", diffColor[question.difficulty])}>
              {diffLabel[question.difficulty] || question.difficulty}
            </span>
          )}
        </div>

        {/* Alternativas */}
        <div className="space-y-1.5">
          {(question.alternatives || []).map((alt: any) => {
            const isChosen = chosenKey === alt.key;
            const isCorrect = correctKey === alt.key;
            const isWrong = answered && isChosen && !isCorrect;

            return (
              <button
                key={alt.key}
                onClick={() => handleSelect(alt.key)}
                disabled={answered}
                className={cn(
                  "w-full flex items-start gap-2 text-left text-xs px-3 py-2 rounded-lg border transition-all",
                  answered
                    ? isCorrect
                      ? "border-green-400 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : isWrong
                        ? "border-red-400 bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                        : "border-border text-muted-foreground opacity-60"
                    : isChosen
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground hover:border-primary/50 hover:bg-accent/30"
                )}
              >
                <span className="font-bold shrink-0">{alt.key.toUpperCase()})</span>
                <span>{alt.text}</span>
                {answered && isCorrect && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 ml-auto text-green-600" />}
                {answered && isWrong && <XCircle className="h-3.5 w-3.5 shrink-0 ml-auto text-red-600" />}
              </button>
            );
          })}
        </div>

        {/* Botão confirmar */}
        {!answered && selected && (
          <Button size="sm" onClick={handleConfirm} disabled={isAnswering} className="w-full">
            {isAnswering ? "Verificando..." : "Confirmar resposta"}
          </Button>
        )}

        {/* Justificativa */}
        {answered && question.correct_justification && (
          <div className="rounded-lg bg-muted/50 border border-border p-3">
            <p className="text-xs text-muted-foreground font-medium mb-1">Justificativa</p>
            <p className="text-xs text-foreground leading-relaxed">{question.correct_justification}</p>
          </div>
        )}

        {/* Resultado anterior */}
        {previousAnswer && !revealed && (
          <p className={cn("text-xs flex items-center gap-1",
            wasCorrect ? "text-green-600" : "text-red-600")}>
            {wasCorrect
              ? <><CheckCircle2 className="h-3 w-3" />Você acertou esta questão anteriormente</>
              : <><XCircle className="h-3 w-3" />Você errou esta questão anteriormente</>
            }
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Card externo ──────────────────────────────────────────────────────────────

function ExternalLessonCard({ externalUrl, isWatched }: { externalUrl: string; isWatched: boolean }) {
  const platform = detectPlatform(externalUrl);
  return (
    <div className={cn(
      "relative rounded-2xl overflow-hidden border-2 p-8 bg-gradient-to-br from-card to-muted/30",
      isWatched ? "border-success/40" : "border-border"
    )}>
      <div className="relative z-10 flex flex-col items-center text-center gap-6">
        <div className="h-20 w-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <PlayCircle className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-foreground">Esta aula está hospedada na {platform.name}</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Clique no botão abaixo para assistir. Depois volte aqui para registrar seu progresso.
          </p>
        </div>
        <a href={externalUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/25">
          <PlayCircle className="h-5 w-5" />Assistir na {platform.name}
          <ArrowUpRight className="h-4 w-4" />
        </a>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />Abre em uma nova aba
        </p>
      </div>
    </div>
  );
}

function detectPlatform(url: string): { name: string } {
  if (url.includes("hotmart")) return { name: "Hotmart" };
  if (url.includes("kiwify")) return { name: "Kiwify" };
  if (url.includes("eduzz")) return { name: "Eduzz" };
  if (url.includes("monetizze")) return { name: "Monetizze" };
  if (url.includes("braip")) return { name: "Braip" };
  return { name: "plataforma externa" };
}

function VideoPlayer({ url }: { url: string }) {
  const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
  const isVimeo = url.includes("vimeo.com");

  if (isYoutube) {
    let videoId = "";
    try {
      const u = new URL(url);
      videoId = u.hostname === "youtu.be"
        ? u.pathname.slice(1).split("?")[0]
        : u.searchParams.get("v") || u.pathname.split("/").pop() || "";
    } catch {
      videoId = url.split("/").pop()?.split("?")[0] || "";
    }
    return (
      <div className="relative pb-[56.25%] h-0">
        <iframe src={`https://www.youtube.com/embed/${videoId}`}
          className="absolute top-0 left-0 w-full h-full" allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
      </div>
    );
  }

  if (isVimeo) {
    return (
      <div className="relative pb-[56.25%] h-0">
        <iframe src={`https://player.vimeo.com/video/${url.split("/").pop()}`}
          className="absolute top-0 left-0 w-full h-full" allowFullScreen />
      </div>
    );
  }

  return <video src={url} controls className="w-full max-h-[480px]" controlsList="nodownload" />;
}

function LessonSkeleton() {
  return (
    <div className="max-w-4xl space-y-4 animate-pulse">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-72 rounded-2xl" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  );
}