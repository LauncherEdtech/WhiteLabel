// frontend/src/app/(student)/courses/[id]/lessons/[lessonId]/page.tsx
// ATUALIZADO: quando a aula tem external_url, exibe card de redirecionamento
// em vez do player de vídeo. O aluno pode fazer check-in normalmente.

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
  ThumbsUp, ThumbsDown, Minus, ExternalLink,
  PlayCircle, ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";
import { LessonRating } from "@/components/student/LessonRating";

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
  const hasExternalUrl = !!lesson.external_url;

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

      {/* ── Conteúdo principal ── */}
      {hasExternalUrl ? (
        // ── Card de redirecionamento externo (Hotmart, Kiwify etc.) ──
        <ExternalLessonCard
          externalUrl={lesson.external_url!}
          isWatched={isWatched}
        />
      ) : lesson.video_url ? (
        // ── Player de vídeo interno ──
        <div className="rounded-2xl overflow-hidden bg-black shadow-xl">
          <VideoPlayer url={lesson.video_url} />
        </div>
      ) : (
        // ── Sem vídeo ──
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-muted to-muted/50 h-64 flex items-center justify-center border border-border">
          <div className="text-center">
            <div className="h-16 w-16 rounded-2xl bg-background/80 flex items-center justify-center mx-auto mb-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Esta aula não possui vídeo</p>
          </div>
        </div>
      )}

      {/* Info da aula */}
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-foreground">{lesson.title}</h1>
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
          {hasExternalUrl && (
            <Badge variant="outline" className="text-xs gap-1">
              <ExternalLink className="h-3 w-3" />
              Aula externa
            </Badge>
          )}
          {lesson.is_free_preview && (
            <Badge variant="secondary">Preview gratuito</Badge>
          )}
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
                    <p className="text-sm text-muted-foreground">
                      Continue para a próxima aula ou pratique questões.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      {hasExternalUrl
                        ? "Você assistiu à aula na plataforma externa?"
                        : "Você assistiu a esta aula?"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Registre seu progresso para manter seu cronograma atualizado.
                    </p>
                  </div>

                  {/* Dificuldade */}
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground shrink-0">Dificuldade:</p>
                    {(["easy", "ok", "hard"] as Difficulty[]).map(d => (
                      <button
                        key={d}
                        onClick={() => setSelectedDifficulty(d === selectedDifficulty ? null : d)}
                        className={cn(
                          "flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all",
                          selectedDifficulty === d
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-ring"
                        )}
                      >
                        {d === "easy" && <><ThumbsUp className="h-3 w-3" /> Fácil</>}
                        {d === "ok" && <><Minus className="h-3 w-3" /> Ok</>}
                        {d === "hard" && <><ThumbsDown className="h-3 w-3" /> Difícil</>}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleCheckin(true, selectedDifficulty ?? undefined)}
                      disabled={checkin.isPending}
                      className="flex-1 gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {hasExternalUrl ? "Sim, assisti" : "Sim, assisti"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleCheckin(false)}
                      disabled={checkin.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Ainda não
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Material PDF */}
        {lesson.material_url && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">MATERIAL DE APOIO</p>
              <a href={lesson.material_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  Abrir PDF
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </Button>
              </a>
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
                <Sparkles className="h-4 w-4 text-primary" />
                Resumo gerado por IA
              </CardTitle>
              <button onClick={() => setShowAiSummary(v => !v)}
                className="text-xs text-primary hover:underline">
                {showAiSummary ? "Ocultar" : "Ver resumo"}
              </button>
            </div>
          </CardHeader>
          {showAiSummary && (
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

// ── Card de redirecionamento externo ──────────────────────────────────────────

function ExternalLessonCard({ externalUrl, isWatched }: { externalUrl: string; isWatched: boolean }) {
  // Detecta a plataforma pelo domínio para mostrar o nome correto
  const platform = detectPlatform(externalUrl);

  return (
    <div className={cn(
      "relative rounded-2xl overflow-hidden border-2 p-8",
      "bg-gradient-to-br from-card to-muted/30",
      isWatched ? "border-success/40" : "border-border"
    )}>
      {/* Decoração de fundo */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle at 20% 50%, hsl(var(--primary)) 0%, transparent 50%), radial-gradient(circle at 80% 50%, hsl(var(--primary)) 0%, transparent 50%)",
        }} />

      <div className="relative z-10 flex flex-col items-center text-center gap-6">
        {/* Ícone */}
        <div className="h-20 w-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <PlayCircle className="h-10 w-10 text-primary" />
        </div>

        {/* Texto */}
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-foreground">
            Esta aula está hospedada na {platform.name}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Clique no botão abaixo para assistir à aula na plataforma {platform.name}.
            Depois volte aqui para registrar seu progresso.
          </p>
        </div>

        {/* Botão principal */}
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all hover:scale-[1.02] shadow-lg shadow-primary/25"
        >
          <PlayCircle className="h-5 w-5" />
          Assistir na {platform.name}
          <ArrowUpRight className="h-4 w-4" />
        </a>

        {/* Info */}
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />
          Abre em uma nova aba
        </p>
      </div>
    </div>
  );
}

function detectPlatform(url: string): { name: string; color: string } {
  if (url.includes("hotmart")) return { name: "Hotmart", color: "#FF6B00" };
  if (url.includes("kiwify")) return { name: "Kiwify", color: "#7B2FBE" };
  if (url.includes("eduzz")) return { name: "Eduzz", color: "#0066CC" };
  if (url.includes("monetizze")) return { name: "Monetizze", color: "#00A859" };
  if (url.includes("braip")) return { name: "Braip", color: "#FF4B2B" };
  return { name: "plataforma externa", color: "hsl(var(--primary))" };
}

// ── Player de vídeo ───────────────────────────────────────────────────────────

function VideoPlayer({ url }: { url: string }) {
  const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
  const isVimeo = url.includes("vimeo.com");

  if (isYoutube) {
    let videoId = "";
    try {
      const u = new URL(url);
      if (u.hostname === "youtu.be") {
        videoId = u.pathname.slice(1).split("?")[0];
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

  return (
    <video src={url} controls className="w-full max-h-[480px]" controlsList="nodownload" />
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