import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import type { Insight } from "@/types/analytics";
import Link from "next/link";
export function InsightCard({ insight }: { insight: Insight }) {
  const colors = { motivation:"border-l-success",weakness:"border-l-destructive",warning:"border-l-warning",positive:"border-l-success",alert:"border-l-destructive" };
  return (
    <Card className={cn("border-l-4", colors[insight.type])}>
      <CardContent className="p-4 flex items-start gap-3">
        <span className="text-2xl shrink-0">{insight.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{insight.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{insight.message}</p>
          {insight.action && <Link href={insight.action.href} className="text-xs text-primary hover:underline mt-1 inline-block">{insight.action.label} →</Link>}
        </div>
      </CardContent>
    </Card>
  );
}
