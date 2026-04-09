// frontend/src/app/(producer)/producer/settings/gamification/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { useToast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { Save, Loader2, ChevronLeft, Swords, Scale, Shield, Calculator, Building2, HeartPulse } from "lucide-react";
import Link from "next/link";

// ── Definição local dos temas (espelha o backend) ────────────────────────────

const THEMES = [
    {
        key: "militar",
        label: "Militar",
        icon: Swords,
        color: "text-amber-600 bg-amber-50 border-amber-200",
        activeColor: "border-amber-500 bg-amber-50",
        description: "Para concursos das Forças Armadas e Polícias Militares",
        tags: ["EsPCEx", "IME", "AMAN", "PM"],
        ranks: ["Recruta", "Soldado", "Cabo", "Sargento", "Tenente", "Capitão", "Major", "Coronel", "General"],
        insightExamples: [
            { type: "motivation", icon: "🎯", title: "Missão em andamento", message: "Soldado, você completou 73% da missão semanal. Faltam apenas 27 minutos de instrução." },
            { type: "weakness", icon: "⚠️", title: "Vulnerabilidade tática", message: "Direito Penal com 38% de acerto. Reforce essa posição antes do combate final." },
            { type: "next_step", icon: "📌", title: "Próxima ordem", message: "Execute 15 questões de Direito Constitucional hoje. A ordem é clara, Sargento." },
        ],
    },
    {
        key: "policial",
        label: "Policial",
        icon: Shield,
        color: "text-blue-600 bg-blue-50 border-blue-200",
        activeColor: "border-blue-500 bg-blue-50",
        description: "Para Polícia Civil, Federal, PRF e Guardas Municipais",
        tags: ["PC", "PF", "PRF", "GM"],
        ranks: ["Recruta", "Investigador", "Inspetor", "Delegado", "Del.-Chefe", "Del. Regional", "Superintendente", "Diretor", "Delegado-Geral"],
        insightExamples: [
            { type: "motivation", icon: "🎯", title: "Caso em andamento", message: "Investigador, sua taxa de 71% coloca você entre os 30% mais eficientes da turma." },
            { type: "weakness", icon: "⚠️", title: "Pista não elucidada", message: "Processo Penal com 41% de acerto. Essa lacuna pode comprometer a conclusão do caso." },
            { type: "next_step", icon: "📌", title: "Próxima diligência", message: "Revise os últimos 3 erros de Direito Administrativo. Os detalhes fazem diferença no inquérito." },
        ],
    },
    {
        key: "juridico",
        label: "Jurídico",
        icon: Scale,
        color: "text-indigo-600 bg-indigo-50 border-indigo-200",
        activeColor: "border-indigo-500 bg-indigo-50",
        description: "Para Magistratura, Ministério Público, OAB e PGE",
        tags: ["Magistratura", "MP", "OAB", "PGE"],
        ranks: ["Estagiário", "Bacharel", "Advogado", "Promotor", "Juiz Substituto", "Juiz", "Desembargador", "Ministro", "Pres. STF"],
        insightExamples: [
            { type: "motivation", icon: "🎯", title: "Jurisprudência firmada", message: "Bacharel, você acertou 68% esta semana — sua jurisprudência pessoal está se consolidando." },
            { type: "weakness", icon: "⚠️", title: "Tese não consolidada", message: "Direito Constitucional com 44%. Esse fundamento precisa ser reforçado antes da prova." },
            { type: "next_step", icon: "📌", title: "Próximo fundamento", message: "Revise os últimos acórdãos de Direito Administrativo. A doutrina moderna é cobrada na prova." },
        ],
    },
    {
        key: "fiscal",
        label: "Fiscal",
        icon: Calculator,
        color: "text-emerald-600 bg-emerald-50 border-emerald-200",
        activeColor: "border-emerald-500 bg-emerald-50",
        description: "Para Receita Federal, SEFAZ, TCU e Controladoria",
        tags: ["RFB", "SEFAZ", "TCU", "CGU"],
        ranks: ["Aprendiz", "Assistente", "Analista", "Auditor Jr.", "Auditor-Fiscal", "Auditor Sênior", "Auditor-Chefe", "Superintendente", "Secretário RFB"],
        insightExamples: [
            { type: "motivation", icon: "🎯", title: "Conformidade fiscal", message: "Analista, seu desempenho de 71% indica conformidade crescente. Mantenha o padrão de auditoria." },
            { type: "weakness", icon: "⚠️", title: "Inconsistência detectada", message: "Direito Tributário com 39% de acerto. Essa inconsistência pode comprometer seu relatório final." },
            { type: "next_step", icon: "📌", title: "Próximo lançamento", message: "Execute 20 questões de Contabilidade Pública hoje. O próximo lançamento exige precisão." },
        ],
    },
    {
        key: "administrativo",
        label: "Administrativo",
        icon: Building2,
        color: "text-violet-600 bg-violet-50 border-violet-200",
        activeColor: "border-violet-500 bg-violet-50",
        description: "Para INSS, Banco do Brasil, Correios, Câmara e Senado",
        tags: ["INSS", "BB", "Correios", "Câmara"],
        ranks: ["Trainee", "Assistente", "Analista Jr.", "Analista Pleno", "Analista Sênior", "Coordenador", "Gerente", "Diretor", "Presidente"],
        insightExamples: [
            { type: "motivation", icon: "🎯", title: "Meta atingida", message: "Analista, você entregou 73% da meta semanal de estudos. Faltam apenas 27 minutos para fechar o ciclo." },
            { type: "weakness", icon: "⚠️", title: "Gap identificado", message: "Administração Pública com 41% de acerto. Esse gap compromete sua entrega final no concurso." },
            { type: "next_step", icon: "📌", title: "Próxima entrega", message: "Resolva 15 questões de Português hoje. A próxima entrega depende desse resultado." },
        ],
    },
    {
        key: "saude",
        label: "Saúde",
        icon: HeartPulse,
        color: "text-rose-600 bg-rose-50 border-rose-200",
        activeColor: "border-rose-500 bg-rose-50",
        description: "Para ANVISA, ANS, hospitais públicos e saúde municipal",
        tags: ["ANVISA", "ANS", "SMS", "SUS"],
        ranks: ["Estagiário", "Técnico", "Auxiliar", "Especialista", "Supervisor", "Coordenador", "Gerente", "Diretor", "Secretário"],
        insightExamples: [
            { type: "motivation", icon: "🎯", title: "Protocolo cumprido", message: "Especialista, você cumpriu 73% do protocolo semanal de estudos. Indicadores positivos." },
            { type: "weakness", icon: "⚠️", title: "Indicador abaixo", message: "Epidemiologia com 38% de acerto. Esse indicador abaixo do esperado precisa de atenção imediata." },
            { type: "next_step", icon: "📌", title: "Próxima prescrição", message: "Prescrição de estudos: 15 questões de Saúde Pública. A evidência exige essa prática diária." },
        ],
    },
];

