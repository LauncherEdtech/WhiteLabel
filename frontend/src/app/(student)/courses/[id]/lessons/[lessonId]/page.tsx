// frontend/src/app/(student)/courses/[id]/lessons/[lessonId]/page.tsx
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { coursesApi } from "@/lib/api/courses";
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
  ThumbsUp, ThumbsDown, Minus,
} from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";

type Difficulty = "easy" | "ok" | "hard";

export default function LessonPage() {
  const { id: courseId, lessonId } = useParams<{ id: string; lessonId: string }>();
  const router = useRouter();
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
      await checkin.mutateAsync({
        lessonId,
        completed,
        perceived_difficulty: difficulty,
      });
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

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href={ROUTES.COURSE(courseId)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar ao curso
        </Link>
      </div>

      {/* Player de vídeo */}
      {lesson.video_url ? (
        <div className="rounded-2xl overflow-hidden bg-black shadow-xl">
          <VideoPlayer url={lesson.video_url} />
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-muted to-muted/50 h-64 flex items-center justify-center border border-border">
          <div className="text-center">
            <div className="h-16 w-16 rounded-2xl bg-background/80 flex items-center justify-center mx-auto mb-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Esta aula não possui vídeo
            </p>
          </div>
        </div>
      )}

      {/* Info da aula */}
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-foreground">
          {lesson.title}
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          {lesson.duration_minutes > 0 && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {lesson.duration_minutes} minutos
            </span>
          )}
          {isWatched && (
            <Badge variant="success">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Assistida
            </Badge>
          )}
          {lesson.is_free_preview && (
            <Badge variant="secondary">Preview gratuito</Badge>
          )}
        </div>
        {lesson.description && (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {lesson.description}
          </p>
        )}
      </div>

      {/* Topics chips */}
      {lesson.ai_topics && lesson.ai_topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {lesson.ai_topics.map((topic: string) => (
            <span
              key={topic}
              className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full"
            >
              <Tag className="h-3 w-3" />
              {topic}
            </span>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {/* Check-in card */}
        <div className="md:col-span-2">
          <Card className={cn(
            "border-2 transition-all",
            checkinDone
              ? "border-success/50 bg-success/5"
              : "border-border"
          )}>
            <CardContent className="p-5">
              {checkinDone ? (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-success shrink-0" />
                  <div>
                    <p className="font-semibold text-success">Progresso registrado!</p>
                    <p className="text-sm text-muted-foreground">
                      Continue para a próxima aula ou pratique questões.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold text-foreground">
                      Você assistiu esta aula?
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Registre seu progresso para o cronograma se adaptar.
                    </p>
                  </div>

                  {/* Dificuldade percebida */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                      Como foi o conteúdo?
                    </p>
                    <div className="flex gap-2">
                      {([
                        { value: "easy", label: "Fácil", icon: ThumbsUp, color: "text-success border-success/30 hover:bg-success/10" },
                        { value: "ok", label: "Normal", icon: Minus, color: "text-warning border-warning/30 hover:bg-warning/10" },
                        { value: "hard", label: "Difícil", icon: ThumbsDown, color: "text-destructive border-destructive/30 hover:bg-destructive/10" },
                      ] as const).map(({ value, label, icon: Icon, color }) => (
                        <button
                          key={value}
                          onClick={() => setSelectedDifficulty(value)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                            color,
                            selectedDifficulty === value && "ring-2 ring-offset-1 ring-current"
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      className="flex-1"
                      onClick={() => handleCheckin(true, selectedDifficulty || undefined)}
                      loading={checkin.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Sim, assisti!
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleCheckin(false)}
                      disabled={checkin.isPending}
                    >
                      <XCircle className="h-4 w-4" />
                      Não assisti
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Material e links */}
        <div className="space-y-3">
          {lesson.material_url && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  Material de apoio
                </p>
                <a href={lesson.material_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <FileText className="h-4 w-4" />
                  Baixar PDF
                </a>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                Após assistir
              </p>
              <div className="space-y-2">
                <Link href={ROUTES.QUESTIONS} className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors">
                  → Praticar questões
                </Link>
                <Link href={ROUTES.SCHEDULE} className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors">
                  → Ver cronograma
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Resumo IA */}
      {lesson.has_ai_summary && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <button
              onClick={() => setShowAiSummary(!showAiSummary)}
              className="flex items-center justify-between w-full"
            >
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Resumo gerado por IA
              </CardTitle>
              <span className="text-xs text-primary">
                {showAiSummary ? "Ocultar" : "Ver resumo"}
              </span>
            </button>
          </CardHeader>
          {showAiSummary && lesson.ai_summary && (
            <CardContent className="pt-0">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {lesson.ai_summary}
                </p>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

// ── Player de vídeo ────────────────────────────────────────────────────────────
function VideoPlayer({ url }: { url: string }) {
  // Detecta tipo de URL
  const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
  const isVimeo = url.includes("vimeo.com");

  if (isYoutube) {
    // Extrai videoId de qualquer formato YouTube:
    // https://youtu.be/ID?si=xxx  →  ID
    // https://youtube.com/watch?v=ID&...  →  ID
    // https://youtube.com/embed/ID  →  ID
    let videoId = "";
    try {
      const u = new URL(url);
      if (u.hostname === "youtu.be") {
        videoId = u.pathname.slice(1).split("?")[0]; // remove ?si= etc
      } else {
        videoId = u.searchParams.get("v") || u.pathname.split("/").pop() || "";
      }
    } catch {
      videoId = url.split("/").pop()?.split("?")[0] || "";
    }
    return (
      <div className="relative pb-[56.25%] h-0">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          className="absolute top-0 left-0 w-full h-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      </div>
    );
  }

  if (isVimeo) {
    const videoId = url.split("/").pop();
    return (
      <div className="relative pb-[56.25%] h-0">
        <iframe
          src={`https://player.vimeo.com/video/${videoId}`}
          className="absolute top-0 left-0 w-full h-full"
          allowFullScreen
        />
      </div>
    );
  }

  // URL direta de vídeo (S3, etc.)
  return (
    <video
      src={url}
      controls
      className="w-full max-h-[480px]"
      controlsList="nodownload"
    />
  );
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