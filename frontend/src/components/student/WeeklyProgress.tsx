import { ProgressBar } from "@/components/shared/ProgressBar";
import { Clock } from "lucide-react";
export function WeeklyProgress({ weekMinutes, goalMinutes, percent }: { weekMinutes:number; goalMinutes:number; percent:number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground flex items-center gap-1"><Clock className="h-4 w-4" /> Meta semanal</span>
        <span className="text-sm font-bold text-primary">{percent}%</span>
      </div>
      <ProgressBar value={percent} color={percent>=80?"success":percent>=40?"warning":"destructive"} />
      <p className="text-xs text-muted-foreground">{Math.round(weekMinutes)}min de {goalMinutes}min</p>
    </div>
  );
}
