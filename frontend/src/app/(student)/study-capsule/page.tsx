"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Download, Share2, ChevronLeft, ChevronRight } from "lucide-react";
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

// ── Cards ──────────────────────────────────────────────────────────────────

function CardOperativo({ d }: { d: StudyCapsule }) {
    return (
        <div style={{
            background: "#0a0a0a", borderRadius: 20, padding: "28px 24px",
            fontFamily: "'Courier New', monospace", color: "#fff",
            border: "1px solid #1e1e1e", width: 340, position: "relative", overflow: "hidden",
        }}>
            {/* Grid bg */}
            <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                backgroundImage: "linear-gradient(rgba(201,163,82,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(201,163,82,0.04) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
            }} />

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, position: "relative" }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    {d.tenant_name}
                </span>
                <span style={{ fontSize: 10, color: "#C9A352", letterSpacing: "0.1em" }}>
                    {d.period_label.toUpperCase()}
                </span>
            </div>
            <div style={{ height: 1, background: "linear-gradient(90deg, #C9A352 0%, transparent 70%)", marginBottom: 18 }} />

            {/* Title */}
            <div style={{ marginBottom: 22, position: "relative" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em", marginBottom: 6 }}>// CÁPSULA DE ESTUDOS</div>
                <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>
                    Missão<br /><span style={{ color: "#C9A352" }}>cumprida.</span>
                </div>
            </div>

            {/* Hero stat */}
            <div style={{ marginBottom: 16, position: "relative" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em", marginBottom: 2 }}>// TEMPO EM MISSÃO</div>
                <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em" }}>
                    {d.total_minutes.toLocaleString("pt-BR")}
                </div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    minutos de estudo
                </span>
                <div style={{ marginTop: 10, height: 2, background: "#1e1e1e", borderRadius: 1 }}>
                    <div style={{ height: "100%", width: `${d.accuracy_rate}%`, background: "#C9A352", borderRadius: 1 }} />
                </div>
            </div>

            <div style={{ height: 1, background: "linear-gradient(90deg, #C9A352, rgba(201,163,82,0.1) 60%, transparent)", margin: "16px 0" }} />

            {/* Disciplines */}
            <div style={{ marginBottom: 16, position: "relative" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.2em", marginBottom: 8 }}>// DISCIPLINAS — ACERTO</div>
                {d.top_disciplines.map((disc, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>{disc.discipline}</span>
                        <span style={{ fontSize: 11, color: "#C9A352", fontWeight: 700 }}>{disc.accuracy_rate}%</span>
                    </div>
                ))}
            </div>

            <div style={{ height: 1, background: "linear-gradient(90deg, #C9A352, rgba(201,163,82,0.1) 60%, transparent)", margin: "16px 0" }} />

            {/* AI phrase */}
            <div style={{ marginBottom: 16, fontSize: 11, color: "rgba(255,255,255,0.4)", fontStyle: "italic", lineHeight: 1.5, borderLeft: "2px solid rgba(201,163,82,0.4)", paddingLeft: 10, position: "relative" }}>
                "{d.ai_phrase}"
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: "1px solid #1e1e1e", position: "relative" }}>
                <span style={{ fontSize: 11, color: "#C9A352", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {d.rank.icon} {d.rank.name}
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                    <strong style={{ color: "rgba(255,255,255,0.8)" }}>{d.accuracy_rate}%</strong> acerto · {d.questions_answered} questões
                </span>
            </div>
        </div>
    );
}

function CardCampeao({ d }: { d: StudyCapsule }) {
    return (
        <div style={{
            background: "#0d0d0d", borderRadius: 20, overflow: "hidden",
            width: 340, fontFamily: "system-ui, -apple-system, sans-serif",
            border: "1px solid #1c1c1c",
        }}>
            <div style={{ padding: "18px 20px 14px", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{d.tenant_name}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{d.period_label}</span>
            </div>

            <div style={{ padding: "0 20px 16px" }}>
                <div style={{ fontSize: 10, color: "#16C784", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>
                    tempo estudado
                </div>
                <div style={{ fontSize: 72, fontWeight: 900, color: "#fff", lineHeight: 0.9, letterSpacing: "-0.04em", marginBottom: 4 }}>
                    {d.total_minutes.toLocaleString("pt-BR")}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 20 }}>
                    minutos em {d.period_label}
                </div>

                {/* Metrics grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: "#1c1c1c", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
                    {[
                        [String(d.questions_answered), "questões", false],
                        [`${d.accuracy_rate}%`, "acerto", true],
                        [String(d.lessons_watched), "aulas", false],
                    ].map(([v, l, highlight], i) => (
                        <div key={i} style={{ background: "#141414", padding: "12px 8px", textAlign: "center" }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: highlight ? "#16C784" : "#fff" }}>{v}</div>
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{l}</div>
                        </div>
                    ))}
                </div>

                {/* Discipline bars */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>top disciplinas</div>
                    {d.top_disciplines.map((disc, i) => (
                        <div key={i} style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>{disc.discipline}</span>
                                <span style={{ fontSize: 11, color: "#16C784", fontWeight: 700 }}>{disc.accuracy_rate}%</span>
                            </div>
                            <div style={{ height: 2, background: "#1e1e1e", borderRadius: 1 }}>
                                <div style={{ height: "100%", width: `${disc.accuracy_rate}%`, background: "#16C784", borderRadius: 1 }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer band */}
            <div style={{ background: "#16C784", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#0d0d0d", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                    {d.rank.name}
                </span>
                <span style={{ fontSize: 10, color: "rgba(0,0,0,0.5)", fontStyle: "italic", maxWidth: 120, textAlign: "right", lineHeight: 1.3 }}>
                    {d.ai_phrase.slice(0, 60)}{d.ai_phrase.length > 60 ? "..." : ""}
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
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    {d.tenant_name}
                </span>
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

            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.12em" }}>patente</div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{d.rank.icon} {d.rank.name}</div>
                </div>
                <div style={{ flex: 1, borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: 10, fontSize: 10, color: "rgba(255,255,255,0.35)", fontStyle: "italic", lineHeight: 1.4 }}>
                    "{d.ai_phrase.slice(0, 80)}{d.ai_phrase.length > 80 ? "..." : ""}"
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

    const goBack = () => {
        const p = prevMonth(month, year);
        const limit = currentMonthYear();
        // Permite até 6 meses atrás
        const monthsDiff = (limit.year - p.year) * 12 + (limit.month - p.month);
        if (monthsDiff <= 6) setPeriod(p);
    };

    const goForward = () => {
        const limit = currentMonthYear();
        if (year < limit.year || (year === limit.year && month < limit.month)) {
            setPeriod(month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year });
        }
    };

    const isCurrentMonth = (() => {
        const now = currentMonthYear();
        return month === now.month && year === now.year;
    })();

    // ── Export PNG via html2canvas ────────────────────────────────────────
    const handleDownload = useCallback(async () => {
        if (!cardRef.current || isExporting) return;
        setIsExporting(true);
        try {
            const html2canvas = (await import("html2canvas")).default;
            const canvas = await html2canvas(cardRef.current, {
                scale: 3,
                backgroundColor: null,
                useCORS: true,
                logging: false,
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

    // ── Share nativo (mobile) ─────────────────────────────────────────────
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
                    // Fallback: download
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
            {/* Header */}
            <div>
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
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
                    {/* Card renderizado para export */}
                    <div ref={cardRef} style={{ display: "inline-block" }}>
                        <CapsuleCard data={data} />
                    </div>

                    {/* Ações */}
                    <div className="flex gap-3 w-full max-w-[340px]">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={handleDownload}
                            disabled={isExporting}
                        >
                            <Download className="h-4 w-4 mr-2" />
                            {isExporting ? "Gerando..." : "Baixar imagem"}
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={handleShare}
                            disabled={isExporting}
                        >
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