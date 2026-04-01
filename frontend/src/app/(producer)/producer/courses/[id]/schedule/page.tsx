"use client";
// frontend/src/app/(producer)/producer/courses/[id]/schedule/page.tsx
//
// Página do builder de cronograma do produtor.
// Permite criar/editar um template de cronograma para o curso.

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, BookOpen, HelpCircle, RotateCcw,
  Eye, EyeOff, Settings, ChevronDown, ChevronUp,
  GripVertical, Calendar, Clock, Save, ArrowLeft,
  AlertCircle, CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toaster";
import { apiClient } from "@/lib/api/client";
import { producerScheduleApi } from "@/lib/api/producer-schedule";
import type {
  ProducerScheduleTemplate,
  TemplateDay,
  ProducerTemplateItem,
  TemplateItemType,
  CreateTemplateItemPayload,
} from "@/types/producer-schedule";

// ── Tipos auxiliares do frontend ──────────────────────────────────────────

interface CourseLesson {
  id: string;
  title: string;
  duration_minutes: number | null;
  module_name: string;
  subject_name: string;
}

interface CourseSubject {
  id: string;
  name: string;
  color: string | null;
}

// ── Componente principal ──────────────────────────────────────────────────

export default function ProducerScheduleBuilderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const courseId = params.id;
  const toast = useToast();
  const qc = useQueryClient();

  const [showSettings, setShowSettings] = useState(false);

  // Busca template existente
  const { data: templateData, isLoading } = useQuery({
    queryKey: ["producer-schedule-template", courseId],
    queryFn: () => producerScheduleApi.getTemplateByCourse(courseId),
  });

  // Busca aulas do curso (para o painel lateral)
  const { data: courseLessons } = useQuery({
    queryKey: ["course-lessons-flat", courseId],
    queryFn: async () => {
      // Usa o endpoint de detalhe do curso que já retorna subjects aninhados
      const r = await apiClient.get<{ course: { subjects: any[] } }>(`/courses/${courseId}`);
      const lessons: CourseLesson[] = [];
      const subjects: CourseSubject[] = [];
      for (const subj of r.data.course?.subjects || []) {
        subjects.push({ id: subj.id, name: subj.name, color: subj.color });
        for (const mod of subj.modules || []) {
          for (const lesson of mod.lessons || []) {
            lessons.push({
              id: lesson.id,
              title: lesson.title,
              duration_minutes: lesson.duration_minutes,
              module_name: mod.title,
              subject_name: subj.name,
            });
          }
        }
      }
      return { lessons, subjects };
    },
  });

  const createTemplateMut = useMutation({
    mutationFn: () =>
      producerScheduleApi.createTemplate({ course_id: courseId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["producer-schedule-template", courseId] }),
    onError: (e: any) => {
      const msg = e?.response?.data?.message;
      if (msg?.includes("Já existe")) {
        qc.invalidateQueries({ queryKey: ["producer-schedule-template", courseId] });
      } else {
        toast.error("Erro ao criar template");
      }
    },
  });

  const template = templateData?.template ?? null;

  if (isLoading) return <LoadingState />;

  if (!template) {
    return (
      <EmptyState
        onCreate={() => createTemplateMut.mutate()}
        isCreating={createTemplateMut.isPending}
        onBack={() => router.push(`/producer/courses/${courseId}`)}
      />
    );
  }

  return (
    <BuilderContent
      template={template}
      courseId={courseId}
      lessons={courseLessons?.lessons ?? []}
      subjects={courseLessons?.subjects ?? []}
      showSettings={showSettings}
      onToggleSettings={() => setShowSettings((v) => !v)}
      onBack={() => router.push(`/producer/courses/${courseId}`)}
    />
  );
}

// ── Builder principal ─────────────────────────────────────────────────────

