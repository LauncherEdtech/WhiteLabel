// frontend/src/app/(producer)/producer/students/page.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api/analytics";
import { Card, CardContent } from "@/components/ui/card";
import { SearchInput } from "@/components/shared/SearchInput";
import { Pagination } from "@/components/shared/Pagination";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { cn } from "@/lib/utils/cn";
import { Users, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";
import { formatRelative } from "@/lib/utils/date";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";

export default function ProducerStudentsPage() {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const debouncedSearch = useDebounce(search, 400);

    const { data, isLoading } = useQuery({
        queryKey: QUERY_KEYS.PRODUCER_STUDENTS({ search: debouncedSearch, page }),
        queryFn: () => analyticsApi.producerStudents({ search: debouncedSearch, page, per_page: 20 }),
    });

    const students = data?.students || [];
    const pagination = data?.pagination;

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">Alunos</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {pagination?.total || 0} alunos cadastrados
                    </p>
                </div>
            </div>

            <SearchInput
                value={search}
                onChange={(v) => { setSearch(v); setPage(1); }}
                placeholder="Buscar por nome ou e-mail..."
                className="max-w-sm"
            />

            {isLoading ? (
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16 rounded-xl" />
                    ))}
                </div>
            ) : students.length === 0 ? (
                <Card>
                    <CardContent className="py-16 flex flex-col items-center gap-3">
                        <Users className="h-12 w-12 text-muted-foreground" />
                        <p className="font-semibold text-foreground">
                            {search ? "Nenhum aluno encontrado" : "Nenhum aluno cadastrado"}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="space-y-2">
                        {students.map((student: {
                            id: string; name: string; email: string;
                            accuracy_rate: number; total_answered: number;
                            last_activity: string | null; is_at_risk: boolean;
                            created_at: string;
                        }) => (
                            <Link key={student.id} href={`/producer/students/${student.id}`}>
                                <Card className="hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                <span className="text-sm font-semibold text-primary">
                                                    {student.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-foreground truncate">{student.name}</p>
                                                    {student.is_at_risk && (
                                                        <Badge variant="warning" className="shrink-0">
                                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                                            risco
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                                            </div>

                                            <div className="hidden sm:flex items-center gap-6 text-sm">
                                                <div className="text-center">
                                                    <p className={cn(
                                                        "font-display font-bold",
                                                        student.accuracy_rate >= 70 ? "text-success" :
                                                            student.accuracy_rate >= 50 ? "text-warning" : "text-destructive"
                                                    )}>
                                                        {student.accuracy_rate}%
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">Acerto</p>
                                                </div>

                                                <div className="text-center">
                                                    <p className="font-display font-bold text-foreground">{student.total_answered}</p>
                                                    <p className="text-xs text-muted-foreground">Questões</p>
                                                </div>

                                                <div className="text-center">
                                                    <p className="text-xs text-foreground flex items-center gap-1">
                                                        <Clock className="h-3 w-3 text-muted-foreground" />
                                                        {student.last_activity
                                                            ? formatRelative(student.last_activity)
                                                            : "sem atividade"}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">última atividade</p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>

                    {pagination && (
                        <Pagination
                            page={pagination.page}
                            pages={pagination.pages}
                            onPageChange={setPage}
                        />
                    )}
                </>
            )}
        </div>
    );
}