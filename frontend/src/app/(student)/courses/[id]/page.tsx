// frontend/src/app/(student)/courses/[id]/page.tsx
"use client";

import { useParams } from "next/navigation";
import { useCourse } from "@/lib/hooks/useCourses";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import {
  BookOpen, Clock, CheckCircle2, Lock,
  ChevronDown, ChevronUp, Play, FileText,
  Sparkles, LayoutGrid, List, PlayCircle,
} from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";
import { useState } from "react";
import type { Subject, Module, Lesson } from "@/types/api";

// ── Persistência do layout preferido ─────────────────────────────────────────
function useLayoutPreference() {
  const [layout, setLayoutState] = useState<"list" | "netflix">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem("course_layout") as "list" | "netflix") || "list";
  });

  const setLayout = (l: "list" | "netflix") => {
    setLayoutState(l);
    localStorage.setItem("course_layout", l);
  };

  return [layout, setLayout] as const;
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: course, isLoading } = useCourse(id);
  const [layout, setLayout] = useLayoutPreference();
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const toggleSubject = (subjectId: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      next.has(subjectId) ? next.delete(subjectId) : next.add(subjectId);
      return next;
    });
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId);
      return next;
    });
  };

  if (isLoading) return <CourseDetailSkeleton />;
  if (!course) return null;

  const subjects: Subject[] = course.subjects || [];
  const totalLessons = subjects.reduce(
    (acc: number, s: Subject) => acc + (s.modules?.reduce((a, m) => a + (m.lessons?.length || 0), 0) || 0), 0
  );
  const watchedLessons = subjects.reduce(
    (acc: number, s: Subject) => acc + (s.modules?.reduce(
      (a, m) => a + (m.lessons?.filter(l => l.progress?.status === "watched").length || 0), 0
    ) || 0), 0
  );
  const progressPct = totalLessons > 0 ? Math.round((watchedLessons / totalLessons) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">

      {/* ── Header do curso ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary to-primary/70 p-6 text-white">
        <div className="relative z-10">
          <Badge className="bg-white/20 text-white border-white/30 mb-3">
            {progressPct}% concluído
          </Badge>
          <h1 className="font-display text-2xl font-bold leading-tight mb-2">{course.name}</h1>
          {course.description && (
            <p className="text-white/80 text-sm leading-relaxed max-w-xl">{course.description}</p>
          )}
          <div className="flex items-center gap-4 mt-4 text-sm text-white/70">
            <span className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              {totalLessons} aulas
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-300" />
              {watchedLessons} assistidas
            </span>
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-white transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 right-12 w-24 h-24 bg-white/5 rounded-full translate-y-1/2" />
      </div>

      {/* ── Toggle de layout ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {subjects.length} {subjects.length === 1 ? "disciplina" : "disciplinas"}
        </p>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted border border-border">
          <button
            onClick={() => setLayout("list")}
            title="Visualização em lista"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              layout === "list"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="h-3.5 w-3.5" />
            Lista
          </button>
          <button
            onClick={() => setLayout("netflix")}
            title="Visualização em cards"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              layout === "netflix"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Cards
          </button>
        </div>
      </div>

      {/* ── Conteúdo ── */}
      {layout === "list" ? (
        // ── LAYOUT LISTA (original) ──────────────────────────────────
        <div className="space-y-3">
          {subjects.map((subject, si) => (
            <SubjectAccordion
              key={subject.id}
              subject={subject}
              courseId={id}
              isExpanded={expandedSubjects.has(subject.id)}
              onToggle={() => toggleSubject(subject.id)}
              expandedModules={expandedModules}
              onToggleModule={toggleModule}
              index={si}
            />
          ))}
        </div>
      ) : (
        // ── LAYOUT NETFLIX ───────────────────────────────────────────
        <div className="space-y-10">
          {subjects.map((subject, si) => (
            <NetflixSubjectRow
              key={subject.id}
              subject={subject}
              courseId={id}
              index={si}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LAYOUT LISTA — componentes originais
// ══════════════════════════════════════════════════════════════════════════════

function SubjectAccordion({ subject, courseId, isExpanded, onToggle, expandedModules, onToggleModule, index }: {
  subject: Subject; courseId: string; isExpanded: boolean; onToggle: () => void;
  expandedModules: Set<string>; onToggleModule: (id: string) => void; index: number;
}) {
  const modules = subject.modules || [];
  const totalLessons = modules.reduce((a, m) => a + (m.lessons?.length || 0), 0);
  const watchedLessons = modules.reduce(
    (a, m) => a + (m.lessons?.filter(l => l.progress?.status === "watched").length || 0), 0
  );

  return (
    <div className={cn(
      "rounded-xl border border-border overflow-hidden bg-card animate-fade-in"
    )} style={{ animationDelay: `${index * 60}ms` }}>
      <button onClick={onToggle}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-accent/50 transition-colors">
        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: subject.color }} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm">{subject.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{watchedLessons}/{totalLessons} aulas</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <p className="text-xs font-medium text-foreground">
            {totalLessons > 0 ? Math.round((watchedLessons / totalLessons) * 100) : 0}%
          </p>
          {isExpanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border">
          {modules.map(module => (
            <ModuleAccordion key={module.id} module={module} courseId={courseId}
              isExpanded={expandedModules.has(module.id)}
              onToggle={() => onToggleModule(module.id)}
              subjectColor={subject.color} />
          ))}
        </div>
      )}
    </div>
  );
}

function ModuleAccordion({ module, courseId, isExpanded, onToggle, subjectColor }: {
  module: Module; courseId: string; isExpanded: boolean; onToggle: () => void; subjectColor: string;
}) {
  const lessons = module.lessons || [];
  const watched = lessons.filter(l => l.progress?.status === "watched").length;

  return (
    <div className="border-b border-border last:border-0">
      <button onClick={onToggle}
        className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-accent/30 transition-colors">
        <div className="h-5 w-5 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: subjectColor + "20" }}>
          <BookOpen className="h-3 w-3" style={{ color: subjectColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{module.name}</p>
          <p className="text-xs text-muted-foreground">{watched}/{lessons.length} aulas</p>
        </div>
        {isExpanded
          ? <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />}
      </button>
      {isExpanded && lessons.length > 0 && (
        <div className="pb-2">
          {lessons.map((lesson, li) => (
            <LessonRow key={lesson.id} lesson={lesson} courseId={courseId} index={li} />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonRow({ lesson, courseId, index }: { lesson: Lesson; courseId: string; index: number }) {
  const isWatched = lesson.progress?.status === "watched";
  const isLocked = !lesson.is_published && !lesson.is_free_preview;

  return (
    <Link href={isLocked ? "#" : ROUTES.LESSON(courseId, lesson.id)}
      className={cn(
        "flex items-center gap-3 px-6 py-2.5 transition-colors",
        isLocked ? "opacity-50 cursor-not-allowed" : "hover:bg-accent/50 cursor-pointer"
      )}>
      <div className="shrink-0">
        {isLocked
          ? <Lock className="h-4 w-4 text-muted-foreground" />
          : isWatched
            ? <CheckCircle2 className="h-4 w-4 text-success" />
            : <Play className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm truncate",
          isWatched ? "text-muted-foreground line-through" : "text-foreground")}>
          {index + 1}. {lesson.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {lesson.duration_minutes > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Clock className="h-3 w-3" />{lesson.duration_minutes}min
            </span>
          )}
          {lesson.material_url && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <FileText className="h-3 w-3" />Material
            </span>
          )}
          {lesson.has_ai_summary && (
            <span className="text-xs text-primary flex items-center gap-0.5">
              <Sparkles className="h-3 w-3" />Resumo IA
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LAYOUT NETFLIX — row por disciplina, cards de aulas em scroll horizontal
// ══════════════════════════════════════════════════════════════════════════════

function NetflixSubjectRow({ subject, courseId, index }: {
  subject: Subject; courseId: string; index: number;
}) {
  const modules = subject.modules || [];
  // Achata todas as aulas de todos os módulos da disciplina
  const allLessons: Array<{ lesson: Lesson; moduleName: string }> = modules.flatMap(m =>
    (m.lessons || []).map(l => ({ lesson: l, moduleName: m.name }))
  );

  const watchedCount = allLessons.filter(({ lesson }) => lesson.progress?.status === "watched").length;

  if (allLessons.length === 0) return null;

  return (
    <div className="animate-fade-in" style={{ animationDelay: `${index * 80}ms` }}>
      {/* Título da disciplina */}
      <div className="flex items-center gap-3 mb-4 px-1">
        <div className="h-4 w-1 rounded-full shrink-0" style={{ backgroundColor: subject.color }} />
        <h2 className="text-base font-bold text-foreground">{subject.name}</h2>
        <span className="text-xs text-muted-foreground ml-1">
          {watchedCount}/{allLessons.length} aulas
        </span>
        {/* Mini barra de progresso */}
        <div className="flex-1 max-w-[120px] h-1 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${allLessons.length > 0 ? Math.round((watchedCount / allLessons.length) * 100) : 0}%`,
              backgroundColor: subject.color,
            }}
          />
        </div>
      </div>

      {/* Row de cards em scroll horizontal */}
      <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {allLessons.map(({ lesson, moduleName }, li) => (
          <NetflixLessonCard
            key={lesson.id}
            lesson={lesson}
            courseId={courseId}
            index={li}
            moduleName={moduleName}
            subjectColor={subject.color}
          />
        ))}
      </div>
    </div>
  );
}

function NetflixLessonCard({ lesson, courseId, index, moduleName, subjectColor }: {
  lesson: Lesson; courseId: string; index: number; moduleName: string; subjectColor: string;
}) {
  const isWatched = lesson.progress?.status === "watched";
  const isLocked = !lesson.is_published && !lesson.is_free_preview;
  const progressPct = lesson.progress?.watch_percentage
    ? Math.round(lesson.progress.watch_percentage * 100)
    : isWatched ? 100 : 0;

  return (
    <Link
      href={isLocked ? "#" : ROUTES.LESSON(courseId, lesson.id)}
      className={cn(
        "group flex-none w-52 rounded-xl overflow-hidden border border-border bg-card",
        "transition-all duration-200",
        isLocked
          ? "opacity-50 cursor-not-allowed"
          : "hover:scale-[1.03] hover:shadow-lg hover:shadow-black/20 hover:border-primary/50 cursor-pointer"
      )}
    >
      {/* Thumbnail / área visual */}
      <div className="relative h-28 flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${subjectColor}22, ${subjectColor}44)` }}>

        {/* Número da aula */}
        <span className="absolute top-2 left-2.5 text-[10px] font-bold text-white/60 bg-black/30 px-1.5 py-0.5 rounded">
          #{index + 1}
        </span>

        {/* Badge de status */}
        {isWatched && (
          <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-black/40 px-1.5 py-0.5 rounded">
            <CheckCircle2 className="h-2.5 w-2.5" />Assistida
          </span>
        )}
        {isLocked && (
          <span className="absolute top-2 right-2">
            <Lock className="h-3.5 w-3.5 text-white/50" />
          </span>
        )}

        {/* Ícone central */}
        {isLocked ? (
          <Lock className="h-8 w-8 text-white/20" />
        ) : (
          <div className={cn(
            "h-12 w-12 rounded-full flex items-center justify-center transition-all duration-200",
            "bg-black/30 border border-white/10",
            !isLocked && "group-hover:scale-110 group-hover:bg-primary group-hover:border-primary"
          )}>
            <PlayCircle className={cn(
              "h-7 w-7 transition-colors",
              isWatched ? "text-emerald-400" : "text-white/70 group-hover:text-white"
            )} />
          </div>
        )}

        {/* Barra de progresso na parte inferior */}
        {progressPct > 0 && progressPct < 100 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
        {isWatched && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <p className={cn(
          "text-xs font-semibold leading-tight line-clamp-2",
          isWatched ? "text-muted-foreground" : "text-foreground"
        )}>
          {lesson.title}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{moduleName}</p>

        {/* Meta */}
        <div className="flex items-center gap-2 pt-0.5">
          {lesson.duration_minutes > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />{lesson.duration_minutes}min
            </span>
          )}
          {lesson.material_url && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <FileText className="h-2.5 w-2.5" />PDF
            </span>
          )}
          {lesson.has_ai_summary && (
            <span className="text-[10px] text-primary flex items-center gap-0.5">
              <Sparkles className="h-2.5 w-2.5" />IA
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CourseDetailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse max-w-5xl">
      <Skeleton className="h-40 rounded-2xl" />
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-36 rounded-lg" />
      </div>
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}