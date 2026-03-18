import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScheduleItemRow } from "./ScheduleItemRow";
import { cn } from "@/lib/utils/cn";
import type { ScheduleDay as ScheduleDayType } from "@/types/schedule";
export function ScheduleDay({ day, onCheckin }: { day: ScheduleDayType; onCheckin?: (id:string)=>void }) {
  const completed = day.items.filter(i=>i.status==="completed").length;
  return (
    <Card className={cn(day.is_today && "border-primary/50 shadow-sm")}>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          {day.is_today && <Badge variant="default" className="text-xs">Hoje</Badge>}
          <p className="font-semibold text-foreground text-sm">{day.day_label}</p>
        </div>
        <span className="text-xs text-muted-foreground">{completed}/{day.items.length}</span>
      </CardHeader>
      <CardContent className="pt-0 space-y-1">
        {day.items.map(item => <ScheduleItemRow key={item.id} item={item} onCheckin={onCheckin} />)}
        {day.items.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Sem itens</p>}
      </CardContent>
    </Card>
  );
}
