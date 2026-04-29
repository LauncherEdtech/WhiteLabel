// frontend/src/app/(admin)/event-metrics/page.tsx
"use client";

import { useState } from "react";
import { useAuthStore } from "@/lib/stores/authStore";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, BarChart3, Filter, Users, Search } from "lucide-react";
import { HeatmapTab } from "./_components/HeatmapTab";
import { FunnelTab } from "./_components/FunnelTab";
import { CohortTab } from "./_components/CohortTab";
import { UserJourneyTab } from "./_components/UserJourneyTab";

// Default: últimos 30 dias
function defaultStart(): string {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().split("T")[0];
}
function defaultEnd(): string {
    return new Date().toISOString().split("T")[0];
}

export default function EventMetricsPage() {
    const { user } = useAuthStore();
    const [startDate, setStartDate] = useState(defaultStart());
    const [endDate, setEndDate] = useState(defaultEnd());
    const [tab, setTab] = useState("heatmap");

    // Bloqueio de acesso
    if (user && user.role !== "super_admin") {
        return (
            <div className="max-w-2xl mx-auto p-8">
                <Card>
                    <CardContent className="p-8 text-center">
                        <h1 className="text-xl font-bold text-foreground mb-2">Acesso negado</h1>
                        <p className="text-sm text-muted-foreground">
                            Esta página é restrita a super administradores.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-display font-bold text-foreground">Event Metrics</h1>
                <p className="text-sm text-muted-foreground">
                    Análise de uso real para decisões de produto e marketplace.
                </p>
            </div>

            {/* Filtros sticky */}
            <Card>
                <CardContent className="p-4 flex flex-wrap items-center gap-3">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Período:</span>
                    <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="text-sm rounded-lg border border-border px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <span className="text-xs text-muted-foreground">até</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="text-sm rounded-lg border border-border px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <div className="flex-1" />
                    <span className="text-xs text-muted-foreground">
                        {tab === "user-journey"
                            ? "Filtros não se aplicam ao User Journey"
                            : tab === "cohort"
                                ? "Cohort usa janela de semanas"
                                : "Filtros aplicados a todas as visualizações"}
                    </span>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                    <TabsTrigger value="heatmap" className="gap-2">
                        <BarChart3 className="h-4 w-4" /> Heatmap
                    </TabsTrigger>
                    <TabsTrigger value="funnel" className="gap-2">
                        <Calendar className="h-4 w-4" /> Funnel
                    </TabsTrigger>
                    <TabsTrigger value="cohort" className="gap-2">
                        <Users className="h-4 w-4" /> Cohort
                    </TabsTrigger>
                    <TabsTrigger value="user-journey" className="gap-2">
                        <Search className="h-4 w-4" /> User Journey
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="heatmap" className="mt-4">
                    <HeatmapTab startDate={startDate} endDate={endDate} />
                </TabsContent>

                <TabsContent value="funnel" className="mt-4">
                    <FunnelTab startDate={startDate} endDate={endDate} />
                </TabsContent>

                <TabsContent value="cohort" className="mt-4">
                    <CohortTab />
                </TabsContent>

                <TabsContent value="user-journey" className="mt-4">
                    <UserJourneyTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}