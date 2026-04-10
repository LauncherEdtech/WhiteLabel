"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Download, Share2, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { StudyCapsule } from "@/types/api";

// ── Helpers ────────────────────────────────────────────────────────────────

function currentMonthYear() {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
}

function monthLabel(month: number, year: number) {
    const names = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    return `${names[month - 1]} ${year}`;
}

function prevMonth(month: number, year: number) {
    return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
}

// ── Logo helper — crossOrigin necessário para html2canvas ─────────────────

function CardLogo({ logoUrl, name, textStyle }: {
    logoUrl: string | null;
    name: string;
    textStyle: React.CSSProperties;
}) {
    if (logoUrl) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={logoUrl}
                alt={name}
                crossOrigin="anonymous"
                style={{ height: 18, maxWidth: 90, objectFit: "contain" }}
            />
        );
    }
    return <span style={textStyle}>{name}</span>;
}

// ── Instagram helper ──────────────────────────────────────────────────────

function CardInstagram({ handle, style }: { handle?: string | null; style?: React.CSSProperties }) {
    if (!handle) return null;
    return <span style={{ fontSize: 9, opacity: 0.6, ...style }}>@{handle}</span>;
}

// ── Cards ──────────────────────────────────────────────────────────────────

function CardOperativo({ d }: { d: StudyCapsule }) {
    const accent = d.tenant_primary_color || "#C9A352";

    return (
        <div style={{
            background: "#0a0a0a", borderRadius: 20, padding: "28px 24px",
            fontFamily: "'Courier New', monospace", color: "#fff",
            border: "1px solid #1e1e1e", width: 340, position: "relative", overflow: "hidden",
        }}>
            <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                backgroundImage: `linear-gradient(${accent}0a 1px, transparent 1px), linear-gradient(90deg, ${accent}0a 1px, transparent 1px)`,
                backgroundSize: "24px 24px",
            }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, position: "relative" }}>
                <CardLogo
                    logoUrl={d.tenant_logo_url}
                    name={d.tenant_name}
                    textStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase" }}
                />
                <span style={{ fontSize: 10, color: accent, letterSpacing: "0.1em" }}>
                    {d.period_label.toUpperCase()}
                </span>
            </div>
            <div style={{ height: 1, background: `linear-gradient(90deg, ${accent} 0%, transparent 70%)`, marginBottom: 18 }} />

            <div style={{ marginBottom: 22, position: "relative" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em", marginBottom: 6 }}>// CÁPSULA DE ESTUDOS</div>
                <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>
                    Missão<br /><span style={{ color: accent }}>cumprida.</span>
                </div>
            </div>

            <div style={{ marginBottom: 16, position: "relative" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em", marginBottom: 2 }}>// TEMPO EM MISSÃO</div>
                <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em" }}>
                    {d.total_minutes.toLocaleString("pt-BR")}
                </div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    minutos de estudo
                </span>
                <div style={{ marginTop: 10, height: 2, background: "#1e1e1e", borderRadius: 1 }}>
                    <div style={{ height: "100%", width: `${d.accuracy_rate}%`, background: accent, borderRadius: 1 }} />
                </div>
            </div>

            <div style={{ height: 1, background: `linear-gradient(90deg, ${accent}, ${accent}22 60%, transparent)`, margin: "16px 0" }} />

            <div style={{ marginBottom: 16, position: "relative" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.2em", marginBottom: 8 }}>// DISCIPLINAS — ACERTO</div>
                {d.top_disciplines.map((disc, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>{disc.discipline}</span>
                        <span style={{ fontSize: 11, color: accent, fontWeight: 700 }}>{disc.accuracy_rate}%</span>
                    </div>
                ))}
            </div>

            <div style={{ height: 1, background: `linear-gradient(90deg, ${accent}, ${accent}22 60%, transparent)`, margin: "16px 0" }} />

            {/* Frase gerada pela IA — sem corte */}
            <div style={{ marginBottom: 16, fontSize: 11, color: "rgba(255,255,255,0.4)", fontStyle: "italic", lineHeight: 1.5, borderLeft: `2px solid ${accent}55`, paddingLeft: 10, position: "relative" }}>
                "{d.ai_phrase}"
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: "1px solid #1e1e1e", position: "relative" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 11, color: accent, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        {d.rank.icon} {d.rank.name}
                    </span>
                    <CardInstagram handle={d.tenant_instagram} style={{ color: accent }} />
                </div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                    <strong style={{ color: "rgba(255,255,255,0.8)" }}>{d.accuracy_rate}%</strong> acerto · {d.questions_answered} questões
                </span>
            </div>
        </div>
    );
}

function CardCampeao({ d }: { d: StudyCapsule }) {
    const accent = d.tenant_primary_color || "#16C784";

    return (
        <div style={{
            background: "#0d0d0d", borderRadius: 20, overflow: "hidden",
            width: 340, fontFamily: "system-ui, -apple-system, sans-serif",
            border: "1px solid #1c1c1c",
        }}>
            <div style={{ padding: "18px 20px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <CardLogo
                    logoUrl={d.tenant_logo_url}
                    name={d.tenant_name}
                    textStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}
                />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{d.period_label}</span>
            </div>

            <div style={{ padding: "0 20px 16px" }}>
                <div style={{ fontSize: 10, color: accent, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>
                    tempo estudado
                </div>
                <div style={{ fontSize: 72, fontWeight: 900, color: "#fff", lineHeight: 0.9, letterSpacing: "-0.04em", marginBottom: 4 }}>
                    {d.total_minutes.toLocaleString("pt-BR")}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 20 }}>
                    minutos em {d.period_label}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: "#1c1c1c", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
                    {[
                        [String(d.questions_answered), "questões", false],
                        [`${d.accuracy_rate}%`, "acerto", true],
                        [String(d.lessons_watched), "aulas", false],
                    ].map(([v, l, highlight], i) => (
                        <div key={i} style={{ background: "#141414", padding: "12px 8px", textAlign: "center" }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: highlight ? accent : "#fff" }}>{v}</div>
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{l}</div>
                        </div>
                    ))}
                </div>

                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>top disciplinas</div>
                    {d.top_disciplines.map((disc, i) => (
                        <div key={i} style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>{disc.discipline}</span>
                                <span style={{ fontSize: 11, color: accent, fontWeight: 700 }}>{disc.accuracy_rate}%</span>
                            </div>
                            <div style={{ height: 2, background: "#1e1e1e", borderRadius: 1 }}>
                                <div style={{ height: "100%", width: `${disc.accuracy_rate}%`, background: accent, borderRadius: 1 }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer band — frase IA sem corte */}
            <div style={{ background: accent, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#0d0d0d", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                        {d.rank.name}
                    </span>
                    {d.tenant_instagram && (
                        <span style={{ fontSize: 9, color: "rgba(0,0,0,0.5)" }}>@{d.tenant_instagram}</span>
                    )}
                </div>
                <span style={{ fontSize: 10, color: "rgba(0,0,0,0.55)", fontStyle: "italic", maxWidth: 130, textAlign: "right", lineHeight: 1.3 }}>
                    {d.ai_phrase}
                </span>
            </div>
        </div>
    );
}

function CardRelatorio({ d }: { d: StudyCapsule }) {
    return (
        <div style={{
            background: "#111", borderRadius: 20, padding: "24px 22px",
            fontFamily: "system-ui, -apple-system, sans-serif", color: "#fff",
            width: 340, border: "1px solid #222",
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <CardLogo
                    logoUrl={d.tenant_logo_url}
                    name={d.tenant_name}
                    textStyle={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em" }}
                />
                <span style={{ background: "#fff", color: "#111", fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {d.period_label}
                </span>
            </div>

            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: 20 }}>
                Cápsula<br />de <span style={{ color: "transparent", WebkitTextStroke: "1px rgba(255,255,255,0.35)" }}>estudos</span>
            </div>

            <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>tempo de estudo</div>
                <div style={{ fontSize: 58, fontWeight: 900, color: "#fff", lineHeight: 0.95, letterSpacing: "-0.03em" }}>
                    {d.total_minutes.toLocaleString("pt-BR")}
                </div>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>minutos</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                {[
                    ["questões", String(d.questions_answered), "respondidas"],
                    ["acerto", `${d.accuracy_rate}%`, "geral"],
                ].map(([label, val, sub]) => (
                    <div key={label} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "12px 10px" }}>
                        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{val}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{sub}</div>
                    </div>
                ))}
            </div>

            <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>top disciplinas</div>
                {d.top_disciplines.map((disc, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontWeight: 700, minWidth: 16 }}>0{i + 1}</span>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: 500, flex: 1 }}>{disc.discipline}</span>
                        <span style={{ fontSize: 11, color: "#fff", fontWeight: 800 }}>{disc.accuracy_rate}%</span>
                    </div>
                ))}
            </div>

            {/* Footer — frase IA sem corte */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.12em" }}>patente</div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{d.rank.icon} {d.rank.name}</div>
                    <CardInstagram handle={d.tenant_instagram} style={{ color: "rgba(255,255,255,0.4)" }} />
                </div>
                <div style={{ flex: 1, borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: 10, fontSize: 10, color: "rgba(255,255,255,0.35)", fontStyle: "italic", lineHeight: 1.4 }}>
                    "{d.ai_phrase}"
                </div>
            </div>
        </div>
    );
}

// ── Componente do card por estilo ──────────────────────────────────────────

function CapsuleCard({ data }: { data: StudyCapsule }) {
    switch (data.capsule_style) {
        case "campeao": return <CardCampeao d={data} />;
        case "relatorio": return <CardRelatorio d={data} />;
        default: return <CardOperativo d={data} />;
    }
}

// ── Página principal ───────────────────────────────────────────────────────

export default function StudyCapsulePage() {
    const { tenant } = useTenantStore();
    const cardRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    const [{ month, year }, setPeriod] = useState(currentMonthYear);

    const { data, isLoading } = useQuery<StudyCapsule>({
        queryKey: ["study-capsule", month, year],
        queryFn: () =>
            apiClient.get("/analytics/student/study-capsule", { params: { month, year } })
                .then(r => r.data),
        staleTime: 0,
    });

    // Mês de cadastro do aluno — vem do backend
    const sinceMonth = data?.user_since?.month;
    const sinceYear = data?.user_since?.year;

    // Está no mês de cadastro? Botão ← desabilita
    const isFirstMonth = !!sinceMonth && !!sinceYear
        && year === sinceYear && month === sinceMonth;

    const isCurrentMonth = (() => {
        const now = currentMonthYear();
        return month === now.month && year === now.year;
    })();

    const goBack = () => {
        if (!sinceMonth || !sinceYear) return;
        const p = prevMonth(month, year);
        // Não vai antes do mês de cadastro
        if (p.year > sinceYear || (p.year === sinceYear && p.month >= sinceMonth)) {
            setPeriod(p);
        }
    };

    const goForward = () => {
        const limit = currentMonthYear();
        if (year < limit.year || (year === limit.year && month < limit.month)) {
            setPeriod(month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year });
        }
    };

    const handleDownload = useCallback(async () => {
        if (!cardRef.current || isExporting) return;
        setIsExporting(true);
        try {
            const html2canvas = (await import("html2canvas")).default;
            const canvas = await html2canvas(cardRef.current, {
                scale: 3, backgroundColor: null, useCORS: true, logging: false,
            });
            canvas.toBlob((blob: Blob | null) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `capsula-estudos-${monthLabel(month, year).replace(" ", "-")}.png`;
                a.click();
                URL.revokeObjectURL(url);
            }, "image/png");
        } finally {
            setIsExporting(false);
        }
    }, [cardRef, month, year, isExporting]);

    const handleShare = useCallback(async () => {
        if (!cardRef.current) return;
        setIsExporting(true);
        try {
            const html2canvas = (await import("html2canvas")).default;
            const canvas = await html2canvas(cardRef.current, { scale: 3, backgroundColor: null, useCORS: true });
            canvas.toBlob(async (blob: Blob | null) => {
                if (!blob) return;
                const file = new File([blob], `capsula-${month}-${year}.png`, { type: "image/png" });
                if (navigator.canShare?.({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: "Minha Cápsula de Estudos",
                        text: `Confira meu desempenho em ${monthLabel(month, year)} na ${tenant?.name ?? "plataforma"}!`,
                    });
                } else {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `capsula-${month}-${year}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                }
            }, "image/png");
        } finally {
            setIsExporting(false);
        }
    }, [cardRef, month, year, tenant]);

    return (
        <div className="max-w-xl mx-auto space-y-6 animate-fade-in pb-10">
            {/* Header com botão voltar */}
            <div>
                <Link
                    href="/analytics"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                </Link>
                <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
                    <Share2 className="h-6 w-6 text-primary" />
                    Cápsula de Estudos
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Seu resumo mensal para compartilhar
                </p>
            </div>

            {/* Seletor de mês */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                <button
                    onClick={goBack}
                    disabled={isFirstMonth || isLoading}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold text-foreground capitalize">
                    {monthLabel(month, year)}
                </span>
                <button
                    onClick={goForward}
                    disabled={isCurrentMonth}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {/* Card */}
            {isLoading ? (
                <div className="flex justify-center">
                    <Skeleton className="w-[340px] h-[520px] rounded-2xl" />
                </div>
            ) : data ? (
                <div className="flex flex-col items-center gap-6">
                    <div ref={cardRef} style={{ display: "inline-block" }}>
                        <CapsuleCard data={data} />
                    </div>

                    <div className="flex gap-3 w-full max-w-[340px]">
                        <Button variant="outline" className="flex-1" onClick={handleDownload} disabled={isExporting}>
                            <Download className="h-4 w-4 mr-2" />
                            {isExporting ? "Gerando..." : "Baixar imagem"}
                        </Button>
                        <Button className="flex-1" onClick={handleShare} disabled={isExporting}>
                            <Share2 className="h-4 w-4 mr-2" />
                            Compartilhar
                        </Button>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                        Gerado em {new Date(data.generated_at).toLocaleString("pt-BR")}
                    </p>
                </div>
            ) : (
                <div className="text-center py-16 text-sm text-muted-foreground">
                    Nenhum dado encontrado para {monthLabel(month, year)}.
                </div>
            )}
        </div>
    );
}