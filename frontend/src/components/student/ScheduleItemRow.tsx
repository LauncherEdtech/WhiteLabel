import { cn } from "@/lib/utils/cn";
import { BookOpen, HelpCircle, RefreshCw, ClipboardList, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import type { ScheduleItem } from "@/types/schedule";
const typeIcons = { lesson:<BookOpen className="h-4 w-4"/>, questions:<HelpCircle className="h-4 w-4"/>, review:<RefreshCw className="h-4 w-4"/>, simulado:<ClipboardList className="h-4 w-4"/> };
const statusColors = { pending:"text-muted-foreground", completed:"text-success", skipped:"text-muted-foreground opacity-50", overdue:"text-destructive" };
export function ScheduleItemRow({ item, onCheckin }: { item: ScheduleItem; onCheckin?: (id: string) => void }) {
  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-lg transition-colors", item.status==="completed"?"opacity-60":"hover:bg-accent/50")}>
      <div className={cn("shrink-0", statusColors[item.status])}>{typeIcons[item.type]}</div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium truncate", item.status==="completed"?"line-through text-muted-foreground":"text-foreground")}>{item.title}</p>
        {item.subject && <p className="text-xs text-muted-foreground">{item.subject}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Clock className="h-3 w-3"/>{item.estimated_minutes}min</span>
        {item.status==="pending" && onCheckin && <button onClick={()=>onCheckin(item.id)} className="text-xs text-primary hover:underline">✓</button>}
        {item.status==="completed" && <CheckCircle2 className="h-4 w-4 text-success"/>}
        {item.status==="overdue" && <AlertCircle className="h-4 w-4 text-destructive"/>}
      </div>
    </div>
  );
}
