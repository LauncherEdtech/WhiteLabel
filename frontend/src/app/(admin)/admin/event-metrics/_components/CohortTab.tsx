// frontend/src/app/(admin)/event-metrics/_components/CohortTab.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import { eventMetricsApi, arrayToCsv, downloadCsv } from "@/lib/api/event-metrics";
import { cn } from "@/lib/utils/cn";

const RETENTION_KEYS: (keyof import("@/lib/api/event-metrics").CohortRetention)[] = [
    "d0", "d1", "d3", "d7", "d14", "d30",
];

const RETENTION_LABELS: Record<string, string> = {
    d0: "D0",
    d1: "D1",
    d3: "D3",
    d7: "D7",
    d14: "D14",
    d30: "D30",
};

function getCellColor(pct: number): string {
    // Gradiente verde → amarelo → vermelho conforme retenção cai
    if (pct >= 80) return "bg-green-600 text-white";
    if (pct >= 60) return "bg-green-500 text-white";
    if (pct >= 40) return "bg-yellow-500 text-white";
    if (pct >= 20) return "bg-orange-500 text-white";
    if (pct > 0) return "bg-red-500 text-white";
    return "bg-muted text-muted-foreground";
}

export function CohortTab() {
    const [weeks, setWeeks] = useState(12);

    const { data, isLoading, error } = useQuery({
        queryKey: ["event-metrics-cohort", weeks],
        queryFn: () => eventMetricsApi.cohort(weeks),
    });

    const handleExport = () => {
        if (!data) return;
        const rows = data.cohorts.map(c => ({
            cohort_week: c.cohort_week,
            size: c.size,
            d0: c.retention.d0,
            d1: c.retention.d1,
            d3: c.retention.d3,
            d7: c.retention.d7,
            d14: c.retention.d14,
            d30: c.retention.d30,
        }));
        downloadCsv(`cohort_${weeks}weeks.csv`, arrayToCsv(rows));
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Período:</span>
                    <select
                        value={weeks}
                        onChange={e => setWeeks(Number(e.target.value))}
                        className="text-sm rounded-lg border border-border px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value={4}>Últimas 4 semanas</option>
                        <option value={8}>Últimas 8 semanas</option>
                        <option value={12}>Últimas 12 semanas</option>
                        <option value={26}>Últimas 26 semanas</option>
                    </select>
                </div>
                {data && (
                    <Button size="sm" variant="outline" onClick={handleExport} className="gap-2">
                        <Download className="h-3.5 w-3.5" />
                        Exportar CSV
                    </Button>
                )}
            </div>

            {isLoading && <Skeleton className="h-64 w-full" />}

            {error && (
                <Card>
                    <CardContent className="p-8 text-center text-sm text-muted-foreground">
                        Erro ao carregar cohort.
                    </CardContent>
                </Card>
            )}

            {data && data.cohorts.length === 0 && (
                <Card>
                    <CardContent className="p-8 text-center text-sm text-muted-foreground">
                        Nenhuma cohort no período selecionado.
                    </CardContent>
                </Card>
            )}

            {data && data.cohorts.length > 0 && (
                <Card>
                    <CardContent className="p-4 overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className="text-left text-xs font-medium text-muted-foreground p-2 sticky left-0 bg-card">
                                        Cohort (semana)
                                    </th>
                                    <th className="text-center text-xs font-medium text-muted-foreground p-2">
                                        Size
                                    </th>
                                    {RETENTION_KEYS.map(k => (
                                        <th key={k} className="text-center text-xs font-medium text-muted-foreground p-2 min-w-[60px]">
                                            {RETENTION_LABELS[k]}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.cohorts.map(c => (
                                    <tr key={c.cohort_week}>
                                        <td className="text-xs py-2 px-2 sticky left-0 bg-card border-r border-border font-medium text-foreground">
                                            {c.cohort_week}
                                        </td>
                                        <td className="text-xs py-2 px-2 text-center text-muted-foreground">
                                            {c.size}
                                        </td>
                                        {RETENTION_KEYS.map(k => {
                                            const pct = c.retention[k];
                                            return (
                                                <td key={k} className="p-1">
                                                    <div className={cn(
                                                        "rounded text-xs font-semibold py-2 text-center",
                                                        getCellColor(pct)
                                                    )}>
                                                        {pct.toFixed(0)}%
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="text-xs text-muted-foreground mt-3">
                            % de usuários do cohort que voltaram a fazer eventos no Dia N (cumulativo).
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}