function BuilderContent({
  template,
  courseId,
  lessons,
  subjects,
  showSettings,
  onToggleSettings,
  onBack,
}: {
  template: ProducerScheduleTemplate;
  courseId: string;
  lessons: CourseLesson[];
  subjects: CourseSubject[];
  showSettings: boolean;
  onToggleSettings: () => void;
  onBack: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();

  const [addingToDay, setAddingToDay] = useState<number | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]));
  const [editingItem, setEditingItem] = useState<ProducerTemplateItem | null>(null);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["producer-schedule-template", courseId] });

  const publishMut = useMutation({
    mutationFn: () => producerScheduleApi.togglePublish(template.id),
    onSuccess: (data) => {
      toast.success(data.message);
      invalidate();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Erro ao publicar"),
  });

  const updateSettingsMut = useMutation({
    mutationFn: (payload: { allow_student_custom_schedule: boolean }) =>
      producerScheduleApi.updateTemplate(template.id, payload),
    onSuccess: () => {
      toast.success("Configurações salvas!");
      invalidate();
    },
  });

  const deleteItemMut = useMutation({
    mutationFn: (itemId: string) =>
      producerScheduleApi.deleteItem(template.id, itemId),
    onSuccess: () => {
      toast.success("Item removido.");
      invalidate();
    },
    onError: () => toast.error("Erro ao remover item"),
  });

  const addDayMut = useMutation({
    mutationFn: (payload: CreateTemplateItemPayload) =>
      producerScheduleApi.addItem(template.id, payload),
    onSuccess: () => {
      toast.success("Item adicionado!");
      setAddingToDay(null);
      invalidate();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Erro ao adicionar item"),
  });

  const days = template.days ?? [];
  const maxDay = template.total_days;

  const toggleDay = (d: number) =>
    setExpandedDays((prev) => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });

  const handleAddNewDay = () => {
    const newDay = maxDay + 1;
    setAddingToDay(newDay);
    setExpandedDays((prev) => new Set([...prev, newDay]));
  };

  const itemTypeOptions: { type: TemplateItemType; label: string; icon: any; color: string }[] = [
    { type: "lesson", label: "Aula", icon: BookOpen, color: "text-blue-500" },
    { type: "questions", label: "Questões", icon: HelpCircle, color: "text-orange-500" },
    { type: "review", label: "Revisão", icon: RotateCcw, color: "text-purple-500" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Cronograma do Curso
            </h1>
            <p className="text-sm text-muted-foreground">
              {template.total_days} dias · {template.items_count ?? 0} itens
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleSettings}
            className="gap-1.5"
          >
            <Settings className="h-4 w-4" />
            Configurações
          </Button>
          <Button
            size="sm"
            variant={template.is_published ? "outline" : "default"}
            className="gap-1.5"
            onClick={() => publishMut.mutate()}
            disabled={publishMut.isPending}
          >
            {template.is_published ? (
              <>
                <EyeOff className="h-4 w-4" />
                Despublicar
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                Publicar
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2">
        {template.is_published ? (
          <Badge className="bg-green-500/10 text-green-600 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Publicado — visível para alunos
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            <EyeOff className="h-3 w-3 mr-1" />
            Rascunho — alunos não veem
          </Badge>
        )}
        {template.allow_student_custom_schedule && (
          <Badge variant="outline" className="text-muted-foreground text-xs">
            Alunos podem criar cronograma próprio
          </Badge>
        )}
      </div>

      {/* Painel de configurações */}
      {showSettings && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Configurações do cronograma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Permitir cronograma personalizado pelo aluno
                </p>
                <p className="text-xs text-muted-foreground">
                  Se ativo, o aluno pode optar por criar seu próprio cronograma com IA.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={template.allow_student_custom_schedule}
                onClick={() =>
                  updateSettingsMut.mutate({
                    allow_student_custom_schedule: !template.allow_student_custom_schedule,
                  })
                }
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  template.allow_student_custom_schedule
                    ? "bg-primary"
                    : "bg-muted-foreground/30"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                    template.allow_student_custom_schedule ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </label>
          </CardContent>
        </Card>
      )}

      {/* Lista de dias */}
      <div className="space-y-3">
        {days.map((day) => (
          <DayCard
            key={day.day_number}
            day={day}
            isExpanded={expandedDays.has(day.day_number)}
            onToggle={() => toggleDay(day.day_number)}
            isAddingItem={addingToDay === day.day_number}
            onStartAdd={() => setAddingToDay(day.day_number)}
            onCancelAdd={() => setAddingToDay(null)}
            onDeleteItem={(itemId) => deleteItemMut.mutate(itemId)}
            onAddItem={(payload) => addDayMut.mutate({ ...payload, day_number: day.day_number })}
            isAddingLoading={addDayMut.isPending}
            lessons={lessons}
            subjects={subjects}
            itemTypeOptions={itemTypeOptions}
            templateId={template.id}
          />
        ))}

        {/* Adiciona item a dia novo "virtual" */}
        {addingToDay !== null && addingToDay > maxDay && (
          <DayCard
            day={{ day_number: addingToDay, items: [] }}
            isExpanded
            onToggle={() => {}}
            isAddingItem
            onStartAdd={() => {}}
            onCancelAdd={() => setAddingToDay(null)}
            onDeleteItem={() => {}}
            onAddItem={(payload) => addDayMut.mutate({ ...payload, day_number: addingToDay })}
            isAddingLoading={addDayMut.isPending}
            lessons={lessons}
            subjects={subjects}
            itemTypeOptions={itemTypeOptions}
            isNewDay
            templateId={template.id}
          />
        )}

        {/* Botão adicionar dia */}
        <button
          onClick={handleAddNewDay}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Adicionar Dia {maxDay + 1}
        </button>
      </div>

      {/* Dica de publicação */}
      {!template.is_published && template.total_days > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-200 text-amber-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="text-sm">
            Seu cronograma está como rascunho. Clique em{" "}
            <strong>Publicar</strong> para que os alunos possam segui-lo.
          </p>
        </div>
      )}
    </div>
  );
}

