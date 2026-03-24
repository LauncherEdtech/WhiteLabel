// frontend/src/app/(producer)/producer/analytics/page.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { analyticsApi } from "@/lib/api/analytics";
import { useProducerOverview } from "@/lib/hooks/useAnalytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import {
  Users, TrendingUp, AlertTriangle, Target,
  BookOpen, Eye, Trophy, ChevronDown, ChevronUp,
  BarChart3, AlertCircle, UserX, Clock,
} from "lucide-react";
import { formatRelative } from "@/lib/utils/date";

// ── Types ──────────────────────────────────────────────────────────────────

interface LessonRow {
  lesson_id: string;
  lesson_title: string;
  module_name: string;
  subject_name: string;
  subject_color: string;
  course_name: string;
  duration_min: number;
  watched_count: number;
  enrolled_count: number;
  completion_pct: number;
}

interface CourseStats {
  course_id: string;
  course_name: string;
  total_lessons: number;
  enrolled_count: number;
  avg_completion: number;
  lessons: LessonRow[];
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function CompletionBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(pct, 100)}%`,
            backgroundColor:
              pct >= 70 ? "#10B981" :
                pct >= 40 ? "#F59E0B" : "#EF4444",
          }}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-10 text-right">{pct}%</span>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, color = "primary" }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  const colors: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
    secondary: "bg-secondary/10 text-secondary",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", colors[color] ?? colors.primary)}>
            {icon}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-display text-xl font-bold text-foreground leading-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Tab: Visão Geral ───────────────────────────────────────────────────────

function OverviewTab({ data }: { data: any }) {
  const overview = data?.overview ?? data ?? {};
  const atRisk = data?.at_risk_students ?? [];
  const disciplineStats = data?.class_discipline_performance ?? [];
  const hardestQuestions = data?.hardest_questions ?? [];
  const studentRankings = data?.student_rankings ?? { top_performers: [], needs_attention: [] };
  const insights = data?.insights ?? [];

  return (
    <div className="space-y-6">
      {/* Métricas principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={<Users className="h-5 w-5" />}
          label="Total de alunos" value={overview.total_students ?? 0} color="primary" />
        <MetricCard icon={<TrendingUp className="h-5 w-5" />}
          label="Engajamento (7d)" value={`${overview.engagement_rate ?? 0}%`}
          sub={`${overview.active_last_7_days ?? 0} ativos`} color="success" />
        <MetricCard icon={<AlertTriangle className="h-5 w-5" />}
          label="Em risco" value={overview.at_risk_count ?? 0}
          sub="risco de abandono"
          color={(overview.at_risk_count ?? 0) > 0 ? "warning" : "success"} />
        <MetricCard icon={<Target className="h-5 w-5" />}
          label="Acerto médio" value={`${overview.avg_accuracy ?? 0}%`}
          sub={`${overview.total_questions_answered ?? 0} questões`} color="primary" />
      </div>

      {/* Disciplinas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Performance por disciplina — turma completa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {disciplineStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum dado ainda. Aguarde os alunos responderem questões.
            </p>
          ) : disciplineStats.map((d: any) => (
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

      {/* Rankings */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top performers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warning" /> Top performers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {studentRankings.top_performers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem dados suficientes</p>
            ) : studentRankings.top_performers.map((s: any, i: number) => (
              <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30">
                <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-primary">{s.name?.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.total_answered} questões</p>
                </div>
                <span className="text-sm font-bold text-success">{s.accuracy_rate}%</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Precisam de atenção */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserX className="h-4 w-4 text-destructive" /> Precisam de atenção
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {studentRankings.needs_attention.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Todos os alunos estão bem!</p>
            ) : studentRankings.needs_attention.map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30">
                <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-destructive">{s.name?.charAt(0)}</span>
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
          </CardContent>
        </Card>
      </div>

      {/* Questões difíceis */}
      {hardestQuestions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Questões com menor taxa de acerto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {hardestQuestions.map((q: any, i: number) => (
              <div key={q.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                <span className="text-xs font-bold text-muted-foreground mt-0.5 w-4 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground line-clamp-2">{q.statement_preview}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {q.discipline && <Badge variant="outline" className="text-xs">{q.discipline}</Badge>}
                    <span className="text-xs text-muted-foreground">{q.total_attempts} tentativas</span>
                  </div>
                </div>
                <span className="text-sm font-bold text-destructive shrink-0">{q.accuracy_rate}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Alunos em risco */}
      {atRisk.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Alunos em risco de abandono
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {atRisk.map((s: any) => (
              <div key={s.id} className="p-4 rounded-xl border border-warning/30 bg-warning/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-warning/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-warning">{s.name?.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </div>
                  </div>
                  <Badge variant={s.risk_level === "alto" ? "destructive" : "warning"}>
                    {s.risk_level ?? "alto"}
                  </Badge>
                </div>
                {s.risk_reasons && (
                  <div className="space-y-1 mb-3">
                    {s.risk_reasons.map((reason: string, i: number) => (
                      <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                        <span className="text-warning mt-0.5">•</span>{reason}
                      </p>
                    ))}
                  </div>
                )}
                <ProgressBar
                  value={(s.risk_score ?? 0.5) * 100}
                  color={(s.risk_score ?? 0.5) >= 0.7 ? "destructive" : "warning"}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {insights.length > 0 && (
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
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.message}</p>
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

// ── Tab: Aulas ─────────────────────────────────────────────────────────────

function LessonsTab({ courseId, onCourseChange, courses }: {
  courseId: string;
  onCourseChange: (id: string) => void;
  courses: any[];
}) {
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "producer", "lessons", courseId],
    queryFn: () => apiClient.get("/analytics/producer/lessons", {
      params: courseId ? { course_id: courseId } : {},
    }).then(r => r.data),
  });

  if (isLoading) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  }

  if (!data) return null;

  const { total_lessons, courses: courseStats, top_watched_lessons, low_watched_lessons } = data;

  return (
    <div className="space-y-5">
      {/* Filtro por curso */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => onCourseChange("")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
            !courseId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
          )}>
          Todos os cursos
        </button>
        {courses.map((c: any) => (
          <button key={c.id} onClick={() => onCourseChange(c.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              courseId === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}>
            {c.name}
          </button>
        ))}
      </div>

      {/* Métricas de aulas */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard icon={<BookOpen className="h-5 w-5" />} label="Total de aulas" value={total_lessons ?? 0} color="primary" />
        <MetricCard
          icon={<Eye className="h-5 w-5" />}
          label="Mais assistida"
          value={top_watched_lessons?.[0] ? `${top_watched_lessons[0].completion_pct}%` : "—"}
          sub={top_watched_lessons?.[0]?.lesson_title?.slice(0, 28)}
          color="success"
        />
        <MetricCard
          icon={<AlertCircle className="h-5 w-5" />}
          label="Menos assistida"
          value={low_watched_lessons?.[0] ? `${low_watched_lessons[0].completion_pct}%` : "—"}
          sub={low_watched_lessons?.[0]?.lesson_title?.slice(0, 28)}
          color="warning"
        />
      </div>

      {/* Top 5 mais / menos assistidas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-success">
              <Trophy className="h-4 w-4" /> Mais assistidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(top_watched_lessons ?? []).length === 0
              ? <p className="text-xs text-muted-foreground">Sem dados ainda.</p>
              : (top_watched_lessons ?? []).map((lesson: LessonRow, i: number) => (
                <div key={lesson.lesson_id} className="space-y-1">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-4 mt-0.5">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{lesson.lesson_title}</p>
                      <p className="text-[10px] text-muted-foreground">{lesson.subject_name} · {lesson.course_name}</p>
                    </div>
                    <span className="text-xs text-success font-medium shrink-0">
                      {lesson.watched_count}/{lesson.enrolled_count}
                    </span>
                  </div>
                  <CompletionBar pct={lesson.completion_pct} />
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-warning">
              <AlertCircle className="h-4 w-4" /> Menos assistidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(low_watched_lessons ?? []).length === 0
              ? <p className="text-xs text-muted-foreground">Sem dados ainda.</p>
              : (low_watched_lessons ?? []).map((lesson: LessonRow, i: number) => (
                <div key={lesson.lesson_id} className="space-y-1">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-4 mt-0.5">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{lesson.lesson_title}</p>
                      <p className="text-[10px] text-muted-foreground">{lesson.subject_name} · {lesson.course_name}</p>
                    </div>
                    <span className="text-xs text-warning font-medium shrink-0">
                      {lesson.watched_count}/{lesson.enrolled_count}
                    </span>
                  </div>
                  <CompletionBar pct={lesson.completion_pct} />
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      {/* Progresso por curso (expansível) */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Progresso por curso</h3>
        {(courseStats ?? []).map((cs: CourseStats) => (
          <Card key={cs.course_id} className="overflow-hidden">
            <button
              onClick={() => setExpandedCourse(expandedCourse === cs.course_id ? null : cs.course_id)}
              className="w-full p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors text-left"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{cs.course_name}</p>
                  <Badge variant="outline" className="text-[10px]">{cs.total_lessons} aulas</Badge>
                  <Badge variant="outline" className="text-[10px]">{cs.enrolled_count} alunos</Badge>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 max-w-xs"><CompletionBar pct={cs.avg_completion} /></div>
                  <span className="text-xs text-muted-foreground">conclusão média</span>
                </div>
              </div>
              {expandedCourse === cs.course_id
                ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              }
            </button>

            {expandedCourse === cs.course_id && (
              <div className="border-t border-border">
                {cs.lessons.length === 0
                  ? <p className="p-4 text-xs text-muted-foreground">Nenhuma aula publicada.</p>
                  : cs.lessons.map((lesson) => (
                    <div key={lesson.lesson_id}
                      className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-0 hover:bg-muted/20">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: lesson.subject_color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{lesson.lesson_title}</p>
                        <p className="text-[10px] text-muted-foreground">{lesson.subject_name} · {lesson.module_name}</p>
                      </div>
                      <div className="w-28 shrink-0"><CompletionBar pct={lesson.completion_pct} /></div>
                      <span className="text-[10px] text-muted-foreground shrink-0 w-16 text-right">
                        {lesson.watched_count}/{lesson.enrolled_count}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Alunos ────────────────────────────────────────────────────────────

function StudentsTab({ data }: { data: any }) {
  const students = data?.students ?? [];

  return (
    <div className="space-y-3">
      {students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum aluno cadastrado ainda.
          </CardContent>
        </Card>
      ) : students.map((s: any) => (
        <Card key={s.id}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">{s.name?.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.email}</p>
                {s.last_activity && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {formatRelative(s.last_activity)}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4 text-center shrink-0">
                <div>
                  <p className={cn(
                    "text-sm font-bold",
                    (s.accuracy_rate ?? 0) >= 60 ? "text-success" :
                      (s.accuracy_rate ?? 0) >= 40 ? "text-warning" : "text-destructive"
                  )}>
                    {s.accuracy_rate ?? 0}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">acerto</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{s.total_answered ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">questões</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{s.lessons_watched ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">aulas</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Visão Geral", icon: BarChart3 },
  { id: "lessons", label: "Aulas", icon: BookOpen },
  { id: "students", label: "Alunos", icon: Users },
];

export default function ProducerAnalyticsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCourse, setSelectedCourse] = useState("");

  const { data: overviewData, isLoading: overviewLoading } = useProducerOverview();

  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ["producer", "students", "analytics"],
    queryFn: () => analyticsApi.producerStudents({ per_page: 100 }),
    enabled: activeTab === "students",
  });

  const { data: coursesData } = useQuery({
    queryKey: ["courses", "producer"],
    queryFn: () => apiClient.get("/courses/").then(r => r.data),
  });

  const courses = coursesData?.courses ?? [];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Visão detalhada do desempenho da sua turma</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo */}
      {overviewLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : (
        <>
          {activeTab === "overview" && <OverviewTab data={overviewData} />}
          {activeTab === "lessons" && (
            <LessonsTab
              courseId={selectedCourse}
              onCourseChange={setSelectedCourse}
              courses={courses}
            />
          )}
          {activeTab === "students" && (
            studentsLoading
              ? <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
              : <StudentsTab data={studentsData} />
          )}
        </>
      )}
    </div>
  );
}