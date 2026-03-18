// frontend/src/app/(producer)/producer/courses/[id]/page.tsx
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils/cn";
import {
  BookOpen, Plus, ChevronDown, ChevronUp,
  Pencil, Trash2, Eye, EyeOff, GripVertical,
  Video, FileText, Clock,
} from "lucide-react";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";

export default function ProducerCourseDetailPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Modais
  const [subjectModal, setSubjectModal] = useState(false);
  const [moduleModal, setModuleModal] = useState<{ open: boolean; subjectId: string }>({ open: false, subjectId: "" });
  const [lessonModal, setLessonModal] = useState<{ open: boolean; moduleId: string }>({ open: false, moduleId: "" });

  const { data: course, isLoading } = useQuery({
    queryKey: QUERY_KEYS.COURSE(courseId),
    queryFn: async () => {
      const res = await apiClient.get(`/courses/${courseId}`);
      return res.data.course;
    },
  });

  const createSubject = useMutation({
    mutationFn: (d: { name: string; color: string; edital_weight: number }) =>
      apiClient.post(`/courses/${courseId}/subjects`, d).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) });
      toast.success("Disciplina criada!");
      setSubjectModal(false);
    },
  });

  const createModule = useMutation({
    mutationFn: ({ subjectId, name }: { subjectId: string; name: string }) =>
      apiClient.post(`/courses/subjects/${subjectId}/modules`, { name, order: 0 }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) });
      toast.success("Módulo criado!");
      setModuleModal({ open: false, subjectId: "" });
    },
  });

  const createLesson = useMutation({
    mutationFn: (d: { moduleId: string; title: string; duration_minutes: number; video_url: string }) =>
      apiClient.post(`/courses/modules/${d.moduleId}/lessons`, {
        title: d.title,
        duration_minutes: d.duration_minutes,
        video_url: d.video_url || null,
        order: 0,
        is_published: false,
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) });
      toast.success("Aula criada!");
      setLessonModal({ open: false, moduleId: "" });
    },
  });

  const toggleLesson = useMutation({
    mutationFn: ({ lessonId, is_published, title }: { lessonId: string; is_published: boolean; title: string }) =>
      apiClient.put(`/courses/lessons/${lessonId}`, {
        title,
        is_published,
        duration_minutes: 0,
        order: 0,
        is_free_preview: false,
      }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(courseId) }),
  });

  if (isLoading) return <Skeleton className="h-64 rounded-xl animate-pulse" />;
  if (!course) return null;

  const subjects = course.subjects || [];

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">
            {course.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie o conteúdo do curso
          </p>
        </div>
        <Button onClick={() => setSubjectModal(true)}>
          <Plus className="h-4 w-4" /> Disciplina
        </Button>
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

      {/* Árvore editável */}
      {subjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-foreground">Nenhuma disciplina ainda</p>
            <p className="text-sm text-muted-foreground mt-1">
              Adicione disciplinas para organizar o conteúdo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {subjects.map((subject: any) => (
            <Card key={subject.id} className="overflow-hidden">
              {/* Subject header */}
              <div
                role="button" tabIndex={0}
                onClick={() => setExpandedSubjects(prev => {
                  const next = new Set(prev);
                  next.has(subject.id) ? next.delete(subject.id) : next.add(subject.id);
                  return next;
                })}
                className="w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left cursor-pointer"
              >
                <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: subject.color }} />
                <span className="flex-1 font-semibold text-foreground">{subject.name}</span>
                <Badge variant="outline" className="text-xs">
                  peso {subject.edital_weight}x
                </Badge>
                <Button
                  variant="ghost" size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModuleModal({ open: true, subjectId: subject.id });
                  }}
                  title="Adicionar módulo"
                >
                  <Plus className="h-3 w-3" />
                </Button>
                {expandedSubjects.has(subject.id)
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                }
              </div>

              {/* Modules */}
              {expandedSubjects.has(subject.id) && (
                <div className="border-t border-border">
                  {(subject.modules || []).map((module: any) => (
                    <div key={module.id} className="border-b border-border last:border-0">
                      <div
                        role="button" tabIndex={0}
                        onClick={() => setExpandedModules(prev => {
                          const next = new Set(prev);
                          next.has(module.id) ? next.delete(module.id) : next.add(module.id);
                          return next;
                        })}
                        className="w-full px-5 py-3 flex items-center gap-3 hover:bg-accent/30 transition-colors text-left cursor-pointer"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="flex-1 text-sm font-medium text-foreground">{module.name}</span>
                        <span className="text-xs text-muted-foreground">{module.lessons?.length || 0} aulas</span>
                        <Button
                          variant="ghost" size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLessonModal({ open: true, moduleId: module.id });
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        {expandedModules.has(module.id)
                          ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
                          : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        }
                      </div>

                      {/* Lessons */}
                      {expandedModules.has(module.id) && (
                        <div className="pb-2">
                          {(module.lessons || []).map((lesson: any, li: number) => (
                            <div
                              key={lesson.id}
                              className="flex items-center gap-3 px-7 py-2 hover:bg-accent/20 transition-colors"
                            >
                              <Video className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="flex-1 text-xs text-foreground truncate">
                                {li + 1}. {lesson.title}
                              </span>
                              {lesson.duration_minutes > 0 && (
                                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="h-3 w-3" />
                                  {lesson.duration_minutes}min
                                </span>
                              )}
                              <button
                                onClick={() => toggleLesson.mutate({
                                  lessonId: lesson.id,
                                  title: lesson.title,
                                  is_published: !lesson.is_published,
                                })}
                                title={lesson.is_published ? "Despublicar" : "Publicar"}
                                className="shrink-0"
                              >
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

      {/* Modal: Nova disciplina */}
      <SubjectModal
        open={subjectModal}
        onClose={() => setSubjectModal(false)}
        onSubmit={(d) => createSubject.mutate(d)}
        loading={createSubject.isPending}
      />

      {/* Modal: Novo módulo */}
      <SimpleModal
        open={moduleModal.open}
        onClose={() => setModuleModal({ open: false, subjectId: "" })}
        title="Novo módulo"
        placeholder="Nome do módulo"
        onSubmit={(name) => createModule.mutate({ subjectId: moduleModal.subjectId, name })}
        loading={createModule.isPending}
      />

      {/* Modal: Nova aula */}
      <LessonModal
        open={lessonModal.open}
        onClose={() => setLessonModal({ open: false, moduleId: "" })}
        onSubmit={(d) => createLesson.mutate({ ...d, moduleId: lessonModal.moduleId })}
        loading={createLesson.isPending}
      />
    </div>
  );
}

// ── Modais ────────────────────────────────────────────────────────────────────

const COLORS = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#06B6D4", "#374151"];

function SubjectModal({ open, onClose, onSubmit, loading }: {
  open: boolean; onClose: () => void;
  onSubmit: (d: { name: string; color: string; edital_weight: number }) => void;
  loading: boolean;
}) {
  const { register, handleSubmit, reset } = useForm({ defaultValues: { name: "", edital_weight: 1 } });
  const [color, setColor] = useState("#4F46E5");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nova disciplina</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((d) => onSubmit({ ...d, color }))} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Nome</label>
            <Input {...register("name", { required: true })} placeholder="Ex: Direito Penal" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Cor</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-lg border-2 transition-all"
                  style={{
                    backgroundColor: c, borderColor: color === c ? "white" : "transparent",
                    boxShadow: color === c ? `0 0 0 2px ${c}` : "none"
                  }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Peso no edital</label>
            <Input {...register("edital_weight", { valueAsNumber: true })} type="number" step="0.1" min="0.1" max="10" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={loading}>Criar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SimpleModal({ open, onClose, title, placeholder, onSubmit, loading }: {
  open: boolean; onClose: () => void; title: string; placeholder: string;
  onSubmit: (name: string) => void; loading: boolean;
}) {
  const { register, handleSubmit, reset } = useForm<{ name: string }>();
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((d) => onSubmit(d.name))} className="space-y-4">
          <Input {...register("name", { required: true })} placeholder={placeholder} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={loading}>Criar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LessonModal({ open, onClose, onSubmit, loading }: {
  open: boolean; onClose: () => void;
  onSubmit: (d: { title: string; duration_minutes: number; video_url: string }) => void;
  loading: boolean;
}) {
  const { register, handleSubmit, reset } = useForm({ defaultValues: { title: "", duration_minutes: 30, video_url: "" } });
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nova aula</DialogTitle></DialogHeader>
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
            <label className="text-sm font-medium">URL do vídeo (opcional)</label>
            <Input {...register("video_url")} placeholder="YouTube, Vimeo ou link direto" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={loading}>Criar aula</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}