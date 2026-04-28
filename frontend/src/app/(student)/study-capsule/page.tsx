"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { useTrack } from "@/lib/hooks/useTrack";
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

// ── Precarrega logo como data URL para html2canvas funcionar sem CORS ─────

function useLogoDataUrl(url: string | null | undefined): string | null {
    const [dataUrl, setDataUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!url) { setDataUrl(null); return; }
        let cancelled = false;
        fetch(url)
            .then(r => r.blob())
            .then(blob => new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            }))
            .then(du => { if (!cancelled) setDataUrl(du); })
            .catch(() => { if (!cancelled) setDataUrl(null); });
        return () => { cancelled = true; };
    }, [url]);

    return dataUrl;
}

// ── Logo — usa data URL se disponível, senão texto ────────────────────────

function CardLogo({ dataUrl, name, textStyle }: {
    dataUrl: string | null;
    name: string;
    textStyle: React.CSSProperties;
}) {
    if (dataUrl) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt={name} style={{ height: 20, maxWidth: 100, objectFit: "contain" }} />
        );
    }
    return <span style={textStyle}>{name}</span>;
}

// ── Instagram — header, com destaque ─────────────────────────────────────

function CardInstagramTop({ handle, accent }: { handle?: string | null; accent: string }) {
    if (!handle) return null;
    return (
        <span style={{
            fontSize: 10, fontWeight: 700, color: accent,
            letterSpacing: "0.04em", opacity: 0.9,
        }}>
            @{handle}
        </span>
    );
}

// ── CARD: Operativo ───────────────────────────────────────────────────────

