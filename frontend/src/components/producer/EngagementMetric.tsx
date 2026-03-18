import { cn } from "@/lib/utils/cn";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
interface Props { label: string; value: number; unit?: string; trend?: number; color?: string }
export function EngagementMetric({ label, value, unit="%", trend, color="primary" }: Props) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-end gap-2">
        <span className={cn("text-2xl font-display font-bold", `text-${color}`)}>{value}{unit}</span>
        {trend !== undefined && (
          <span className={cn("flex items-center text-xs font-medium mb-1", trend>0?"text-success":trend<0?"text-destructive":"text-muted-foreground")}>
            {trend>0?<TrendingUp className="h-3 w-3"/>:trend<0?<TrendingDown className="h-3 w-3"/>:<Minus className="h-3 w-3"/>}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  );
}
