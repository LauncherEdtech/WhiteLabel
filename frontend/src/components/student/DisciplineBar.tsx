import { ProgressBar } from "@/components/shared/ProgressBar";
import { cn } from "@/lib/utils/cn";
import type { DisciplinePerformance } from "@/types/analytics";
export function DisciplineBar({ d }: { d: DisciplinePerformance }) {
  const color = d.performance_label==="forte"?"success":d.performance_label==="regular"?"warning":"destructive";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground">{d.discipline}</span>
        <span className={cn("text-sm font-bold", `text-${color}`)}>{d.accuracy_rate}%</span>
      </div>
      <ProgressBar value={d.accuracy_rate} color={color as any} size="sm" />
    </div>
  );
}