function CardOperativo({ d, logoDataUrl }: { d: StudyCapsule; logoDataUrl: string | null }) {
    const accent = d.tenant_primary_color || "#C9A352";
    return (
        <div style={{
            background: "#0a0a0a", borderRadius: 20, padding: "24px 22px",
            fontFamily: "'Courier New', monospace", color: "#fff",
            border: "1px solid #1e1e1e", width: 340, position: "relative", overflow: "hidden",
        }}>
            <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                backgroundImage: `linear-gradient(${accent}0a 1px, transparent 1px), linear-gradient(90deg, ${accent}0a 1px, transparent 1px)`,
                backgroundSize: "24px 24px",
            }} />

            {/* Header: logo + instagram + período */}
            <div style={{ marginBottom: 18, position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <CardLogo dataUrl={logoDataUrl} name={d.tenant_name}
                        textStyle={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase" }} />
                    <span style={{ fontSize: 10, color: accent, letterSpacing: "0.1em" }}>{d.period_label.toUpperCase()}</span>
                </div>
                <CardInstagramTop handle={d.tenant_instagram} accent={accent} />
            </div>
            <div style={{ height: 1, background: `linear-gradient(90deg, ${accent} 0%, transparent 70%)`, marginBottom: 16 }} />

            <div style={{ marginBottom: 20, position: "relative" }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em", marginBottom: 5 }}>// CÁPSULA DE ESTUDOS</div>
                <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>
                    Missão<br /><span style={{ color: accent }}>cumprida.</span>
                </div>
            </div>

            <div style={{ marginBottom: 14, position: "relative" }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em", marginBottom: 2 }}>// TEMPO EM MISSÃO</div>
                <div style={{ fontSize: 50, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em" }}>
                    {d.total_minutes.toLocaleString("pt-BR")}
                </div>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>minutos de estudo</span>
                <div style={{ marginTop: 8, height: 2, background: "#1e1e1e", borderRadius: 1 }}>
                    <div style={{ height: "100%", width: `${Math.min(d.accuracy_rate, 100)}%`, background: accent, borderRadius: 1 }} />
                </div>
            </div>

            <div style={{ height: 1, background: `linear-gradient(90deg, ${accent}, ${accent}22 60%, transparent)`, margin: "14px 0" }} />

            <div style={{ marginBottom: 14, position: "relative" }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", letterSpacing: "0.2em", marginBottom: 6 }}>// DISCIPLINAS — ACERTO</div>
                {d.top_disciplines.map((disc, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>{disc.discipline}</span>
                        <span style={{ fontSize: 11, color: accent, fontWeight: 700 }}>{disc.accuracy_rate}%</span>
                    </div>
                ))}
            </div>

            <div style={{ height: 1, background: `linear-gradient(90deg, ${accent}, ${accent}22 60%, transparent)`, margin: "14px 0" }} />

            <div style={{ marginBottom: 14, fontSize: 10, color: "rgba(255,255,255,0.4)", fontStyle: "italic", lineHeight: 1.5, borderLeft: `2px solid ${accent}55`, paddingLeft: 10, position: "relative" }}>
                "{d.ai_phrase}"
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid #1e1e1e", position: "relative" }}>
                <span style={{ fontSize: 10, color: accent, letterSpacing: "0.1em", textTransform: "uppercase" }}>{d.rank.icon} {d.rank.name}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                    <strong style={{ color: "rgba(255,255,255,0.8)" }}>{d.accuracy_rate}%</strong> acerto · {d.questions_answered} q
                </span>
            </div>
        </div>
    );
}

// ── CARD: Campeão ─────────────────────────────────────────────────────────

function CardCampeao({ d, logoDataUrl }: { d: StudyCapsule; logoDataUrl: string | null }) {
    const accent = d.tenant_primary_color || "#16C784";
    return (
        <div style={{
            background: "#0d0d0d", borderRadius: 20, overflow: "hidden",
            width: 340, fontFamily: "system-ui, -apple-system, sans-serif", border: "1px solid #1c1c1c",
        }}>
            {/* Header */}
            <div style={{ padding: "16px 20px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <CardLogo dataUrl={logoDataUrl} name={d.tenant_name}
                        textStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>{d.period_label}</span>
                </div>
                <CardInstagramTop handle={d.tenant_instagram} accent={accent} />
            </div>

            <div style={{ padding: "0 20px 16px" }}>
                <div style={{ fontSize: 10, color: accent, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>tempo estudado</div>
                <div style={{ fontSize: 68, fontWeight: 900, color: "#fff", lineHeight: 0.9, letterSpacing: "-0.04em", marginBottom: 4 }}>
                    {d.total_minutes.toLocaleString("pt-BR")}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 18 }}>
                    minutos em {d.period_label}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: "#1c1c1c", borderRadius: 10, overflow: "hidden", marginBottom: 18 }}>
                    {([
                        [String(d.questions_answered), "questões", false],
                        [`${d.accuracy_rate}%`, "acerto", true],
                        [String(d.lessons_watched), "aulas", false],
                    ] as [string, string, boolean][]).map(([v, l, h], i) => (
                        <div key={i} style={{ background: "#141414", padding: "10px 6px", textAlign: "center" }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: h ? accent : "#fff" }}>{v}</div>
                            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{l}</div>
                        </div>
                    ))}
                </div>

                <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>top disciplinas</div>
                    {d.top_disciplines.map((disc, i) => (
                        <div key={i} style={{ marginBottom: 6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>{disc.discipline}</span>
                                <span style={{ fontSize: 10, color: accent, fontWeight: 700 }}>{disc.accuracy_rate}%</span>
                            </div>
                            <div style={{ height: 2, background: "#1e1e1e", borderRadius: 1 }}>
                                <div style={{ height: "100%", width: `${disc.accuracy_rate}%`, background: accent, borderRadius: 1 }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ background: accent, padding: "11px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#0d0d0d", textTransform: "uppercase", letterSpacing: "0.02em" }}>{d.rank.name}</span>
                <span style={{ fontSize: 9, color: "rgba(0,0,0,0.55)", fontStyle: "italic", maxWidth: 130, textAlign: "right", lineHeight: 1.3 }}>{d.ai_phrase}</span>
            </div>
        </div>
    );
}

// ── CARD: Relatório ───────────────────────────────────────────────────────

function CardRelatorio({ d, logoDataUrl }: { d: StudyCapsule; logoDataUrl: string | null }) {
    return (
        <div style={{
            background: "#111", borderRadius: 20, padding: "22px 20px",
            fontFamily: "system-ui, -apple-system, sans-serif", color: "#fff",
            width: 340, border: "1px solid #222",
        }}>
            {/* Header */}
            <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <CardLogo dataUrl={logoDataUrl} name={d.tenant_name}
                        textStyle={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em" }} />
                    <span style={{ background: "#fff", color: "#111", fontSize: 8, fontWeight: 700, padding: "3px 8px", borderRadius: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        {d.period_label}
                    </span>
                </div>
                {d.tenant_instagram && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.04em" }}>@{d.tenant_instagram}</span>
                )}
            </div>

            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: 18 }}>
                Cápsula<br />de <span style={{ color: "transparent", WebkitTextStroke: "1px rgba(255,255,255,0.35)" }}>estudos</span>
            </div>

            <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 3 }}>tempo de estudo</div>
                <div style={{ fontSize: 54, fontWeight: 900, lineHeight: 0.95, letterSpacing: "-0.03em" }}>{d.total_minutes.toLocaleString("pt-BR")}</div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>minutos</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                {([["questões", String(d.questions_answered), "respondidas"], ["acerto", `${d.accuracy_rate}%`, "geral"]] as [string, string, string][]).map(([l, v, s]) => (
                    <div key={l} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "10px" }}>
                        <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>{l}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{v}</div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{s}</div>
                    </div>
                ))}
            </div>

            <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 6 }}>top disciplinas</div>
                {d.top_disciplines.map((disc, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontWeight: 700, minWidth: 14 }}>0{i + 1}</span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: 500, flex: 1 }}>{disc.discipline}</span>
                        <span style={{ fontSize: 10, color: "#fff", fontWeight: 800 }}>{disc.accuracy_rate}%</span>
                    </div>
                ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.12em" }}>patente</div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{d.rank.icon} {d.rank.name}</div>
                </div>
                <div style={{ flex: 1, borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: 10, fontSize: 9, color: "rgba(255,255,255,0.35)", fontStyle: "italic", lineHeight: 1.4 }}>
                    "{d.ai_phrase}"
                </div>
            </div>
        </div>
    );
}

// ── CARD: Neon ────────────────────────────────────────────────────────────

function CardNeon({ d, logoDataUrl }: { d: StudyCapsule; logoDataUrl: string | null }) {
    const accent = d.tenant_primary_color || "#00FF88";
    const glow = `0 0 12px ${accent}88`;
    return (
        <div style={{
            background: "#050508", borderRadius: 20, padding: "22px 20px",
            fontFamily: "system-ui, -apple-system, sans-serif", color: "#fff",
            width: 340, border: `1px solid ${accent}33`, position: "relative", overflow: "hidden",
        }}>
            {/* Glow bg */}
            <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 200, height: 120, background: accent, opacity: 0.06, borderRadius: "50%", filter: "blur(40px)", pointerEvents: "none" }} />

            {/* Header */}
            <div style={{ marginBottom: 20, position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <CardLogo dataUrl={logoDataUrl} name={d.tenant_name}
                        textStyle={{ fontSize: 10, color: `${accent}99`, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 700 }} />
                    <span style={{ fontSize: 9, color: `${accent}cc`, letterSpacing: "0.1em", border: `1px solid ${accent}44`, padding: "2px 8px", borderRadius: 4 }}>
                        {d.period_label.toUpperCase()}
                    </span>
                </div>
                {d.tenant_instagram && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: "0.04em", textShadow: glow }}>
                        @{d.tenant_instagram}
                    </span>
                )}
            </div>

            <div style={{ marginBottom: 6, fontSize: 9, color: `${accent}88`, letterSpacing: "0.2em", textTransform: "uppercase" }}>minutos estudados</div>
            <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 0.9, letterSpacing: "-0.04em", marginBottom: 4, color: "#fff", textShadow: `0 0 30px ${accent}44` }}>
                {d.total_minutes.toLocaleString("pt-BR")}
            </div>
            <div style={{ height: 2, background: `linear-gradient(90deg, ${accent}, ${accent}22)`, borderRadius: 1, marginBottom: 20, boxShadow: glow }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
                {([
                    ["questões", String(d.questions_answered)],
                    ["acerto", `${d.accuracy_rate}%`],
                ] as [string, string][]).map(([l, v]) => (
                    <div key={l} style={{ border: `1px solid ${accent}22`, borderRadius: 10, padding: "10px 12px", background: `${accent}08` }}>
                        <div style={{ fontSize: 8, color: `${accent}88`, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>{l}</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: accent, textShadow: glow }}>{v}</div>
                    </div>
                ))}
            </div>

            <div style={{ marginBottom: 16 }}>
                {d.top_disciplines.map((disc, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${accent}11` }}>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{disc.discipline}</span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: accent, textShadow: glow }}>{disc.accuracy_rate}%</span>
                    </div>
                ))}
            </div>

            <div style={{ paddingTop: 12, borderTop: `1px solid ${accent}22`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: accent, textShadow: glow }}>{d.rank.icon} {d.rank.name}</span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontStyle: "italic", maxWidth: 140, textAlign: "right", lineHeight: 1.4 }}>
                    "{d.ai_phrase}"
                </span>
            </div>
        </div>
    );
}

// ── CARD: Bold ────────────────────────────────────────────────────────────

function CardBold({ d, logoDataUrl }: { d: StudyCapsule; logoDataUrl: string | null }) {
    const accent = d.tenant_primary_color || "#FF4444";
    return (
        <div style={{
            background: "#0a0a0a", borderRadius: 20, padding: "22px 20px",
            fontFamily: "'Arial Black', 'Arial', sans-serif", color: "#fff",
            width: 340, border: "1px solid #1a1a1a", overflow: "hidden", position: "relative",
        }}>
            {/* Decorative block */}
            <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: accent, opacity: 0.12, borderBottomLeftRadius: 80 }} />

            {/* Header */}
            <div style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <CardLogo dataUrl={logoDataUrl} name={d.tenant_name}
                        textStyle={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase" }} />
                    <span style={{ fontSize: 9, background: accent, color: "#fff", padding: "3px 10px", borderRadius: 20, fontWeight: 900, letterSpacing: "0.06em" }}>
                        {d.period_label.toUpperCase()}
                    </span>
                </div>
                {d.tenant_instagram && (
                    <span style={{ fontSize: 11, fontWeight: 900, color: accent, letterSpacing: "0.02em" }}>@{d.tenant_instagram}</span>
                )}
            </div>

            {/* Big number */}
            <div style={{ marginBottom: 6, fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: "0.2em", textTransform: "uppercase" }}>horas de estudo</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 80, fontWeight: 900, lineHeight: 0.85, letterSpacing: "-0.04em", color: "#fff" }}>
                    {d.total_minutes.toLocaleString("pt-BR")}
                </span>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 20 }}>minutos</div>

            {/* Accent bar */}
            <div style={{ height: 4, background: accent, borderRadius: 2, marginBottom: 20 }} />

            {/* Stats row */}
            <div style={{ display: "flex", gap: 0, marginBottom: 20, background: "#111", borderRadius: 12, overflow: "hidden" }}>
                {([
                    [String(d.questions_answered), "questões"],
                    [`${d.accuracy_rate}%`, "acerto"],
                    [String(d.lessons_watched), "aulas"],
                ] as [string, string][]).map(([v, l], i) => (
                    <div key={i} style={{ flex: 1, padding: "10px 8px", textAlign: "center", borderRight: i < 2 ? "1px solid #1a1a1a" : "none" }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: i === 1 ? accent : "#fff" }}>{v}</div>
                        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
                    </div>
                ))}
            </div>

            {/* Disciplines */}
            {d.top_disciplines.map((disc, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>{disc.discipline}</span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: accent }}>{disc.accuracy_rate}%</span>
                </div>
            ))}

            <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>{d.rank.icon} {d.rank.name}</span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontStyle: "italic", maxWidth: 140, textAlign: "right", lineHeight: 1.4 }}>"{d.ai_phrase}"</span>
            </div>
        </div>
    );
}

// ── CARD: Elegante ────────────────────────────────────────────────────────

function CardElegante({ d, logoDataUrl }: { d: StudyCapsule; logoDataUrl: string | null }) {
    const accent = d.tenant_primary_color || "#D4AF37";
    return (
        <div style={{
            background: "#f8f6f1", borderRadius: 20, padding: "24px 22px",
            fontFamily: "Georgia, 'Times New Roman', serif", color: "#1a1a1a",
            width: 340, border: "1px solid #e8e4dc", position: "relative", overflow: "hidden",
        }}>
            {/* Subtle pattern */}
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, #00000008 1px, transparent 1px)", backgroundSize: "16px 16px", pointerEvents: "none" }} />

            {/* Header */}
            <div style={{ marginBottom: 20, position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <CardLogo dataUrl={logoDataUrl} name={d.tenant_name}
                        textStyle={{ fontSize: 11, color: "#999", letterSpacing: "0.08em", textTransform: "uppercase", fontStyle: "normal" }} />
                    <span style={{ fontSize: 9, color: "#888", letterSpacing: "0.12em", textTransform: "uppercase" }}>{d.period_label}</span>
                </div>
                {d.tenant_instagram && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: "0.02em" }}>@{d.tenant_instagram}</span>
                )}
            </div>

            <div style={{ height: 1, background: accent, marginBottom: 18, opacity: 0.4 }} />

            <div style={{ marginBottom: 4, fontSize: 9, color: "#888", letterSpacing: "0.18em", textTransform: "uppercase" }}>tempo de estudo</div>
            <div style={{ fontSize: 60, fontWeight: 400, lineHeight: 0.9, letterSpacing: "-0.03em", color: "#1a1a1a", marginBottom: 4, fontStyle: "italic" }}>
                {d.total_minutes.toLocaleString("pt-BR")}
            </div>
            <div style={{ fontSize: 11, color: "#888", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 }}>minutos</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                {([["questões", String(d.questions_answered)], ["acerto geral", `${d.accuracy_rate}%`]] as [string, string][]).map(([l, v]) => (
                    <div key={l} style={{ borderTop: `2px solid ${accent}`, paddingTop: 8 }}>
                        <div style={{ fontSize: 7, color: "#888", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>{l}</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", fontStyle: "italic" }}>{v}</div>
                    </div>
                ))}
            </div>

            <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 7, color: "#888", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>principais disciplinas</div>
                {d.top_disciplines.map((disc, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #e8e4dc" }}>
                        <span style={{ fontSize: 11, color: "#333" }}>{disc.discipline}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: accent, fontStyle: "italic" }}>{disc.accuracy_rate}%</span>
                    </div>
                ))}
            </div>

            <div style={{ height: 1, background: accent, marginBottom: 14, opacity: 0.3 }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                    <div style={{ fontSize: 7, color: "#888", textTransform: "uppercase", letterSpacing: "0.15em" }}>patente</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", fontStyle: "italic" }}>{d.rank.icon} {d.rank.name}</div>
                </div>
                <div style={{ maxWidth: 150, textAlign: "right", fontSize: 9, color: "#888", fontStyle: "italic", lineHeight: 1.5 }}>
                    "{d.ai_phrase}"
                </div>
            </div>
        </div>
    );
}

// ── Router de card ────────────────────────────────────────────────────────

function CapsuleCard({ data, logoDataUrl }: { data: StudyCapsule; logoDataUrl: string | null }) {
    const props = { d: data, logoDataUrl };
    switch (data.capsule_style) {
        case "campeao": return <CardCampeao  {...props} />;
        case "relatorio": return <CardRelatorio {...props} />;
        case "neon": return <CardNeon     {...props} />;
        case "bold": return <CardBold     {...props} />;
        case "elegante": return <CardElegante {...props} />;
        default: return <CardOperativo {...props} />;
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
            apiClient.get("/analytics/student/study-capsule", { params: { month, year } }).then(r => r.data),
        staleTime: 0,
    });

    // Precarrega logo como data URL (resolve problema de CORS com html2canvas)
    const logoDataUrl = useLogoDataUrl(data?.tenant_logo_url);

    const sinceMonth = data?.user_since?.month;
    const sinceYear = data?.user_since?.year;
    const isFirstMonth = !!sinceMonth && !!sinceYear && year === sinceYear && month === sinceMonth;
    const isCurrentMonth = (() => { const n = currentMonthYear(); return month === n.month && year === n.year; })();

    const goBack = () => {
        if (!sinceMonth || !sinceYear) return;
        const p = prevMonth(month, year);
        if (p.year > sinceYear || (p.year === sinceYear && p.month >= sinceMonth)) setPeriod(p);
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
            const canvas = await html2canvas(cardRef.current, { scale: 3, backgroundColor: null, useCORS: false, logging: false });
            canvas.toBlob((blob: Blob | null) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `capsula-estudos-${monthLabel(month, year).replace(" ", "-")}.png`;
                a.click();
                URL.revokeObjectURL(url);
            }, "image/png");
        } finally { setIsExporting(false); }
    }, [cardRef, month, year, isExporting]);

    const track = useTrack();
    const handleShare = useCallback(async () => {
        if (!cardRef.current || isExporting) return;

        // ── TRACK: capsule_shared (aluno iniciou compartilhamento/download) ───
        // Disparado no clique — antes do html2canvas processar — para garantir
        // que o evento seja registrado mesmo se o canvas falhar.
        const willUseNativeShare =
            typeof navigator !== "undefined" && typeof navigator.canShare === "function";
        track({
            event_type: "capsule_shared",
            feature_name: "gamificacao",
            metadata: {
                month,
                year,
                method: willUseNativeShare ? "native_share" : "download",
                tenant_name: tenant?.name ?? null,
            },
        });

        setIsExporting(true);
        try {
            const html2canvas = (await import("html2canvas")).default;
            const canvas = await html2canvas(cardRef.current, {
                scale: 3,
                backgroundColor: null,
                useCORS: false,
                logging: false,
            });
            canvas.toBlob(async (blob: Blob | null) => {
                if (!blob) return;
                const file = new File(
                    [blob],
                    `capsula-${month}-${year}.png`,
                    { type: "image/png" }
                );
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
    }, [cardRef, month, year, tenant, track, isExporting]);
    return (
        <div className="max-w-xl mx-auto space-y-6 animate-fade-in pb-10">
            <div>
                <Link href="/analytics" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                </Link>
                <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
                    <Share2 className="h-6 w-6 text-primary" /> Cápsula de Estudos
                </h1>
                <p className="text-sm text-muted-foreground mt-1">Seu resumo mensal para compartilhar</p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                <button onClick={goBack} disabled={isFirstMonth || isLoading}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold text-foreground capitalize">{monthLabel(month, year)}</span>
                <button onClick={goForward} disabled={isCurrentMonth}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center"><Skeleton className="w-[340px] h-[520px] rounded-2xl" /></div>
            ) : data ? (
                <div className="flex flex-col items-center gap-6">
                    <div ref={cardRef} style={{ display: "inline-block" }}>
                        <CapsuleCard data={data} logoDataUrl={logoDataUrl} />
                    </div>
                    <div className="flex gap-3 w-full max-w-[340px]">
                        <Button variant="outline" className="flex-1" onClick={handleDownload} disabled={isExporting}>
                            <Download className="h-4 w-4 mr-2" />{isExporting ? "Gerando..." : "Baixar imagem"}
                        </Button>
                        <Button className="flex-1" onClick={handleShare} disabled={isExporting}>
                            <Share2 className="h-4 w-4 mr-2" />Compartilhar
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