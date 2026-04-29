// frontend/src/app/(admin)/event-metrics/_components/UserJourneyTab.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Search, User } from "lucide-react";
import { eventMetricsApi, arrayToCsv, downloadCsv } from "@/lib/api/event-metrics";

export function UserJourneyTab() {
    const [searchInput, setSearchInput] = useState("");
    const [activeUserId, setActiveUserId] = useState<string | null>(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ["event-metrics-journey", activeUserId],
        queryFn: () => eventMetricsApi.userJourney(activeUserId!, { limit: 200 }),
        enabled: !!activeUserId,
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchInput.trim()) {
            setActiveUserId(searchInput.trim());
        }
    };

    const handleExport = () => {
        if (!data) return;
        const rows = data.events.map(e => ({
            created_at: e.created_at,
            event_type: e.event_type,
            feature_name: e.feature_name || "",
            target_id: e.target_id || "",
            session_id: e.session_id || "",
            metadata: JSON.stringify(e.metadata),
        }));
        downloadCsv(`user_journey_${data.user_id}.csv`, arrayToCsv(rows));
    };

    return (
        <div className="space-y-3">
            <Card>
                <CardContent className="p-4">
                    <form onSubmit={handleSearch} className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Cole o user_id (UUID)"
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            className="flex-1 text-sm rounded-lg border border-border px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <Button type="submit" size="sm">Buscar</Button>
                    </form>
                </CardContent>
            </Card>

            {!activeUserId && (
                <Card>
                    <CardContent className="p-8 text-center text-sm text-muted-foreground">
                        Insira um user_id para ver a jornada.
                    </CardContent>
                </Card>
            )}

            {isLoading && <Skeleton className="h-96 w-full" />}

            {error && (
                <Card>
                    <CardContent className="p-8 text-center text-sm text-muted-foreground">
                        Usuário não encontrado ou erro ao buscar.
                    </CardContent>
                </Card>
            )}

            {data && (
                <>
                    {/* Header info */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between flex-wrap gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <User className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">{data.user_name}</p>
                                        <p className="text-xs text-muted-foreground">{data.user_email}</p>
                                        <p className="text-xs text-muted-foreground">Tenant: {data.tenant_name}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-foreground">
                                        {data.stats.total_events_all_time.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-muted-foreground">eventos total</p>
                                </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <span className="text-muted-foreground">Primeiro evento:</span>{" "}
                                    <span className="text-foreground">
                                        {data.stats.first_event_at?.split("T")[0] || "-"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Último evento:</span>{" "}
                                    <span className="text-foreground">
                                        {data.stats.last_event_at?.split("T")[0] || "-"}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-3 flex justify-end">
                                <Button size="sm" variant="outline" onClick={handleExport} className="gap-2">
                                    <Download className="h-3.5 w-3.5" />
                                    Exportar CSV
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Timeline */}
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs font-medium text-muted-foreground mb-3">
                                Timeline ({data.events.length} eventos mais recentes)
                            </p>
                            <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                {data.events.map(ev => (
                                    <div key={ev.id} className="border-l-2 border-primary/30 pl-3 py-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-foreground">
                                                {ev.event_type}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(ev.created_at).toLocaleString("pt-BR")}
                                            </span>
                                        </div>
                                        {ev.feature_name && (
                                            <p className="text-xs text-muted-foreground">
                                                feature: {ev.feature_name}
                                            </p>
                                        )}
                                        {Object.keys(ev.metadata).length > 0 && (
                                            <details className="mt-1">
                                                <summary className="text-xs text-primary cursor-pointer hover:underline">
                                                    Ver metadata
                                                </summary>
                                                <pre className="text-[10px] text-muted-foreground mt-1 bg-muted/30 p-2 rounded overflow-x-auto">
                                                    {JSON.stringify(ev.metadata, null, 2)}
                                                </pre>
                                            </details>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}