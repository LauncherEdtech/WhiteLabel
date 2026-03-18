import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
interface Props { icon: ReactNode; label: string; value: string|number; sub?: string; color?: string; trend?: number }
export function DashboardCard({ icon, label, value, sub, color="primary", trend }: Props) {
  return (
    <Card><CardContent className="p-4">
      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-3", `bg-${color}/10 text-${color}`)}>{icon}</div>
      <p className="text-2xl font-display font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground/70">{sub}</p>}
      {trend !== undefined && <p className={cn("text-xs font-medium mt-1", trend >= 0 ? "text-success" : "text-destructive")}>{trend >= 0 ? "+" : ""}{trend}%</p>}
    </CardContent></Card>
  );
}
