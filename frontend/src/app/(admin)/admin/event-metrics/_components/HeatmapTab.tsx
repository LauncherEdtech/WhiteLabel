// frontend/src/app/(admin)/event-metrics/_components/HeatmapTab.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import { eventMetricsApi, arrayToCsv, downloadCsv } from "@/lib/api/event-metrics";
import { cn } from "@/lib/utils/cn";

interface HeatmapTabProps {
    startDate: string;
    endDate: string;
}

export function HeatmapTab({ startDate, endDate }: HeatmapTabProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ["event-metrics-heatmap", startDate, endDate],
        queryFn: () => eventMetricsApi.heatmap({ start_date: startDate, end_date: endDate, top: 30 }),
    });

    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                    Erro ao carregar heatmap.
                </CardContent>
            </Card>
        );
    }

    if (data.rows.length === 0) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum evento no período selecionado.
                </CardContent>
            </Card>
        );
    }

    // Calcula valor máximo para gradiente
    const maxTotal = Math.max(
        1,
        ...data.rows.flatMap(r => r.daily.map(d => d.total))
    );

    // Pega lista de datas (todas iguais entre rows)
    const dates = data.rows[0]?.daily.map(d => d.date) || [];

    const handleExport = () => {
        const flatRows = data.rows.flatMap(row =>
            row.daily.map(d => ({
                event_type: row.event_type,
                feature_name: row.feature_name || "",
                date: d.date,
                total: d.total,
                unique_users: d.unique_users,
            }))
        );
        downloadCsv(`heatmap_${startDate}_${endDate}.csv`, arrayToCsv(flatRows));
    };

    return (
        <div className="space-y-3">
            {/* Header com export */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {data.rows.length} eventos · {dates.length} dias · cor mais escura = mais uso
                </p>
                <Button size="sm" variant="outline" onClick={handleExport} className="gap-2">
                    <Download className="h-3.5 w-3.5" />
                    Exportar CSV
                </Button>
            </div>

            {/* Heatmap */}
            <Card>
                <CardContent className="p-4 overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="text-left text-xs font-medium text-muted-foreground p-2 sticky left-0 bg-card z-10">
                                    Evento
                                </th>
                                {dates.map(date => (
                                    <th
                                        key={date}
                                        className="text-xs font-normal text-muted-foreground p-1 min-w-[40px]"
                                        title={date}
                                    >
                                        {date.slice(8)}
                                    </th>
                                ))}
                                <th className="text-xs font-medium text-muted-foreground p-2 text-right">
                                    Total
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.rows.map(row => (
                                <tr key={`${row.event_type}_${row.feature_name}`}>
                                    <td className="text-xs py-1.5 px-2 sticky left-0 bg-card z-10 border-r border-border">
                                        <div className="font-medium text-foreground">{row.event_type}</div>
                                        {row.feature_name && (
                                            <div className="text-muted-foreground text-[10px]">
                                                {row.feature_name}
                                            </div>
                                        )}
                                    </td>
                                    {row.daily.map(d => {
                                        const intensity = d.total / maxTotal;
                                        const bgClass = intensity === 0
                                            ? "bg-muted/30"
                                            : intensity < 0.2
                                                ? "bg-primary/10"
                                                : intensity < 0.4
                                                    ? "bg-primary/25"
                                                    : intensity < 0.6
                                                        ? "bg-primary/40"
                                                        : intensity < 0.8
                                                            ? "bg-primary/60"
                                                            : "bg-primary/80";
                                        return (
                                            <td
                                                key={d.date}
                                                className={cn(
                                                    "p-0.5 text-center min-w-[40px] h-[28px]",
                                                    bgClass
                                                )}
                                                title={`${row.event_type} · ${d.date}\n${d.total} eventos · ${d.unique_users} users`}
                                            >
                                                {d.total > 0 && (
                                                    <span className="text-[10px] text-foreground">
                                                        {d.total > 999 ? "1k+" : d.total}
                                                    </span>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="text-xs font-semibold py-1.5 px-2 text-right border-l border-border">
                                        <div className="text-foreground">{row.totals.total.toLocaleString()}</div>
                                        <div className="text-[10px] text-muted-foreground">
                                            {row.totals.unique_users_peak} users
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        </div>
    );
}