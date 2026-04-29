// frontend/src/app/(admin)/event-metrics/_components/FunnelTab.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, ArrowDown } from "lucide-react";
import { eventMetricsApi, FUNNEL_FEATURES, arrayToCsv, downloadCsv } from "@/lib/api/event-metrics";
import { cn } from "@/lib/utils/cn";

interface FunnelTabProps {
    startDate: string;
    endDate: string;
}

export function FunnelTab({ startDate, endDate }: FunnelTabProps) {
    const [feature, setFeature] = useState("mentor");

    const { data, isLoading, error } = useQuery({
        queryKey: ["event-metrics-funnel", feature, startDate, endDate],
        queryFn: () => eventMetricsApi.funnel(feature, { start_date: startDate, end_date: endDate }),
    });

    const handleExport = () => {
        if (!data) return;
        const rows = data.stages.map((s, i) => ({
            stage: s.name,
            label: s.label,
            event_types: s.event_types.join("|"),
            unique_users: s.unique_users,
            pct_of_base: s.pct_of_base,
            drop_off_lost: data.drop_off[i - 1]?.lost ?? 0,
            drop_off_pct: data.drop_off[i - 1]?.pct ?? 0,
        }));
        downloadCsv(`funnel_${feature}_${startDate}_${endDate}.csv`, arrayToCsv(rows));
    };

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Feature:</span>
                    <select
                        value={feature}
                        onChange={e => setFeature(e.target.value)}
                        className="text-sm rounded-lg border border-border px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        {FUNNEL_FEATURES.map(f => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                    </select>
                </div>
                {data && (
                    <Button size="sm" variant="outline" onClick={handleExport} className="gap-2">
                        <Download className="h-3.5 w-3.5" />
                        Exportar CSV
                    </Button>
                )}
            </div>

            {isLoading && <Skeleton className="h-96 w-full" />}

            {error && (
                <Card>
                    <CardContent className="p-8 text-center text-sm text-muted-foreground">
                        Erro ao carregar funnel.
                    </CardContent>
                </Card>
            )}

            {data && data.stages.length === 0 && (
                <Card>
                    <CardContent className="p-8 text-center text-sm text-muted-foreground">
                        Sem dados para esta feature no período.
                    </CardContent>
                </Card>
            )}

            {data && data.stages.length > 0 && (
                <Card>
                    <CardContent className="p-6 space-y-2">
                        {data.stages.map((stage, idx) => {
                            const dropOff = data.drop_off[idx - 1];
                            const widthPct = stage.pct_of_base;
                            return (
                                <div key={stage.name}>
                                    {/* Drop-off arrow entre stages */}
                                    {idx > 0 && dropOff && (
                                        <div className="flex items-center justify-center py-1.5">
                                            <ArrowDown className="h-4 w-4 text-muted-foreground" />
                                            {dropOff.lost > 0 && (
                                                <span className="ml-2 text-xs text-red-600 font-medium">
                                                    -{dropOff.lost} ({dropOff.pct}%)
                                                </span>
                                            )}
                                            {dropOff.lost === 0 && (
                                                <span className="ml-2 text-xs text-green-600 font-medium">
                                                    sem perda
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Bar */}
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="text-sm font-medium text-foreground">{stage.label}</span>
                                                <span className="text-xs text-muted-foreground ml-2">
                                                    ({stage.event_types.join(", ")})
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-bold text-foreground">
                                                    {stage.unique_users.toLocaleString()}
                                                </span>
                                                <span className="text-xs text-muted-foreground ml-1">users</span>
                                            </div>
                                        </div>
                                        <div className="relative h-10 rounded-lg bg-muted overflow-hidden">
                                            <div
                                                className={cn(
                                                    "absolute inset-y-0 left-0 flex items-center justify-end px-3 transition-all",
                                                    idx === 0 ? "bg-primary" :
                                                        idx === data.stages.length - 1 ? "bg-success" : "bg-primary/70"
                                                )}
                                                style={{ width: `${Math.max(widthPct, 5)}%` }}
                                            >
                                                <span className="text-xs font-bold text-primary-foreground">
                                                    {stage.pct_of_base}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}