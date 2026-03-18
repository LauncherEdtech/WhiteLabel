// frontend/src/app/(student)/courses/[id]/page.tsx
"use client";

import { useParams } from "next/navigation";
import { useCourse } from "@/lib/hooks/useCourses";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import {
  BookOpen, Clock, CheckCircle2, Lock,
  ChevronDown, ChevronUp, Play, FileText,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";
import { useState } from "react";
import type { Subject, Module, Lesson } from "@/types/api";

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: course, isLoading } = useCourse(id);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const toggleSubject = (subjectId: string) => {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      next.has(subjectId) ? next.delete(subjectId) : next.add(subjectId);
      return next;
    });
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId);
      return next;
    });
  };

  if (isLoading) return <CourseDetailSkeleton />;
  if (!course) return null;

  const subjects: Subject[] = course.subjects || [];
  const totalLessons = subjects.reduce(
    (acc: number, s: Subject) =>
      acc + (s.modules?.reduce((a, m) => a + (m.lessons?.length || 0), 0) || 0),
    0
  );
  const watchedLessons = subjects.reduce(
    (acc: number, s: Subject) =>
      acc +
      (s.modules?.reduce(
        (a, m) =>
          a +
          (m.lessons?.filter((l) => l.progress?.status === "watched").length || 0),
        0
      ) || 0),
    0
  );
  const progressPct = totalLessons > 0 ? Math.round((watchedLessons / totalLessons) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header do curso */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary to-primary/70 p-6 text-white">
        <div className="relative z-10">
          <Badge className="bg-white/20 text-white border-white/30 mb-3">
            {progressPct}% concluído
          </Badge>
          <h1 className="font-display text-2xl font-bold leading-tight mb-2">
            {course.name}
          </h1>
          {course.description && (
            <p className="text-white/80 text-sm leading-relaxed max-w-xl">
              {course.description}
            </p>
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
          {/* Barra de progresso */}
          <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-white transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        {/* Decoração */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 right-12 w-24 h-24 bg-white/5 rounded-full translate-y-1/2" />
      </div>

      {/* Árvore de conteúdo */}
      <div className="space-y-3">
        {subjects.map((subject: Subject, si: number) => (
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
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function SubjectAccordion({
  subject, courseId, isExpanded, onToggle,
  expandedModules, onToggleModule, index,
}: {
  subject: Subject;
  courseId: string;
  isExpanded: boolean;
  onToggle: () => void;
  expandedModules: Set<string>;
  onToggleModule: (id: string) => void;
  index: number;
}) {
  const modules = subject.modules || [];
  const totalLessons = modules.reduce((a, m) => a + (m.lessons?.length || 0), 0);
  const watchedLessons = modules.reduce(
    (a, m) => a + (m.lessons?.filter((l) => l.progress?.status === "watched").length || 0),
    0
  );

  return (
    <Card className="overflow-hidden animate-fade-in" style={{ animationDelay: `${index * 60}ms` }}>
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-accent/50 transition-colors"
      >
        <div
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: subject.color }}
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm">{subject.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {watchedLessons}/{totalLessons} aulas
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-xs font-medium text-foreground">
              {totalLessons > 0 ? Math.round((watchedLessons / totalLessons) * 100) : 0}%
            </p>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border">
          {modules.map((module: Module) => (
            <ModuleAccordion
              key={module.id}
              module={module}
              courseId={courseId}
              isExpanded={expandedModules.has(module.id)}
              onToggle={() => onToggleModule(module.id)}
              subjectColor={subject.color}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function ModuleAccordion({
  module, courseId, isExpanded, onToggle, subjectColor,
}: {
  module: Module;
  courseId: string;
  isExpanded: boolean;
  onToggle: () => void;
  subjectColor: string;
}) {
  const lessons = module.lessons || [];
  const watched = lessons.filter((l) => l.progress?.status === "watched").length;

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={onToggle}
        className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-accent/30 transition-colors"
      >
        <div className="h-5 w-5 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: subjectColor + "20" }}>
          <BookOpen className="h-3 w-3" style={{ color: subjectColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{module.name}</p>
          <p className="text-xs text-muted-foreground">{watched}/{lessons.length} aulas</p>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
      </button>

      {isExpanded && lessons.length > 0 && (
        <div className="pb-2">
          {lessons.map((lesson: Lesson, li: number) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              courseId={courseId}
              index={li}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonRow({
  lesson, courseId, index,
}: {
  lesson: Lesson;
  courseId: string;
  index: number;
}) {
  const isWatched = lesson.progress?.status === "watched";
  const isLocked = !lesson.is_published && !lesson.is_free_preview;

  return (
    <Link
      href={isLocked ? "#" : ROUTES.LESSON(courseId, lesson.id)}
      className={cn(
        "flex items-center gap-3 px-6 py-2.5 transition-colors",
        isLocked
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-accent/50 cursor-pointer"
      )}
    >
      {/* Status icon */}
      <div className="shrink-0">
        {isLocked ? (
          <Lock className="h-4 w-4 text-muted-foreground" />
        ) : isWatched ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <Play className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm truncate",
          isWatched ? "text-muted-foreground line-through" : "text-foreground"
        )}>
          {index + 1}. {lesson.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {lesson.duration_minutes > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {lesson.duration_minutes}min
            </span>
          )}
          {lesson.material_url && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <FileText className="h-3 w-3" />
              Material
            </span>
          )}
          {lesson.has_ai_summary && (
            <span className="text-xs text-primary flex items-center gap-0.5">
              <Sparkles className="h-3 w-3" />
              Resumo IA
            </span>
          )}
          {lesson.is_free_preview && !lesson.is_published && (
            <Badge variant="secondary" className="text-xs py-0">Preview</Badge>
          )}
        </div>
      </div>
    </Link>
  );
}

function CourseDetailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse max-w-4xl">
      <Skeleton className="h-40 rounded-2xl" />
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}