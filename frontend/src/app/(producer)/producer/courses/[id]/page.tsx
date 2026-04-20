"use client";
// frontend/src/app/(producer)/producer/courses/[id]/page.tsx

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils/cn";
import {
  BookOpen, Plus, ChevronDown, ChevronUp, ChevronLeft,
  Pencil, Eye, EyeOff, GripVertical, Video, Clock, Trash2, FileText, CheckCircle2,
  ExternalLink, Sparkles, BookOpenCheck, CheckCheck, X as XIcon, Calendar,
} from "lucide-react";
import Link from "next/link";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";
import { PdfUploader } from "@/components/producer/PdfUploader";
import { VideoUploader } from "@/components/producer/VideoUploader";
import { useTenantFeatures } from "@/lib/hooks/useTenantFeatures";

type EditSubjectState = { open: boolean; subject: any | null };
type EditModuleState = { open: boolean; module: any | null };
type EditLessonState = { open: boolean; lesson: any | null };
type LessonQuestionsState = { open: boolean; lessonId: string; lessonTitle: string };
type ConfirmDelete = { open: boolean; type: "subject" | "module" | "lesson"; id: string; name: string; parentCount?: number } | null;

type LessonModalState = {
  open: boolean;
  moduleId: string;
  createdLessonId?: string;
  createdTitle?: string;
};

