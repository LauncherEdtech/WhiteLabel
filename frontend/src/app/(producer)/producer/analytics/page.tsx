// frontend/src/app/(producer)/producer/analytics/page.tsx
"use client";

import { useProducerOverview } from "@/lib/hooks/useAnalytics";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import {
  Users, TrendingUp, AlertTriangle, Target,
  BarChart3, Clock, Trophy, UserX,
} from "lucide-react";
import { formatRelative } from "@/lib/utils/date";

export default function ProducerAnalyticsPage() {
  const { data, isLoading } = useProducerOverview();
  const { data: studentsData } = useQuery({
    queryKey: ["producer", "students", "all"],
    queryFn: () => analyticsApi.producerStudents({ per_page: 50 }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (isLoading || !data || !data.overview) return (
        <div className="space-y-6 animate-pulse">
            <div className="h-8 w-40 bg-muted rounded" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl" />)}
            </div>
        </div>
    );

  const { overview, at_risk_students, class_discipline_performance, hardest_questions, student_rankings, insights } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Visão detalhada do desempenho da sua turma
        </p>
      </div>

      {/* Métricas principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        {[
          { icon: <Users className="h-5 w-5" />, label: "Total alunos", value: overview.total_students, color: "primary" },
          { icon: <TrendingUp className="h-5 w-5" />, label: "Engajamento", value: `${overview.engagement_rate}%`, sub: "últimos 7 dias", color: "success" },
          { icon: <AlertTriangle className="h-5 w-5" />, label: "Em risco", value: overview.at_risk_count, color: overview.at_risk_count > 0 ? "warning" : "success" },
          { icon: <Target className="h-5 w-5" />, label: "Ativos hoje", value: overview.active_last_7_days, color: "secondary" },
        ].map(({ icon, label, value, sub, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center mb-3",
                `bg-${color}/10 text-${color}`
              )}>
                {icon}
              </div>
              <p className="text-2xl font-display font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              {sub && <p className="text-xs text-muted-foreground/70">{sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="disciplines">
        <TabsList>
          <TabsTrigger value="disciplines">Disciplinas</TabsTrigger>
          <TabsTrigger value="students">Alunos</TabsTrigger>
          <TabsTrigger value="questions">Questões difíceis</TabsTrigger>
          {at_risk_students.length > 0 && (
            <TabsTrigger value="risk" className="text-warning">
              Em risco ({at_risk_students.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* Disciplinas */}
        <TabsContent value="disciplines" className="space-y-3 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance por disciplina — turma completa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {class_discipline_performance.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum dado ainda. Aguarde os alunos responderem questões.
                </p>
              ) : class_discipline_performance.map((d: any) => (
                <div key={d.discipline} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{d.discipline}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{d.total_attempts} tentativas</span>
                      <span className={cn(
                        "text-sm font-bold",
                        d.accuracy_rate >= 70 ? "text-success" :
                          d.accuracy_rate >= 50 ? "text-warning" : "text-destructive"
                      )}>
                        {d.accuracy_rate}%
                      </span>
                    </div>
                  </div>
                  <ProgressBar
                    value={d.accuracy_rate}
                    color={d.accuracy_rate >= 70 ? "success" : d.accuracy_rate >= 50 ? "warning" : "destructive"}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alunos */}
        <TabsContent value="students" className="mt-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-warning" /> Top performers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {student_rankings.top_performers.map((s: any, i: number) => (
                  <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg">
                    <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-primary">{s.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.total_answered} questões</p>
                    </div>
                    <span className="text-sm font-bold text-success">{s.accuracy_rate}%</span>
                  </div>
                ))}
                {student_rankings.top_performers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem dados suficientes</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <UserX className="h-4 w-4 text-destructive" /> Precisam de atenção
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {student_rankings.needs_attention.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg">
                    <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-destructive">{s.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.last_activity ? formatRelative(s.last_activity) : "sem atividade"}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-destructive">{s.accuracy_rate}%</span>
                  </div>
                ))}
                {student_rankings.needs_attention.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Todos os alunos estão bem!
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Questões difíceis */}
        <TabsContent value="questions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Questões com menor taxa de acerto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {hardest_questions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma questão com tentativas suficientes ainda.
                </p>
              ) : hardest_questions.map((q: any, i: number) => (
                <div key={q.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <span className="text-xs font-bold text-muted-foreground mt-0.5 w-4 shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground line-clamp-2">{q.statement_preview}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {q.discipline && (
                        <Badge variant="outline" className="text-xs">{q.discipline}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {q.total_attempts} tentativas
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-destructive shrink-0">
                    {q.accuracy_rate}%
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Em risco */}
        {at_risk_students.length > 0 && (
          <TabsContent value="risk" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Alunos em risco de abandono</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {at_risk_students.map((s: any) => (
                  <div key={s.id} className="p-4 rounded-xl border border-warning/30 bg-warning/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-warning/20 flex items-center justify-center">
                          <span className="text-xs font-bold text-warning">{s.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.email}</p>
                        </div>
                      </div>
                      <Badge variant={s.risk_level === "alto" ? "destructive" : "warning"}>
                        {s.risk_level}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {s.risk_reasons.map((reason: string, i: number) => (
                        <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                          <span className="text-warning mt-0.5">•</span>
                          {reason}
                        </p>
                      ))}
                    </div>
                    <ProgressBar
                      value={s.risk_score * 100}
                      color={s.risk_score >= 0.7 ? "destructive" : "warning"}
                      className="mt-3"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Insights */}
      {insights?.length > 0 && (
        <div>
          <h2 className="font-display font-semibold text-base text-foreground mb-3">
            💡 Insights automáticos
          </h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {insights.map((insight: any, i: number) => (
              <Card key={i} className={cn(
                "border-l-4",
                insight.type === "alert" ? "border-l-destructive" :
                  insight.type === "warning" ? "border-l-warning" :
                    insight.type === "positive" ? "border-l-success" : "border-l-primary"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">{insight.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {insight.message}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}