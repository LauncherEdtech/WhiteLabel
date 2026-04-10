// frontend/src/components/student/ScheduleDay.tsx
// Alinhado com contrato real da API:
//   day.date (string ISO) — is_today e day_label computados aqui, não vêm da API
//   day.items[].status: "done" (não "completed")

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScheduleItemRow } from "./ScheduleItemRow";
import { cn } from "@/lib/utils/cn";
import type { ScheduleDay as ScheduleDayType } from "@/types/schedule";

const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Computa metadados de exibição a partir do ISO date string da API. */
function parseDayMeta(dateStr: string): {
  isToday: boolean;
  label: string;
  sub: string;
} {
  // Adiciona T12:00:00 para evitar problema de timezone que muda o dia
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  const sub = `${d.getDate()} ${MONTHS_PT[d.getMonth()]}`;

  if (diff === 0) return { isToday: true, label: "Hoje", sub };
  if (diff === 1) return { isToday: false, label: "Amanhã", sub };
  return { isToday: false, label: DAYS_PT[d.getDay()], sub };
}

export function ScheduleDay({
  day,
  onCheckin,
}: {
  day: ScheduleDayType;
  onCheckin?: (id: string) => void;
}) {
  const { isToday, label, sub } = parseDayMeta(day.date);

  // "done" é o status real retornado pela API (não "completed")
  const doneCount = day.items.filter(i => i.status === "done").length;
  const pendingCount = day.items.filter(i => i.status === "pending").length;

  return (
    <Card className={cn(isToday && "border-primary/50 shadow-sm")}>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          {isToday && (
            <Badge variant="default" className="text-xs">Hoje</Badge>
          )}
          <div>
            <p className={cn("font-semibold text-sm", isToday && "text-primary")}>
              {label}
            </p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isToday && pendingCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {doneCount}/{day.items.length}
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-1">
        {day.items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">Sem itens</p>
        ) : (
          day.items.map(item => (
            <ScheduleItemRow key={item.id} item={item} onCheckin={onCheckin} />
          ))
        )}
      </CardContent>
    </Card>
  );
}