export default function ProducerCourseDetailPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const { data: features } = useTenantFeatures();
  const hasVideoHosting = features?.video_hosting ?? false;
  const toast = useToast();
  const queryClient = useQueryClient();

  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const [subjectModal, setSubjectModal] = useState(false);
  const [moduleModal, setModuleModal] = useState<{ open: boolean; subjectId: string }>({ open: false, subjectId: "" });
  const [lessonModal, setLessonModal] = useState<LessonModalState>({ open: false, moduleId: "" });

  const [editSubject, setEditSubject] = useState<EditSubjectState>({ open: false, subject: null });
  const [editModule, setEditModule] = useState<EditModuleState>({ open: false, module: null });
  const [editLesson, setEditLesson] = useState<EditLessonState>({ open: false, lesson: null });
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDelete>(null);
  const [lessonQuestionsModal, setLessonQuestionsModal] = useState<LessonQuestionsState>({ open: false, lessonId: "", lessonTitle: "" });

  const { data: course, isLoading } = useQuery({
    queryKey: QUERY_KEYS.COURSE(courseId),
    queryFn: () => apiClient.get(`/courses/${courseId}`).then(r => r.data.course),
  });

  // ── Mutations: criar ────────────────────────────────────────────────────────

  const createSubject = useMutation({
    mutationFn: (d: { name: string; color: string; edital_weight: number }) =>
      apiClient.post(`/courses/${courseId}/subjects`, d).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) });
      toast.success("Disciplina criada!");
      setSubjectModal(false);
    },
  });

  const createModule = useMutation({
    mutationFn: ({ subjectId, name }: { subjectId: string; name: string }) =>
      apiClient.post(`/courses/subjects/${subjectId}/modules`, { name, order: 0 }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) });
      toast.success("Módulo criado!");
      setModuleModal({ open: false, subjectId: "" });
    },
  });

  const createLesson = useMutation({
    mutationFn: (d: { moduleId: string; title: string; duration_minutes: number; video_url: string; is_free_preview?: boolean; external_url?: string | null }) =>
      apiClient.post(`/courses/modules/${d.moduleId}/lessons`, {
        title: d.title,
        duration_minutes: d.duration_minutes,
        video_url: d.video_url || null,
        external_url: d.external_url || null,
        order: 0,
        is_published: false,
        is_free_preview: d.is_free_preview ?? false,
      }).then(r => r.data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) });
      if (data?.lesson?.id) {
        setLessonModal({
          open: true,
          moduleId: variables.moduleId,
          createdLessonId: data.lesson.id,
          createdTitle: data.lesson.title,
        });
      } else {
        setLessonModal({ open: false, moduleId: "" });
        toast.success("Aula criada!");
      }
    },
  });

  // ── Mutations: editar ───────────────────────────────────────────────────────

  const updateSubject = useMutation({
    mutationFn: ({ subjectId, data }: { subjectId: string; data: any }) =>
      apiClient.put(`/courses/${courseId}/subjects/${subjectId}`, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) });
      toast.success("Disciplina atualizada!");
      setEditSubject({ open: false, subject: null });
    },
    onError: () => toast.error("Erro ao atualizar disciplina"),
  });

  const updateModule = useMutation({
    mutationFn: ({ moduleId, name }: { moduleId: string; name: string }) =>
      apiClient.put(`/courses/modules/${moduleId}`, { name, order: 0 }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) });
      toast.success("Módulo atualizado!");
      setEditModule({ open: false, module: null });
    },
    onError: () => toast.error("Erro ao atualizar módulo"),
  });

  const updateLesson = useMutation({
    mutationFn: ({ lessonId, data }: { lessonId: string; data: any }) =>
      apiClient.put(`/courses/lessons/${lessonId}`, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) });
      toast.success("Aula atualizada!");
      setEditLesson({ open: false, lesson: null });
    },
    onError: () => toast.error("Erro ao atualizar aula"),
  });

  const toggleLesson = useMutation({
    mutationFn: ({ lessonId, is_published, title, video_url, duration_minutes, order, is_free_preview }: {
      lessonId: string; is_published: boolean; title: string;
      video_url?: string | null; duration_minutes?: number; order?: number; is_free_preview?: boolean;
    }) =>
      apiClient.put(`/courses/lessons/${lessonId}`, {
        title, is_published,
        video_url: video_url ?? null,
        duration_minutes: duration_minutes ?? 0,
        order: order ?? 0,
        is_free_preview: is_free_preview ?? false,
      }).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) }),
  });

  const reorderLessons = useMutation({
    mutationFn: ({ moduleId, orderedIds }: { moduleId: string; orderedIds: string[] }) =>
      apiClient
        .put(`/courses/modules/${moduleId}/lessons/reorder`, { ordered_ids: orderedIds })
        .then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) }),
    onError: () => toast.error("Erro ao reordenar aulas"),
  });

  // ── Mutations: IA + excluir ─────────────────────────────────────────────────

  const generateLessonQuestions = useMutation({
    mutationFn: ({ lessonId, count, difficulty }: { lessonId: string; count: number; difficulty: string }) =>
      apiClient.post(`/courses/lessons/${lessonId}/questions/generate`, { count, difficulty }).then(r => r.data),
    onSuccess: (data) => {
      toast.success(`Gerando ${data.count_requested} questão(ões)... Aguarde ~20s.`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || "Erro ao iniciar geração";
      toast.error(msg);
    },
  });

  const approveLessonQuestion = useMutation({
    mutationFn: ({ lessonId, questionId }: { lessonId: string; questionId: string }) =>
      apiClient.post(`/courses/lessons/${lessonId}/questions/${questionId}/approve`).then(r => r.data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["lesson-questions", vars.lessonId] });
      toast.success("Questão aprovada — alunos já podem ver.");
    },
    onError: () => toast.error("Erro ao aprovar questão"),
  });

  const deleteLessonQuestion = useMutation({
    mutationFn: ({ lessonId, questionId }: { lessonId: string; questionId: string }) =>
      apiClient.delete(`/courses/lessons/${lessonId}/questions/${questionId}`).then(r => r.data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["lesson-questions", vars.lessonId] });
      toast.success("Questão removida.");
    },
    onError: () => toast.error("Erro ao remover questão"),
  });

  const deleteSubject = useMutation({
    mutationFn: (subjectId: string) =>
      apiClient.delete(`/courses/${courseId}/subjects/${subjectId}`).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) });
      toast.success("Disciplina removida!", data.message);
      setConfirmDelete(null);
    },
    onError: () => toast.error("Erro ao remover disciplina"),
  });

  const deleteModule = useMutation({
    mutationFn: (moduleId: string) =>
      apiClient.delete(`/courses/modules/${moduleId}`).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) });
      toast.success("Módulo removido!", data.message);
      setConfirmDelete(null);
    },
    onError: () => toast.error("Erro ao remover módulo"),
  });

  const deleteLesson = useMutation({
    mutationFn: (lessonId: string) =>
      apiClient.delete(`/courses/lessons/${lessonId}`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) });
      toast.success("Aula removida!");
      setConfirmDelete(null);
    },
    onError: () => toast.error("Erro ao remover aula"),
  });

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === "subject") deleteSubject.mutate(confirmDelete.id);
    else if (confirmDelete.type === "module") deleteModule.mutate(confirmDelete.id);
    else deleteLesson.mutate(confirmDelete.id);
  };

  const moveLessonInModule = (module: any, lessonId: string, direction: "up" | "down") => {
    const lessons: any[] = [...(module.lessons || [])].sort((a, b) => a.order - b.order);
    const idx = lessons.findIndex(l => l.id === lessonId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === lessons.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [lessons[idx], lessons[swapIdx]] = [lessons[swapIdx], lessons[idx]];

    reorderLessons.mutate({
      moduleId: module.id,
      orderedIds: lessons.map(l => l.id),
    });
  };

  if (isLoading) return <Skeleton className="h-64 rounded-xl animate-pulse" />;
  if (!course) return null;

  const subjects = course.subjects || [];
  const isDeleting = deleteModule.isPending || deleteLesson.isPending || deleteSubject.isPending;

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/producer/courses">
            <Button variant="ghost" size="sm"><ChevronLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold text-foreground">{course.name}</h1>
              <Badge variant={course.is_active ? "success" : "outline"}>
                {course.is_active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">Gerencie o conteúdo do curso</p>
          </div>
        </div>

        {/* Ações do header */}
        <div className="flex items-center gap-2">
          {/* ── NOVO: botão de cronograma do produtor ── */}
          <Link href={`/producer/courses/${courseId}/schedule`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Cronograma
            </Button>
          </Link>

          <Link href={`/producer/courses/${courseId}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-3.5 w-3.5 mr-1.5" />Editar Curso
            </Button>
          </Link>
          <Button onClick={() => setSubjectModal(true)}>
            <Plus className="h-4 w-4 mr-1" />Disciplina
          </Button>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Disciplinas", value: subjects.length },
          { label: "Módulos", value: subjects.reduce((a: number, s: any) => a + (s.modules?.length || 0), 0) },
          { label: "Aulas", value: subjects.reduce((a: number, s: any) => a + s.modules?.reduce((b: number, m: any) => b + (m.lessons?.length || 0), 0), 0) },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-3 text-center">
              <p className="font-display text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Árvore de conteúdo ─────────────────────────────────────────────── */}
      {subjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-foreground">Nenhuma disciplina ainda</p>
            <p className="text-sm text-muted-foreground mt-1">Adicione disciplinas para organizar o conteúdo.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {subjects.map((subject: any) => (
            <Card key={subject.id} className="overflow-hidden">
              {/* Disciplina */}
              <div className="w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors">
                <div role="button" tabIndex={0}
                  onClick={() => setExpandedSubjects(prev => {
                    const next = new Set(prev);
                    next.has(subject.id) ? next.delete(subject.id) : next.add(subject.id);
                    return next;
                  })}
                  className="flex items-center gap-3 flex-1 cursor-pointer"
                >
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: subject.color }} />
                  <span className="flex-1 font-semibold text-foreground">{subject.name}</span>
                  <Badge variant="outline" className="text-xs">peso {subject.edital_weight}x</Badge>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditSubject({ open: true, subject })}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="hover:text-destructive"
                    onClick={() => setConfirmDelete({ open: true, type: "subject", id: subject.id, name: subject.name, parentCount: subject.modules?.length || 0 })}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon-sm"
                    onClick={() => setModuleModal({ open: true, subjectId: subject.id })}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  {expandedSubjects.has(subject.id)
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground cursor-pointer" onClick={() => setExpandedSubjects(prev => { const n = new Set(prev); n.delete(subject.id); return n; })} />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground cursor-pointer" onClick={() => setExpandedSubjects(prev => new Set([...prev, subject.id]))} />
                  }
                </div>
              </div>

              {expandedSubjects.has(subject.id) && (
                <div className="border-t border-border">
                  {(subject.modules || []).length === 0 && (
                    <p className="px-5 py-3 text-xs text-muted-foreground italic">Nenhum módulo. Clique em + para adicionar.</p>
                  )}
                  {(subject.modules || []).map((module: any) => (
                    <div key={module.id} className="border-b border-border last:border-0">
                      {/* Módulo */}
                      <div className="w-full px-5 py-3 flex items-center gap-3 hover:bg-accent/30 transition-colors group">
                        <div role="button" tabIndex={0}
                          onClick={() => setExpandedModules(prev => {
                            const next = new Set(prev);
                            next.has(module.id) ? next.delete(module.id) : next.add(module.id);
                            return next;
                          })}
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="flex-1 text-sm font-medium text-foreground">{module.name}</span>
                          <span className="text-xs text-muted-foreground">{module.lessons?.length || 0} aulas</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditModule({ open: true, module })}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="hover:text-destructive"
                            onClick={() => setConfirmDelete({ open: true, type: "module", id: module.id, name: module.name, parentCount: module.lessons?.length || 0 })}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon-sm"
                            onClick={() => setLessonModal({ open: true, moduleId: module.id })}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          {expandedModules.has(module.id)
                            ? <ChevronUp className="h-3 w-3 text-muted-foreground cursor-pointer" onClick={() => setExpandedModules(prev => { const n = new Set(prev); n.delete(module.id); return n; })} />
                            : <ChevronDown className="h-3 w-3 text-muted-foreground cursor-pointer" onClick={() => setExpandedModules(prev => new Set([...prev, module.id]))} />
                          }
                        </div>
                      </div>

                      {expandedModules.has(module.id) && (
                        <div className="pb-2 bg-muted/20">
                          {(module.lessons || []).length === 0 && (
                            <p className="px-8 py-2 text-xs text-muted-foreground italic">Nenhuma aula. Clique em + para adicionar.</p>
                          )}
                          {(module.lessons || [])
                            .slice()
                            .sort((a: any, b: any) => a.order - b.order)
                            .map((lesson: any, li: number, arr: any[]) => (
                              <div
                                key={lesson.id}
                                draggable
                                onDragStart={e => {
                                  e.dataTransfer.setData("lessonId", lesson.id);
                                  e.dataTransfer.setData("moduleId", module.id);
                                  (e.currentTarget as HTMLElement).style.opacity = "0.4";
                                }}
                                onDragEnd={e => {
                                  (e.currentTarget as HTMLElement).style.opacity = "1";
                                }}
                                onDragOver={e => {
                                  e.preventDefault();
                                  (e.currentTarget as HTMLElement).style.borderTop = "2px solid var(--primary)";
                                }}
                                onDragLeave={e => {
                                  (e.currentTarget as HTMLElement).style.borderTop = "";
                                }}
                                onDrop={e => {
                                  e.preventDefault();
                                  (e.currentTarget as HTMLElement).style.borderTop = "";
                                  const draggedId = e.dataTransfer.getData("lessonId");
                                  const draggedModuleId = e.dataTransfer.getData("moduleId");
                                  if (draggedId === lesson.id || draggedModuleId !== module.id) return;

                                  const sorted = [...arr];
                                  const fromIdx = sorted.findIndex(l => l.id === draggedId);
                                  const toIdx = sorted.findIndex(l => l.id === lesson.id);
                                  sorted.splice(toIdx, 0, sorted.splice(fromIdx, 1)[0]);

                                  reorderLessons.mutate({
                                    moduleId: module.id,
                                    orderedIds: sorted.map(l => l.id),
                                  });
                                }}
                                className="flex items-center gap-3 px-8 py-2 hover:bg-accent/20 transition-colors group cursor-grab active:cursor-grabbing"
                              >
                                {/* ícone de drag — sempre visível */}
                                <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                                <Video className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="flex-1 text-xs text-foreground truncate">{li + 1}. {lesson.title}</span>

                                {/* ↑↓ ainda disponíveis para quem preferir */}
                                <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <button
                                    onClick={() => moveLessonInModule(module, lesson.id, "up")}
                                    disabled={li === 0 || reorderLessons.isPending}
                                    title="Mover para cima"
                                    className="disabled:opacity-20 hover:text-foreground text-muted-foreground"
                                  >
                                    <ChevronUp className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => moveLessonInModule(module, lesson.id, "down")}
                                    disabled={li === arr.length - 1 || reorderLessons.isPending}
                                    title="Mover para baixo"
                                    className="disabled:opacity-20 hover:text-foreground text-muted-foreground"
                                  >
                                    <ChevronDown className="h-3 w-3" />
                                  </button>
                                </div>

                                {lesson.materials?.length > 0 && (
                                  <span title={`${lesson.materials.length} PDF(s)`}>
                                    <FileText className="h-3 w-3 text-destructive shrink-0" />
                                  </span>
                                )}
                                {lesson.external_url && (
                                  <span title="Aula externa">
                                    <ExternalLink className="h-3 w-3 text-orange-500 shrink-0" />
                                  </span>
                                )}
                                {lesson.duration_minutes > 0 && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                    <Clock className="h-3 w-3" />{lesson.duration_minutes}min
                                  </span>
                                )}
                                <button onClick={() => setEditLesson({ open: true, lesson })} title="Editar aula"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                </button>
                                <button onClick={() => setConfirmDelete({ open: true, type: "lesson", id: lesson.id, name: lesson.title })}
                                  title="Excluir aula" className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                </button>
                                <button onClick={() => toggleLesson.mutate({
                                  lessonId: lesson.id, title: lesson.title, is_published: !lesson.is_published,
                                  video_url: lesson.video_url, duration_minutes: lesson.duration_minutes,
                                  order: lesson.order ?? 0, is_free_preview: lesson.is_free_preview ?? false,
                                })} title={lesson.is_published ? "Despublicar" : "Publicar"} className="shrink-0">
                                  {lesson.is_published
                                    ? <Eye className="h-3.5 w-3.5 text-success" />
                                    : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                                  }
                                </button>
                                <button
                                  onClick={() => setLessonQuestionsModal({ open: true, lessonId: lesson.id, lessonTitle: lesson.title })}
                                  title="Questões da aula com IA"
                                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Sparkles className="h-3.5 w-3.5 text-purple-500 hover:text-purple-700" />
                                </button>
                              </div>
                            ))
                          }
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* ── Modal: Questões da Aula com IA ──────────────────────────────────── */}
      <LessonQuestionsModal
        open={lessonQuestionsModal.open}
        lessonId={lessonQuestionsModal.lessonId}
        lessonTitle={lessonQuestionsModal.lessonTitle}
        onClose={() => setLessonQuestionsModal({ open: false, lessonId: "", lessonTitle: "" })}
        onGenerate={(count, difficulty) => generateLessonQuestions.mutate({ lessonId: lessonQuestionsModal.lessonId, count, difficulty })}
        onApprove={(questionId) => approveLessonQuestion.mutate({ lessonId: lessonQuestionsModal.lessonId, questionId })}
        onDelete={(questionId) => deleteLessonQuestion.mutate({ lessonId: lessonQuestionsModal.lessonId, questionId })}
        isGenerating={generateLessonQuestions.isPending}
      />

      {/* ── Modal: Confirmação de exclusão ──────────────────────────────────── */}
      <Dialog open={!!confirmDelete?.open} onOpenChange={v => { if (!v) setConfirmDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />Confirmar exclusão
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              Tem certeza que deseja excluir{" "}
              <strong>{confirmDelete?.type === "subject" ? "a disciplina" : confirmDelete?.type === "module" ? "o módulo" : "a aula"} "{confirmDelete?.name}"</strong>?
            </p>
            {confirmDelete?.type === "module" && (confirmDelete.parentCount || 0) > 0 && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-xs text-destructive font-medium">⚠ Este módulo contém {confirmDelete.parentCount} aula(s) que também serão removidas.</p>
              </div>
            )}
            {confirmDelete?.type === "subject" && (confirmDelete.parentCount || 0) > 0 && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-xs text-destructive font-medium">⚠ Esta disciplina contém {confirmDelete.parentCount} módulo(s) com todas as suas aulas que também serão removidos.</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Esta ação não pode ser desfeita.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? "Removendo..." : "Sim, excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modais: Criar ───────────────────────────────────────────────────── */}
      <SubjectModal open={subjectModal} title="Nova Disciplina"
        onClose={() => setSubjectModal(false)}
        onSubmit={d => createSubject.mutate(d)}
        loading={createSubject.isPending} />

      <SimpleModal open={moduleModal.open} title="Novo Módulo" placeholder="Nome do módulo"
        onClose={() => setModuleModal({ open: false, subjectId: "" })}
        onSubmit={name => createModule.mutate({ subjectId: moduleModal.subjectId, name })}
        loading={createModule.isPending} />

      <CreateLessonModal
        open={lessonModal.open}
        createdLessonId={lessonModal.createdLessonId}
        createdTitle={lessonModal.createdTitle}
        loading={createLesson.isPending}
        hasVideoHosting={hasVideoHosting}
        onClose={() => {
          setLessonModal({ open: false, moduleId: "" });
          if (lessonModal.createdLessonId) toast.success("Aula criada com sucesso!");
        }}
        onSubmit={d => createLesson.mutate({ ...d, moduleId: lessonModal.moduleId })}
        onPdfUploaded={() => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) });
          // não fecha — usuário clica "Concluir" quando quiser
        }}
        onVideoSaved={() => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) })}
      />

      {/* ── Modais: Editar ──────────────────────────────────────────────────── */}
      <SubjectModal open={editSubject.open} title="Editar Disciplina"
        initialData={editSubject.subject ? { name: editSubject.subject.name, color: editSubject.subject.color, edital_weight: editSubject.subject.edital_weight } : undefined}
        onClose={() => setEditSubject({ open: false, subject: null })}
        onSubmit={d => updateSubject.mutate({ subjectId: editSubject.subject!.id, data: d })}
        loading={updateSubject.isPending} />

      <SimpleModal open={editModule.open} title="Editar Módulo" placeholder="Nome do módulo"
        initialValue={editModule.module?.name}
        onClose={() => setEditModule({ open: false, module: null })}
        onSubmit={name => updateModule.mutate({ moduleId: editModule.module!.id, name })}
        loading={updateModule.isPending} />

      <LessonModal
        open={editLesson.open}
        title={editLesson.lesson?.title ? `Editar: ${editLesson.lesson.title}` : "Editar Aula"}
        lessonId={editLesson.lesson?.id}
        hasVideoHosting={hasVideoHosting}
        initialData={editLesson.lesson ? {
          title: editLesson.lesson.title,
          duration_minutes: editLesson.lesson.duration_minutes,
          video_url: editLesson.lesson.video_url || "",
          is_free_preview: editLesson.lesson.is_free_preview,
          material_url: editLesson.lesson.material_url,
          materials: editLesson.lesson.materials ?? [],
          external_url: editLesson.lesson.external_url || "",
          video_hosted: editLesson.lesson.video_hosted,
        } : undefined}
        onClose={() => setEditLesson({ open: false, lesson: null })}
        onSubmit={d => updateLesson.mutate({
          lessonId: editLesson.lesson!.id,
          data: {
            title: d.title,
            duration_minutes: d.duration_minutes,
            video_url: d.video_url || null,
            external_url: d.external_url || null,
            is_published: editLesson.lesson!.is_published,
            order: editLesson.lesson!.order ?? 0,
            is_free_preview: d.is_free_preview ?? false,
          },
        })}
        onVideoSaved={() => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) })}
        onMaterialSaved={(updatedMaterials) => {           // ← novo
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) });
          setEditLesson(prev => prev.lesson
            ? { ...prev, lesson: { ...prev.lesson, materials: updatedMaterials } }
            : prev
          );
        }}
        loading={updateLesson.isPending}
      />
    </div>
  );
}

// ── Modal criar aula (dois modos: form → PDF) ─────────────────────────────────

function CreateLessonModal({ open, createdLessonId, createdTitle, loading, hasVideoHosting, onClose, onSubmit, onPdfUploaded, onVideoSaved }: {
  open: boolean;
  createdLessonId?: string;
  createdTitle?: string;
  loading: boolean;
  hasVideoHosting: boolean;
  onClose: () => void;
  onSubmit: (d: { title: string; duration_minutes: number; video_url: string; is_free_preview?: boolean; external_url?: string | null }) => void;
  onPdfUploaded: () => void;
  onVideoSaved: () => void;
}) {
  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: { title: "", duration_minutes: 30, video_url: "", external_url: "", is_free_preview: false },
  });

  const handleClose = () => { onClose(); reset(); };
  const externalUrl = watch("external_url");
  const videoUrl = watch("video_url");

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {createdLessonId ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Aula criada!
              </span>
            ) : "Nova Aula"}
          </DialogTitle>
        </DialogHeader>

        {!createdLessonId && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Título</label>
              <Input {...register("title", { required: true })} placeholder="Ex: Introdução ao tema" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Duração (minutos)</label>
              <Input {...register("duration_minutes", { valueAsNumber: true })} type="number" min="0" />
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Conteúdo</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">URL do vídeo</label>
              <Input {...register("video_url")} placeholder="YouTube, Vimeo ou link direto"
                disabled={!!externalUrl} className={externalUrl ? "opacity-50" : ""} />
              <p className="text-[10px] text-muted-foreground">Para vídeos no YouTube, Vimeo ou S3.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex-1 h-px bg-border" /><span className="uppercase font-medium">ou</span><div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                URL externa
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-normal">Hotmart / Kiwify</span>
              </label>
              <Input {...register("external_url")} placeholder="https://go.hotmart.com/..."
                disabled={!!videoUrl} className={videoUrl ? "opacity-50" : ""} />
              <p className="text-[10px] text-muted-foreground">O aluno verá um botão para acessar na plataforma externa.</p>
            </div>
            {!!externalUrl && !!videoUrl && (
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-xs text-warning">
                ⚠️ Preencha apenas um. Quando ambos preenchidos, a URL externa tem prioridade.
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register("is_free_preview")} className="rounded" />
              <span className="text-sm text-foreground">Aula gratuita (preview)</span>
            </label>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={handleClose}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading ? "Criando..." : "Criar Aula"}</Button>
            </DialogFooter>
          </form>
        )}

        {createdLessonId && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">"{createdTitle}"</strong> foi criada.
              Adicione conteúdo opcional abaixo.
            </p>
            {hasVideoHosting && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Vídeo hospedado (opcional)</label>
                <VideoUploader lessonId={createdLessonId} isHosted={false} onSaved={onVideoSaved} />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Material de Apoio (PDF)</label>
              <PdfUploader lessonId={createdLessonId} currentUrl={null} materials={[]}
                onUploaded={(url) => { if (url) onPdfUploaded(); }} />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>Pular por agora</Button>
              <Button onClick={handleClose}>Concluir</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Modais auxiliares ─────────────────────────────────────────────────────────

const COLORS = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#06B6D4", "#374151"];

function SubjectModal({ open, title, initialData, onClose, onSubmit, loading }: {
  open: boolean; title: string;
  initialData?: { name: string; color: string; edital_weight: number };
  onClose: () => void;
  onSubmit: (d: { name: string; color: string; edital_weight: number }) => void;
  loading: boolean;
}) {
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { name: initialData?.name || "", edital_weight: initialData?.edital_weight || 1 },
  });
  const [color, setColor] = useState(initialData?.color || "#4F46E5");
  const handleClose = () => { onClose(); reset(); };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(d => onSubmit({ ...d, color }))} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Nome</label>
            <Input {...register("name", { required: true })} placeholder="Ex: Direito Penal" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-lg border-2 transition-all"
                  style={{ backgroundColor: c, borderColor: color === c ? "white" : "transparent", boxShadow: color === c ? `0 0 0 2px ${c}` : "none" }} />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Peso no edital</label>
            <Input {...register("edital_weight", { valueAsNumber: true })} type="number" step="0.1" min="0.1" max="10" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SimpleModal({ open, onClose, title, placeholder, initialValue, onSubmit, loading }: {
  open: boolean; onClose: () => void; title: string; placeholder: string;
  initialValue?: string;
  onSubmit: (name: string) => void; loading: boolean;
}) {
  const { register, handleSubmit, reset } = useForm<{ name: string }>({
    defaultValues: { name: initialValue || "" },
  });
  const handleClose = () => { onClose(); reset(); };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(d => onSubmit(d.name))} className="space-y-4">
          <Input {...register("name", { required: true })} placeholder={placeholder} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LessonModal({ open, title, initialData, lessonId, hasVideoHosting, onClose, onSubmit, onVideoSaved, onMaterialSaved, loading }: {
  open: boolean; title: string; lessonId?: string; hasVideoHosting: boolean;
  initialData?: {
    title: string; duration_minutes: number; video_url: string;
    is_free_preview?: boolean; material_url?: string | null;
    materials?: { id: string; url: string; filename: string }[];
    external_url?: string | null; video_hosted?: boolean;
  };
  onClose: () => void;
  onSubmit: (d: { title: string; duration_minutes: number; video_url: string; is_free_preview?: boolean; external_url?: string | null }) => void;
  onVideoSaved: () => void;
  onMaterialSaved?: (materials: { id: string; url: string; filename: string }[]) => void;
  loading: boolean;
}) {
  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: {
      title: initialData?.title || "",
      duration_minutes: initialData?.duration_minutes || 30,
      video_url: initialData?.video_url || "",
      external_url: initialData?.external_url || "",
      is_free_preview: initialData?.is_free_preview || false,
    },
  });

  const handleClose = () => { onClose(); reset(); };
  const externalUrl = watch("external_url");
  const videoUrl = watch("video_url");
  const hasConflict = !!externalUrl && !!videoUrl;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Título</label>
            <Input {...register("title", { required: true })} placeholder="Ex: Introdução ao tema" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Duração (minutos)</label>
            <Input {...register("duration_minutes", { valueAsNumber: true })} type="number" min="0" />
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Conteúdo</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">URL do vídeo</label>
            <Input {...register("video_url")} placeholder="YouTube, Vimeo ou link direto"
              disabled={!!externalUrl} className={externalUrl ? "opacity-50" : ""} />
            <p className="text-[10px] text-muted-foreground">Para vídeos hospedados no YouTube, Vimeo ou S3.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex-1 h-px bg-border" /><span className="uppercase font-medium">ou</span><div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              URL externa
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-normal">Hotmart / Kiwify</span>
            </label>
            <Input {...register("external_url")} placeholder="https://go.hotmart.com/..."
              disabled={!!videoUrl} className={videoUrl ? "opacity-50" : ""} />
            <p className="text-[10px] text-muted-foreground">Quando preenchido, o aluno verá um botão para acessar a aula na plataforma externa.</p>
          </div>
          {hasConflict && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-xs text-warning">
              ⚠️ Preencha apenas um: vídeo interno <strong>ou</strong> URL externa. Quando ambos preenchidos, a URL externa tem prioridade.
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register("is_free_preview")} className="rounded" />
            <span className="text-sm text-foreground">Aula gratuita (preview)</span>
          </label>
          {hasVideoHosting && lessonId && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Vídeo hospedado</label>
              {!initialData?.video_hosted && (
                <p className="text-xs text-muted-foreground">Ao hospedar, o link externo acima será removido automaticamente.</p>
              )}
              <VideoUploader lessonId={lessonId} isHosted={initialData?.video_hosted} onSaved={onVideoSaved} />
            </div>
          )}
          {lessonId && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Material de Apoio (PDF)</label>
              <PdfUploader lessonId={lessonId} currentUrl={initialData?.material_url} materials={initialData?.materials ?? []} onUploaded={() => { }} onMaterialsChange={onMaterialSaved} />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal de Questões da Aula com IA ─────────────────────────────────────────

function LessonQuestionsModal({
  open, lessonId, lessonTitle, onClose, onGenerate, onApprove, onDelete, isGenerating,
}: {
  open: boolean; lessonId: string; lessonTitle: string; onClose: () => void;
  onGenerate: (count: number, difficulty: string) => void;
  onApprove: (questionId: string) => void;
  onDelete: (questionId: string) => void;
  isGenerating: boolean;
}) {
  const [count, setCount] = useState(3);
  const [difficulty, setDifficulty] = useState("medium");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["lesson-questions", lessonId],
    queryFn: () => apiClient.get(`/courses/lessons/${lessonId}/questions`).then(r => r.data),
    enabled: open && !!lessonId,
    refetchInterval: 8000,
  });

  const questions = data?.questions || [];
  const pending = questions.filter((q: any) => !q.is_reviewed);
  const approved = questions.filter((q: any) => q.is_reviewed);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-purple-500" />
            Questões da aula — {lessonTitle}
          </DialogTitle>
        </DialogHeader>

        {/* Gerador */}
        <div className="rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-800 p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Gerar novas questões com IA</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Quantidade</label>
              <select value={count} onChange={e => setCount(Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                {[1, 2, 3, 5, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Dificuldade</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                <option value="easy">Fácil</option>
                <option value="medium">Médio</option>
                <option value="hard">Difícil</option>
              </select>
            </div>
            <Button size="sm" onClick={() => onGenerate(count, difficulty)} disabled={isGenerating}
              className="bg-purple-600 hover:bg-purple-700 text-white ml-auto">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {isGenerating ? "Iniciando..." : "Gerar com IA"}
            </Button>
          </div>
          {isGenerating && (
            <div className="flex items-center gap-2 text-xs text-purple-600 bg-purple-50 dark:bg-purple-950/30 rounded-md px-3 py-2">
              <div className="h-3 w-3 rounded-full border-2 border-purple-500 border-t-transparent animate-spin shrink-0" />
              Gerando questões com IA... Clique em "Atualizar" após ~20 segundos.
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            O Mentor Inteligente analisa o conteúdo da aula e cria questões no padrão concurso público.
            As questões ficam pendentes para sua revisão antes de ficarem visíveis aos alunos.
          </p>
        </div>

        {isLoading && (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
          </div>
        )}

        {!isLoading && pending.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">Aguardando revisão</p>
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">{pending.length}</Badge>
            </div>
            {pending.map((q: any) => (
              <QuestionCard key={q.id} question={q} isPending={true} lessonId={lessonId}
                onApprove={() => onApprove(q.id)} onDelete={() => onDelete(q.id)} />
            ))}
          </div>
        )}

        {!isLoading && approved.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">Publicadas para alunos</p>
              <Badge variant="outline" className="text-xs text-green-600 border-green-300 bg-green-50">{approved.length}</Badge>
            </div>
            {approved.map((q: any) => (
              <QuestionCard key={q.id} question={q} isPending={false} lessonId={lessonId}
                onApprove={() => { }} onDelete={() => onDelete(q.id)} />
            ))}
          </div>
        )}

        {!isLoading && questions.length === 0 && (
          <div className="py-10 text-center">
            <BookOpenCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Nenhuma questão ainda</p>
            <p className="text-xs text-muted-foreground mt-1">
              Clique em "Gerar com IA" para criar questões baseadas no conteúdo desta aula.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>Atualizar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuestionCard({ question, isPending, lessonId, onApprove, onDelete }: {
  question: any; isPending: boolean; lessonId: string;
  onApprove: () => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const diffColor: Record<string, string> = {
    easy: "text-green-600 bg-green-50 border-green-200",
    medium: "text-amber-600 bg-amber-50 border-amber-200",
    hard: "text-red-600 bg-red-50 border-red-200",
  };
  const diffLabel: Record<string, string> = { easy: "Fácil", medium: "Médio", hard: "Difícil" };

  return (
    <div className={`rounded-lg border p-3 space-y-2 text-sm ${isPending ? "border-amber-200 bg-amber-50/30 dark:bg-amber-950/10" : "border-border bg-muted/20"}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">{question.statement}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {question.difficulty && (
            <span className={`text-xs px-1.5 py-0.5 rounded border ${diffColor[question.difficulty] || "text-muted-foreground"}`}>
              {diffLabel[question.difficulty] || question.difficulty}
            </span>
          )}
          <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-1.5 pt-1 border-t border-border/50">
          {question.discipline && (
            <p className="text-xs text-muted-foreground">Disciplina: <span className="text-foreground">{question.discipline}</span></p>
          )}
          <div className="space-y-1">
            {(question.alternatives || []).map((alt: any) => (
              <div key={alt.key} className={`flex items-start gap-1.5 text-xs rounded px-2 py-1 ${alt.key === question.correct_alternative_key ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300" : "text-muted-foreground"}`}>
                <span className="font-bold shrink-0">{alt.key.toUpperCase()})</span>
                <span>{alt.text}</span>
              </div>
            ))}
          </div>
          {question.correct_justification && (
            <p className="text-xs text-muted-foreground mt-1 italic">💡 {question.correct_justification}</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {isPending && (
          <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50" onClick={onApprove}>
            <CheckCheck className="h-3 w-3 mr-1" />Aprovar
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:bg-destructive/10" onClick={onDelete}>
          <XIcon className="h-3 w-3 mr-1" />Remover
        </Button>
        {!isPending && (
          <span className="text-xs text-green-600 flex items-center gap-1 ml-auto">
            <CheckCheck className="h-3 w-3" />Visível para alunos
          </span>
        )}
        {isPending && (
          <span className="text-xs text-amber-600 flex items-center gap-1 ml-auto">Pendente de revisão</span>
        )}
      </div>
    </div>
  );
}