const INSIGHT_TYPE_COLORS: Record<string, string> = {
    motivation: "border-l-emerald-400 bg-emerald-50/50",
    weakness: "border-l-amber-400 bg-amber-50/50",
    next_step: "border-l-blue-400 bg-blue-50/50",
};

// ── Componente ────────────────────────────────────────────────────────────────

export default function GamificationSettingsPage() {
    const { tenant, setTenant } = useTenantStore();
    const toast = useToast();

    const currentSettings = (tenant?.settings ?? {}) as unknown as Record<string, string>;

    const [insightTheme, setInsightTheme] = useState(currentSettings.insight_theme ?? "militar");
    const [gamificationTheme, setGamificationTheme] = useState(currentSettings.gamification_theme ?? "militar");
    const [previewTheme, setPreviewTheme] = useState<string | null>(null);

    // Sincroniza quando o tenant carrega
    useEffect(() => {
        if (tenant?.settings) {
            const s = tenant.settings as unknown as Record<string, string>;
            setInsightTheme(s.insight_theme ?? "militar");
            setGamificationTheme(s.gamification_theme ?? "militar");
        }
    }, [tenant]);

    const saveMutation = useMutation({
        mutationFn: () =>
            apiClient.put(`/tenants/${tenant!.id}/settings`, {
                insight_theme: insightTheme,
                gamification_theme: gamificationTheme,
            }),
        onSuccess: (res) => {
            // Atualiza o store local
            if (tenant) {
                setTenant({
                    ...tenant,
                    settings: { ...(tenant.settings ?? {}), ...res.data.settings },
                });
            }
            toast.success("Configurações salvas", "Temas de insights e gamificação atualizados.");
        },
        onError: () => {
            toast.error("Erro ao salvar", "Tente novamente.");
        },
    });

    const isDirty =
        insightTheme !== (currentSettings.insight_theme ?? "militar") ||
        gamificationTheme !== (currentSettings.gamification_theme ?? "militar");

    const previewData = THEMES.find(t => t.key === (previewTheme ?? insightTheme));
    const gamificationData = THEMES.find(t => t.key === gamificationTheme);

    return (
        <div className="max-w-2xl space-y-8 animate-fade-in">
            {/* Cabeçalho */}
            <div className="flex items-center gap-3">
                <Link href="/producer/settings" className="text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">Gamificação & Insights</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Personalize a linguagem da IA e as patentes dos seus alunos
                    </p>
                </div>
            </div>

            {/* ── Seção 1: Tema dos Insights ─────────────────────────────────── */}
            <section className="space-y-4">
                <div>
                    <h2 className="text-base font-semibold text-foreground">Linguagem dos Insights da IA</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        O Gemini vai gerar mensagens personalizadas com a linguagem do nicho dos seus alunos.
                    </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {THEMES.map((theme) => {
                        const Icon = theme.icon;
                        const isSelected = insightTheme === theme.key;
                        return (
                            <button
                                key={theme.key}
                                onClick={() => { setInsightTheme(theme.key); setPreviewTheme(theme.key); }}
                                onMouseEnter={() => setPreviewTheme(theme.key)}
                                onMouseLeave={() => setPreviewTheme(null)}
                                className={cn(
                                    "flex flex-col items-start gap-2 p-3 rounded-xl border-2 text-left transition-all",
                                    isSelected
                                        ? theme.activeColor + " border-2"
                                        : "border-border bg-background hover:border-border/80 hover:bg-muted/30"
                                )}
                            >
                                <div className={cn("h-8 w-8 rounded-lg border flex items-center justify-center", theme.color)}>
                                    <Icon className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">{theme.label}</p>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {theme.tags.slice(0, 2).map(tag => (
                                            <span key={tag} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Preview dos insights */}
                {previewData && (
                    <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Preview — como os alunos vão receber os insights</span>
                            <span className="ml-auto text-xs font-semibold text-foreground">{previewData.label}</span>
                        </div>
                        <div className="p-4 space-y-2">
                            {previewData.insightExamples.map((ex, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "flex items-start gap-3 p-3 rounded-lg border-l-4",
                                        INSIGHT_TYPE_COLORS[ex.type]
                                    )}
                                >
                                    <span className="text-lg shrink-0">{ex.icon}</span>
                                    <div>
                                        <p className="text-xs font-semibold text-foreground">{ex.title}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ex.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* ── Seção 2: Tema da Gamificação ───────────────────────────────── */}
            <section className="space-y-4">
                <div>
                    <h2 className="text-base font-semibold text-foreground">Hierarquia de Patentes</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Os alunos sobem de patente conforme acumulam pontos. Escolha a progressão do seu nicho.
                    </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {THEMES.map((theme) => {
                        const Icon = theme.icon;
                        const isSelected = gamificationTheme === theme.key;
                        return (
                            <button
                                key={theme.key}
                                onClick={() => setGamificationTheme(theme.key)}
                                className={cn(
                                    "flex flex-col items-start gap-2 p-3 rounded-xl border-2 text-left transition-all",
                                    isSelected
                                        ? theme.activeColor + " border-2"
                                        : "border-border bg-background hover:border-border/80 hover:bg-muted/30"
                                )}
                            >
                                <div className={cn("h-8 w-8 rounded-lg border flex items-center justify-center", theme.color)}>
                                    <Icon className="h-4 w-4" />
                                </div>
                                <p className="text-sm font-semibold text-foreground">{theme.label}</p>
                            </button>
                        );
                    })}
                </div>

                {/* Preview das patentes */}
                {gamificationData && (
                    <div className="rounded-xl border border-border overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Progressão de patentes — {gamificationData.label}</span>
                        </div>
                        <div className="divide-y divide-border">
                            {gamificationData.ranks.map((rank, i) => {
                                const pts = [0, 100, 300, 600, 1000, 1600, 2500, 4000, 6000][i];
                                const isLast = i === gamificationData.ranks.length - 1;
                                return (
                                    <div key={rank} className={cn("flex items-center gap-3 px-4 py-2.5", isLast && "bg-amber-50/50")}>
                                        <span className={cn(
                                            "text-xs font-mono font-bold w-5 text-center",
                                            isLast ? "text-amber-600" : "text-muted-foreground"
                                        )}>
                                            {i + 1}
                                        </span>
                                        <p className={cn("text-sm font-medium flex-1", isLast ? "text-amber-700 font-bold" : "text-foreground")}>
                                            {rank}
                                        </p>
                                        <span className="text-xs text-muted-foreground font-mono">
                                            {pts.toLocaleString("pt-BR")} pts
                                        </span>
                                        {isLast && <span className="text-amber-500">👑</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </section>

            {/* ── Aviso de independência dos temas ───────────────────────────── */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Dica: os temas são independentes</p>
                Você pode usar insights militares com patentes jurídicas, por exemplo. Combine como preferir para o seu público.
            </div>

            {/* ── Botão de salvar ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                    {isDirty ? "Você tem alterações não salvas." : "Configurações salvas."}
                </p>
                <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={!isDirty || saveMutation.isPending}
                    className="gap-2"
                >
                    {saveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    Salvar configurações
                </Button>
            </div>
        </div>
    );
}