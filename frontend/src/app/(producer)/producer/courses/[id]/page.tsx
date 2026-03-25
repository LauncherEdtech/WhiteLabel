// frontend/src/app/(producer)/producer/courses/[id]/page.tsx
"use client";

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
} from "lucide-react";
import Link from "next/link";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";
import { PdfUploader } from "@/components/producer/PdfUploader";

type EditSubjectState = { open: boolean; subject: any | null };
type EditModuleState = { open: boolean; module: any | null };
type EditLessonState = { open: boolean; lesson: any | null };
type ConfirmDelete = { open: boolean; type: "subject" | "module" | "lesson"; id: string; name: string; parentCount?: number } | null;

// Estado do modal de criar aula — suporta fase 2 (PDF) após criação
type LessonModalState = {
  open: boolean;
  moduleId: string;
  createdLessonId?: string;   // presente na fase 2
  createdTitle?: string;
};

export default function ProducerCourseDetailPage() {
  const { id: courseId } = useParams<{ id: string }>();
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
    mutationFn: (d: { moduleId: string; title: string; duration_minutes: number; video_url: string; is_free_preview?: boolean }) =>
      apiClient.post(`/courses/modules/${d.moduleId}/lessons`, {
        title: d.title,
        duration_minutes: d.duration_minutes,
        video_url: d.video_url || null,
        order: 0,
        is_published: false,
        is_free_preview: d.is_free_preview ?? false,
      }).then(r => r.data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) });
      if (data?.lesson?.id) {
        // Fase 2: mantém o modal aberto mas muda para tela de PDF
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

  // ── Mutations: excluir ──────────────────────────────────────────────────────

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

  if (isLoading) return <Skeleton className="h-64 rounded-xl animate-pulse" />;
  if (!course) return null;

  const subjects = course.subjects || [];
  const isDeleting = deleteModule.isPending || deleteLesson.isPending || deleteSubject.isPending;

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">

      {/* Header */}
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
        <div className="flex items-center gap-2">
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

      {/* Stats */}
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

      {/* Árvore */}
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
                          {(module.lessons || []).map((lesson: any, li: number) => (
                            <div key={lesson.id} className="flex items-center gap-3 px-8 py-2 hover:bg-accent/20 transition-colors group">
                              <Video className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="flex-1 text-xs text-foreground truncate">{li + 1}. {lesson.title}</span>
                              {lesson.material_url && (
                                <span title="Tem PDF"><FileText className="h-3 w-3 text-destructive shrink-0" /></span>
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
                            </div>
                          ))}
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

      {/* ── Modal: Confirmação de exclusão ── */}
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

      {/* ── Modais: Criar ── */}
      <SubjectModal open={subjectModal} title="Nova Disciplina"
        onClose={() => setSubjectModal(false)}
        onSubmit={d => createSubject.mutate(d)}
        loading={createSubject.isPending} />

      <SimpleModal open={moduleModal.open} title="Novo Módulo" placeholder="Nome do módulo"
        onClose={() => setModuleModal({ open: false, subjectId: "" })}
        onSubmit={name => createModule.mutate({ subjectId: moduleModal.subjectId, name })}
        loading={createModule.isPending} />

      {/* Modal criar aula — dois modos: fase 1 (form) e fase 2 (PDF) no mesmo modal */}
      <CreateLessonModal
        open={lessonModal.open}
        createdLessonId={lessonModal.createdLessonId}
        createdTitle={lessonModal.createdTitle}
        loading={createLesson.isPending}
        onClose={() => {
          setLessonModal({ open: false, moduleId: "" });
          if (lessonModal.createdLessonId) toast.success("Aula criada com sucesso!");
        }}
        onSubmit={d => createLesson.mutate({ ...d, moduleId: lessonModal.moduleId })}
        onPdfUploaded={() => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) });
          setLessonModal({ open: false, moduleId: "" });
          toast.success("Aula criada com PDF!");
        }}
      />

      {/* ── Modais: Editar ── */}
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
        initialData={editLesson.lesson ? {
          title: editLesson.lesson.title,
          duration_minutes: editLesson.lesson.duration_minutes,
          video_url: editLesson.lesson.video_url || "",
          is_free_preview: editLesson.lesson.is_free_preview,
          material_url: editLesson.lesson.material_url,
        } : undefined}
        onClose={() => setEditLesson({ open: false, lesson: null })}
        onSubmit={d => updateLesson.mutate({
          lessonId: editLesson.lesson!.id,
          data: {
            title: d.title,
            duration_minutes: d.duration_minutes,
            video_url: d.video_url || null,
            is_published: editLesson.lesson!.is_published,
            order: editLesson.lesson!.order ?? 0,
            is_free_preview: d.is_free_preview ?? false,
          },
        })}
        loading={updateLesson.isPending}
      />
    </div>
  );
}

// ── Modal criar aula (dois modos: form → PDF no mesmo dialog) ─────────────────

function CreateLessonModal({ open, createdLessonId, createdTitle, loading, onClose, onSubmit, onPdfUploaded }: {
  open: boolean;
  createdLessonId?: string;
  createdTitle?: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: (d: { title: string; duration_minutes: number; video_url: string; is_free_preview?: boolean }) => void;
  onPdfUploaded: () => void;
}) {
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { title: "", duration_minutes: 30, video_url: "", is_free_preview: false },
  });

  const handleClose = () => { onClose(); reset(); };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm">
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

        {/* Fase 1: formulário */}
        {!createdLessonId && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Título</label>
              <Input {...register("title", { required: true })} placeholder="Ex: Introdução ao tema" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Duração (minutos)</label>
              <Input {...register("duration_minutes", { valueAsNumber: true })} type="number" min="1" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">URL do vídeo</label>
              <Input {...register("video_url")} placeholder="YouTube, Vimeo ou link direto" />
            </div>
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

        {/* Fase 2: upload PDF opcional */}
        {createdLessonId && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">"{createdTitle}"</strong> foi criada.
              Deseja adicionar um material de apoio em PDF? (opcional)
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Material de Apoio (PDF)</label>
              <PdfUploader
                lessonId={createdLessonId}
                currentUrl={null}
                onUploaded={(url) => { if (url) onPdfUploaded(); }}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>Pular por agora</Button>
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

function LessonModal({ open, title, initialData, lessonId, onClose, onSubmit, loading }: {
  open: boolean; title: string; lessonId?: string;
  initialData?: { title: string; duration_minutes: number; video_url: string; is_free_preview?: boolean; material_url?: string | null };
  onClose: () => void;
  onSubmit: (d: { title: string; duration_minutes: number; video_url: string; is_free_preview?: boolean }) => void;
  loading: boolean;
}) {
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      title: initialData?.title || "",
      duration_minutes: initialData?.duration_minutes || 30,
      video_url: initialData?.video_url || "",
      is_free_preview: initialData?.is_free_preview || false,
    },
  });
  const handleClose = () => { onClose(); reset(); };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Título</label>
            <Input {...register("title", { required: true })} placeholder="Ex: Introdução ao tema" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Duração (minutos)</label>
            <Input {...register("duration_minutes", { valueAsNumber: true })} type="number" min="1" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">URL do vídeo</label>
            <Input {...register("video_url")} placeholder="YouTube, Vimeo ou link direto" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register("is_free_preview")} className="rounded" />
            <span className="text-sm text-foreground">Aula gratuita (preview)</span>
          </label>
          {lessonId && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Material de Apoio (PDF)</label>
              <PdfUploader lessonId={lessonId} currentUrl={initialData?.material_url} onUploaded={() => { }} />
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


