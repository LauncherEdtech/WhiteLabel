// frontend/src/app/(student)/simulados/page.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { Trophy, XCircle, ClipboardList, Clock, ChevronRight, Play, BarChart2 } from "lucide-react";
import { formatSeconds } from "@/lib/utils/format";
import Link from "next/link";
import type { Simulado } from "@/types/api";

export default function SimuladosPage() {
    const { data, isLoading } = useQuery({
        queryKey: ["simulados"],
        queryFn: async () => {
            const res = await apiClient.get<{ simulados: Simulado[] }>("/simulados/");
            return res.data.simulados;
        },
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-8 w-40 bg-muted rounded animate-pulse" />
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    const simulados = data || [];

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                    Simulados
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Teste seus conhecimentos com tempo limitado
                </p>
            </div>

            {simulados.length === 0 ? (
                <Card>
                    <CardContent className="py-16 flex flex-col items-center gap-3">
                        <ClipboardList className="h-12 w-12 text-muted-foreground" />
                        <p className="font-semibold text-foreground">
                            Nenhum simulado disponível
                        </p>
                        <p className="text-sm text-muted-foreground">
                            O produtor ainda não criou simulados para este curso.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {simulados.map((simulado) => (
                        <SimuladoCard key={simulado.id} simulado={simulado} />
                    ))}
                </div>
            )}
        </div>
    );
}

function SimuladoCard({ simulado }: { simulado: Simulado }) {
    const attempt = simulado.my_attempt;
    const isCompleted = attempt?.status === "completed" || attempt?.status === "timed_out";
    const isInProgress = attempt?.status === "in_progress";

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
                <div className="flex items-start gap-4">
                    <div
                        className={cn(
                            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                            isCompleted
                                ? attempt!.score_percent >= 60
                                    ? "bg-success/10"
                                    : "bg-destructive/10"
                                : "bg-primary/10"
                        )}
                    >
                        {isCompleted ? (
                            attempt!.score_percent >= 60 ? (
                                <Trophy className="h-6 w-6 text-success" />
                            ) : (
                                <XCircle className="h-6 w-6 text-destructive" />
                            )
                        ) : (
                            <ClipboardList className="h-6 w-6 text-primary" />
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground">{simulado.title}</p>
                        {simulado.description && (
                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                                {simulado.description}
                            </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <ClipboardList className="h-3 w-3" />
                                {simulado.total_questions} questões
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {simulado.time_limit_minutes}min
                            </span>
                            {isCompleted && attempt?.total_time_seconds && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <BarChart2 className="h-3 w-3" />
                                    ~{Math.round(attempt.total_time_seconds / attempt.total_questions)}s/questão
                                </span>
                            )}
                            {simulado.is_ai_generated && (
                                <span className="text-xs bg-secondary/10 text-secondary px-1.5 py-0.5 rounded-md font-medium">IA</span>
                            )}
                        </div>
                        {isCompleted && attempt && (
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">
                                    ⏱ Tempo total: {formatSeconds(attempt.total_time_seconds || 0)}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                        {isCompleted && (
                            <div className="text-right">
                                <p
                                    className={cn(
                                        "font-display text-xl font-bold",
                                        attempt!.score_percent >= 60
                                            ? "text-success"
                                            : "text-destructive"
                                    )}
                                >
                                    {attempt!.score_percent}%
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {attempt!.correct_answers}/{attempt!.total_questions}
                                </p>
                            </div>
                        )}
                        <Link href={`/simulados/${simulado.id}`}>
                            <Button
                                size="sm"
                                variant={isCompleted ? "outline" : "default"}
                            >
                                {isInProgress ? (
                                    <>
                                        <Play className="h-3 w-3" />
                                        Continuar
                                    </>
                                ) : isCompleted ? (
                                    <>
                                        Ver resultado
                                        <ChevronRight className="h-3 w-3" />
                                    </>
                                ) : (
                                    <>
                                        <Play className="h-3 w-3" />
                                        Iniciar
                                    </>
                                )}
                            </Button>
                        </Link>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}