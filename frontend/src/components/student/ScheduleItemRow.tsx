// frontend/src/components/student/ScheduleItemRow.tsx
// Alinhado com contrato real da API:
//   item.item_type  (não item.type)
//   status: "pending"|"done"|"skipped"|"rescheduled"  (não "completed"|"overdue")
//   item.lesson?.title  (não item.title)
//   item.subject?.name  (não item.subject como string)

import { cn } from "@/lib/utils/cn";
import {
  BookOpen, HelpCircle, RefreshCw, ClipboardList,
  CheckCircle2, Clock, SkipForward,
} from "lucide-react";
import type { ScheduleItem, ItemType, ItemStatus } from "@/types/schedule";

const typeConfig: Record<ItemType, { icon: React.ElementType; label: string; color: string }> = {
  lesson: { icon: BookOpen, label: "Aula", color: "text-primary" },
  questions: { icon: HelpCircle, label: "Questões", color: "text-warning" },
  review: { icon: RefreshCw, label: "Revisão", color: "text-secondary" },
  simulado: { icon: ClipboardList, label: "Simulado", color: "text-destructive" },
};

const statusTextClass: Record<ItemStatus, string> = {
  pending: "text-foreground",
  done: "text-muted-foreground line-through",
  skipped: "text-muted-foreground line-through opacity-60",
  rescheduled: "text-muted-foreground italic",
};

function resolveTitle(item: ScheduleItem): string {
  if (item.template_item_title) return item.template_item_title;
  if (item.lesson?.title) return item.lesson.title;
  if (item.item_type === "questions") return `Questões — ${item.subject?.name ?? "Geral"}`;
  if (item.item_type === "review") return `Revisão — ${item.subject?.name ?? "Geral"}`;
  if (item.item_type === "simulado") return "Simulado de verificação";
  return "Estudar";
}

export function ScheduleItemRow({
  item,
  onCheckin,
}: {
  item: ScheduleItem;
  onCheckin?: (id: string) => void;
}) {
  const cfg = typeConfig[item.item_type] ?? typeConfig.lesson;
  const Icon = cfg.icon;
  const isDone = item.status === "done";
  const isSkipped = item.status === "skipped";
  const isPending = item.status === "pending";

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg transition-colors",
      isDone && "bg-success/5",
      isSkipped && "bg-muted/30",
      isPending && "hover:bg-accent/50",
    )}>
      <div className={cn("shrink-0", cfg.color)}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium truncate", statusTextClass[item.status])}>
          {resolveTitle(item)}
        </p>

        {item.subject?.name && (
          <p className="text-xs text-muted-foreground truncate">{item.subject.name}</p>
        )}

        {item.template_item_notes && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 truncate">
            {item.template_item_notes}
          </p>
        )}

        {item.priority_reason && !item.template_item_notes && (
          <p className="text-xs text-muted-foreground mt-0.5 italic truncate">
            {item.priority_reason}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
          <Clock className="h-3 w-3" />{item.estimated_minutes}min
        </span>
        {isPending && onCheckin && (
          <button onClick={() => onCheckin(item.id)}
            className="text-xs text-primary hover:underline font-medium">
            ✓ Marcar
          </button>
        )}
        {isDone && <CheckCircle2 className="h-4 w-4 text-success" />}
        {isSkipped && <SkipForward className="h-4 w-4 text-muted-foreground" />}
      </div>
    </div>
  );
}