// ── DayCard ───────────────────────────────────────────────────────────────

function DayCard({
  day,
  isExpanded,
  onToggle,
  isAddingItem,
  onStartAdd,
  onCancelAdd,
  onDeleteItem,
  onAddItem,
  isAddingLoading,
  lessons,
  subjects,
  itemTypeOptions,
  isNewDay = false,
  templateId,
}: {
  day: TemplateDay;
  isExpanded: boolean;
  onToggle: () => void;
  isAddingItem: boolean;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onDeleteItem: (itemId: string) => void;
  onAddItem: (payload: Omit<CreateTemplateItemPayload, "day_number">) => void;
  isAddingLoading: boolean;
  lessons: CourseLesson[];
  subjects: CourseSubject[];
  itemTypeOptions: { type: TemplateItemType; label: string; icon: any; color: string }[];
  isNewDay?: boolean;
  templateId: string;
}) {
  const totalMin = day.items.reduce((s, i) => s + i.estimated_minutes, 0);

  return (
    <Card className={cn("overflow-hidden", isNewDay && "border-dashed border-primary/40")}>
      {/* Header do dia */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
            {day.day_number}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">
              Dia {day.day_number}
              {isNewDay && <span className="ml-2 text-primary text-xs">novo</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {day.items.length} {day.items.length === 1 ? "item" : "itens"}
              {totalMin > 0 && ` · ~${totalMin} min`}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Corpo do dia */}
      {isExpanded && (
        <CardContent className="pt-0 pb-4 space-y-2">
          {/* Itens existentes */}
          {day.items.map((item) => (
            <TemplateItemCard
              key={item.id}
              item={item}
              onDelete={() => onDeleteItem(item.id)}
            />
          ))}

          {/* Formulário de adição */}
          {isAddingItem ? (
            <AddItemForm
              lessons={lessons}
              subjects={subjects}
              itemTypeOptions={itemTypeOptions}
              onAdd={onAddItem}
              onCancel={onCancelAdd}
              isLoading={isAddingLoading}
            />
          ) : (
            <button
              onClick={onStartAdd}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-xs text-muted-foreground hover:text-primary transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar item neste dia
            </button>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── TemplateItemCard ──────────────────────────────────────────────────────

const ITEM_ICONS: Record<TemplateItemType, any> = {
  lesson: BookOpen,
  questions: HelpCircle,
  review: RotateCcw,
  simulado: Calendar,
};

const ITEM_COLORS: Record<TemplateItemType, string> = {
  lesson: "text-blue-500 bg-blue-500/10",
  questions: "text-orange-500 bg-orange-500/10",
  review: "text-purple-500 bg-purple-500/10",
  simulado: "text-green-500 bg-green-500/10",
};

const ITEM_LABELS: Record<TemplateItemType, string> = {
  lesson: "Aula",
  questions: "Questões",
  review: "Revisão",
  simulado: "Simulado",
};

function TemplateItemCard({
  item,
  onDelete,
}: {
  item: ProducerTemplateItem;
  onDelete: () => void;
}) {
  const Icon = ITEM_ICONS[item.item_type];
  const colorClass = ITEM_COLORS[item.item_type];

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 group">
      <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
      <div className={cn("p-1.5 rounded-md shrink-0", colorClass)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {item.title ?? ITEM_LABELS[item.item_type]}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {ITEM_LABELS[item.item_type]}
          </span>
          {item.subject && (
            <span className="text-xs text-muted-foreground">· {item.subject.name}</span>
          )}
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            {item.estimated_minutes} min
          </span>
          {item.question_filters?.tags?.length && (
            <span className="text-xs text-muted-foreground truncate">
              · {item.question_filters.tags.slice(0, 2).join(", ")}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="shrink-0 p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── AddItemForm ───────────────────────────────────────────────────────────

function AddItemForm({
  lessons,
  subjects,
  itemTypeOptions,
  onAdd,
  onCancel,
  isLoading,
}: {
  lessons: CourseLesson[];
  subjects: CourseSubject[];
  itemTypeOptions: { type: TemplateItemType; label: string; icon: any; color: string }[];
  onAdd: (payload: Omit<CreateTemplateItemPayload, "day_number">) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [itemType, setItemType] = useState<TemplateItemType>("lesson");
  const [lessonId, setLessonId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [estimatedMin, setEstimatedMin] = useState(30);
  const [filterTags, setFilterTags] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [filterQty, setFilterQty] = useState(10);

  const handleSubmit = () => {
    const payload: Omit<CreateTemplateItemPayload, "day_number"> = {
      item_type: itemType,
      title: title || undefined,
      notes: notes || undefined,
      estimated_minutes: estimatedMin,
    };

    if (itemType === "lesson") {
      if (!lessonId) return;
      payload.lesson_id = lessonId;
    } else if (itemType === "questions" || itemType === "review") {
      if (!subjectId) return;
      payload.subject_id = subjectId;
      const filters: any = {};
      if (filterTags.trim()) filters.tags = filterTags.split(",").map((t) => t.trim()).filter(Boolean);
      if (filterDifficulty) filters.difficulty = filterDifficulty;
      if (filterQty) filters.quantity = filterQty;
      payload.question_filters = Object.keys(filters).length ? filters : undefined;
    }

    onAdd(payload);
  };

  return (
    <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
      {/* Tipo */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Tipo de atividade</p>
        <div className="flex gap-2">
          {itemTypeOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.type}
                onClick={() => setItemType(opt.type)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  itemType === opt.type
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", itemType !== opt.type && opt.color)} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo específico por tipo */}
      {itemType === "lesson" && (
        <div>
          <label className="text-xs font-medium text-muted-foreground">Aula</label>
          <select
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
            className="mt-1 w-full text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Selecione uma aula...</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.subject_name} › {l.title}
                {l.duration_minutes ? ` (${l.duration_minutes}min)` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {(itemType === "questions" || itemType === "review") && (
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Disciplina</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="mt-1 w-full text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Selecione a disciplina...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Tags/tópicos (separados por vírgula)
            </label>
            <input
              value={filterTags}
              onChange={(e) => setFilterTags(e.target.value)}
              placeholder="ex: controle difuso, princípios"
              className="mt-1 w-full text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">Dificuldade</label>
              <select
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
                className="mt-1 w-full text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Qualquer</option>
                <option value="easy">Fácil</option>
                <option value="medium">Médio</option>
                <option value="hard">Difícil</option>
                <option value="expert">Expert</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">Qtd. questões</label>
              <input
                type="number"
                value={filterQty}
                min={1}
                max={100}
                onChange={(e) => setFilterQty(Number(e.target.value))}
                className="mt-1 w-full text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>
      )}

      {/* Título e duração */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground">
            Título customizado (opcional)
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Deixe vazio para usar o padrão"
            className="mt-1 w-full text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="w-28">
          <label className="text-xs font-medium text-muted-foreground">Minutos</label>
          <input
            type="number"
            value={estimatedMin}
            min={5}
            max={480}
            onChange={(e) => setEstimatedMin(Number(e.target.value))}
            className="mt-1 w-full text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Nota para o aluno */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Nota para o aluno (opcional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="ex: Atenção especial ao art. 5°..."
          className="mt-1 w-full text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
        />
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={
            isLoading ||
            (itemType === "lesson" && !lessonId) ||
            ((itemType === "questions" || itemType === "review") && !subjectId)
          }
          className="gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          {isLoading ? "Adicionando..." : "Adicionar"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// ── Empty / Loading states ────────────────────────────────────────────────

function EmptyState({
  onCreate,
  isCreating,
  onBack,
}: {
  onCreate: () => void;
  isCreating: boolean;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-2xl font-bold">Cronograma do Curso</h1>
      </div>
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="p-4 rounded-2xl bg-primary/10">
          <Calendar className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Nenhum cronograma criado</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Crie um cronograma estruturado para guiar seus alunos aula por aula, com sessões de
          revisão e questões pré-configuradas.
        </p>
        <Button onClick={onCreate} disabled={isCreating} className="gap-2">
          <Plus className="h-4 w-4" />
          {isCreating ? "Criando..." : "Criar Cronograma"}
        </Button>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
      ))}
    </div>
  );
}