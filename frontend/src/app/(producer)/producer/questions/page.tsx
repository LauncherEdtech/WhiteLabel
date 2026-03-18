// frontend/src/app/(producer)/producer/questions/page.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { questionsApi } from "@/lib/api/questions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/shared/SearchInput";
import { DifficultyBadge } from "@/components/shared/DifficultyBadge";
import { Pagination } from "@/components/shared/Pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useToast } from "@/components/ui/toaster";
import { apiClient } from "@/lib/api/client";
import {
  HelpCircle, Plus, Pencil, Trash2,
  CheckCircle2, Target, Clock,
} from "lucide-react";
import Link from "next/link";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";
import type { Question } from "@/types/api";

export default function ProducerQuestionsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 400);
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.QUESTIONS({ discipline: debouncedSearch || undefined, page }),
    queryFn: () => questionsApi.list({
      discipline: debouncedSearch || undefined,
      page,
      per_page: 20,
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/questions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions"] });
      toast.success("Questão removida.");
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao remover questão"),
  });

  const questions: Question[] = data?.questions || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Questões</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pagination?.total || 0} questões no banco
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/producer/questions/import">
            <Button variant="outline" size="sm">
              🤖 Importar com IA
            </Button>
          </Link>
          <Link href="/producer/questions/new">
            <Button size="sm">
              <Plus className="h-4 w-4" /> Nova questão
            </Button>
          </Link>
        </div>
      </div>

      <SearchInput
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
        placeholder="Buscar por disciplina..."
        className="max-w-sm"
      />

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : questions.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3">
            <HelpCircle className="h-10 w-10 text-muted-foreground" />
            <p className="font-semibold text-foreground">
              {search ? "Nenhuma questão encontrada" : "Nenhuma questão ainda"}
            </p>
            <Link href="/producer/questions/new">
              <Button><Plus className="h-4 w-4" /> Criar primeira questão</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {questions.map((q: Question) => (
              <Card key={q.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-2">
                        {q.statement}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {q.difficulty && <DifficultyBadge difficulty={q.difficulty} />}
                        {q.discipline && (
                          <Badge variant="outline" className="text-xs">{q.discipline}</Badge>
                        )}
                        {q.exam_board && (
                          <span className="text-xs text-muted-foreground">{q.exam_board} {q.exam_year}</span>
                        )}
                        {q.stats.total_attempts > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {q.stats.accuracy_rate}% acerto
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link href={`/producer/questions/${q.id}/edit`}>
                        <Button variant="ghost" size="icon-sm">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost" size="icon-sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteId(q.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {pagination && (
            <Pagination page={pagination.page} pages={pagination.pages} onPageChange={setPage} />
          )}
        </>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="Remover questão?"
        description="Esta ação não pode ser desfeita. O histórico de tentativas será mantido."
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}