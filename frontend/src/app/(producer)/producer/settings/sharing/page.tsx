"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { useToast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { Share2, Check, Loader2, Save } from "lucide-react";
import type { CapsuleStyle } from "@/types/tenant";

// ── Dados dos estilos ──────────────────────────────────────────────────────

const STYLES: {
    key: CapsuleStyle;
    label: string;
    tagline: string;
    tags: string[];
    accent: string;
    bg: string;
    preview: React.FC<{ primary: string }>;
}[] = [
    {
        key: "operativo",
        label: "Operativo",
        tagline: "Tático · Monospace · Dourado",
        tags: ["Policial", "Militar", "Concursos de segurança"],
        accent: "#C9A352",
        bg: "#0a0a0a",
        preview: ({ primary }) => (
            <div style={{
                background: "#0a0a0a", borderRadius: 12, padding: "16px 14px",
                fontFamily: "'Courier New', monospace", color: "#fff",
                border: "1px solid #1e1e1e", aspectRatio: "9/14", display: "flex",
                flexDirection: "column", gap: 0, position: "relative", overflow: "hidden",
            }}>
                {/* grid bg */}
                <div style={{
                    position: "absolute", inset: 0, opacity: 0.04,
                    backgroundImage: "linear-gradient(#C9A352 1px, transparent 1px), linear-gradient(90deg, #C9A352 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, position: "relative" }}>
                    <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>CONCURSODEMO</span>
                    <span style={{ fontSize: 8, color: "#C9A352" }}>ABR.2026</span>
                </div>
                <div style={{ marginBottom: 10, position: "relative" }}>
                    <div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", letterSpacing: "0.18em", marginBottom: 4 }}>// CÁPSULA DE ESTUDOS</div>
                    <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.1 }}>Missão<br /><span style={{ color: "#C9A352" }}>cumprida.</span></div>
                </div>
                <div style={{ marginBottom: 6, position: "relative" }}>
                    <div style={{ fontSize: 6, color: "rgba(255,255,255,0.3)", letterSpacing: "0.18em", marginBottom: 2 }}>// TEMPO EM MISSÃO</div>
                    <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em" }}>2341</div>
                    <div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>minutos de estudo</div>
                    <div style={{ marginTop: 6, height: 2, background: "#1e1e1e", borderRadius: 1 }}>
                        <div style={{ height: "100%", width: "73%", background: "#C9A352", borderRadius: 1 }} />
                    </div>
                </div>
                <div style={{ height: 1, background: "linear-gradient(90deg, #C9A352, transparent)", margin: "8px 0" }} />
                <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", letterSpacing: "0.18em", marginBottom: 5 }}>// DISCIPLINAS</div>
                {["Dir. Constitucional", "Português", "Raz. Lógico"].map((d, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 9 }}>
                        <span style={{ color: "rgba(255,255,255,0.7)" }}>{d}</span>
                        <span style={{ color: "#C9A352", fontWeight: 700 }}>{[81, 74, 68][i]}%</span>
                    </div>
                ))}
                <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid #1e1e1e", position: "relative" }}>
                    <span style={{ fontSize: 9, color: "#C9A352", letterSpacing: "0.08em" }}>★ SARGENTO</span>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}><strong style={{ color: "rgba(255,255,255,0.8)" }}>73%</strong> acerto</span>
                </div>
            </div>
        ),
    },
    {
        key: "campeao",
        label: "Campeão",
        tagline: "Bold · Verde Vibrante · Barras",
        tags: ["Jovem", "Esportivo", "Instagram"],
        accent: "#16C784",
        bg: "#0d0d0d",
        preview: ({ primary }) => (
            <div style={{
                background: "#0d0d0d", borderRadius: 12, overflow: "hidden",
                aspectRatio: "9/14", display: "flex", flexDirection: "column",
                fontFamily: "system-ui, sans-serif", border: "1px solid #1c1c1c",
            }}>
                <div style={{ padding: "12px 14px 10px", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>CONCURSODEMO</span>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>abr 2026</span>
                </div>
                <div style={{ padding: "0 14px", flex: 1 }}>
                    <div style={{ fontSize: 8, color: "#16C784", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>tempo estudado</div>
                    <div style={{ fontSize: 40, fontWeight: 900, color: "#fff", lineHeight: 0.9, letterSpacing: "-0.04em", marginBottom: 2 }}>2341</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>minutos em abril</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: "#1c1c1c", borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
                        {[["487","questões"],["73%","acerto"],["34","aulas"]].map(([v, l], i) => (
                            <div key={i} style={{ background: "#141414", padding: "8px 4px", textAlign: "center" }}>
                                <div style={{ fontSize: 14, fontWeight: 800, color: i === 1 ? "#16C784" : "#fff" }}>{v}</div>
                                <div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>{l}</div>
                            </div>
                        ))}
                    </div>
                    {["Dir. Constitucional", "Português", "Raz. Lógico"].map((d, i) => (
                        <div key={i} style={{ marginBottom: 5 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.65)" }}>{d}</span>
                                <span style={{ fontSize: 9, color: "#16C784", fontWeight: 700 }}>{[81, 74, 68][i]}%</span>
                            </div>
                            <div style={{ height: 2, background: "#1e1e1e", borderRadius: 1 }}>
                                <div style={{ height: "100%", width: `${[81, 74, 68][i]}%`, background: "#16C784", borderRadius: 1 }} />
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{ background: "#16C784", padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#0d0d0d", textTransform: "uppercase" }}>Sargento</span>
                    <span style={{ fontSize: 8, color: "rgba(0,0,0,0.5)", fontStyle: "italic" }}>Continue firme!</span>
                </div>
            </div>
        ),
    },
    {
        key: "relatorio",
        label: "Relatório",
        tagline: "Editorial · Clean · Premium",
        tags: ["Profissional", "Sofisticado", "LinkedIn"],
        accent: "#ffffff",
        bg: "#111111",
        preview: ({ primary }) => (
            <div style={{
                background: "#111", borderRadius: 12, padding: "16px 14px",
                fontFamily: "system-ui, sans-serif", color: "#fff",
                aspectRatio: "9/14", display: "flex", flexDirection: "column", gap: 0,
                border: "1px solid #222",
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <span style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em" }}>concursodemo</span>
                    <span style={{ background: "#fff", color: "#111", fontSize: 7, fontWeight: 700, padding: "2px 6px", borderRadius: 3, letterSpacing: "0.06em" }}>ABR 2026</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: 12 }}>
                    Cápsula<br />de <span style={{ color: "transparent", WebkitTextStroke: "1px rgba(255,255,255,0.4)" }}>estudos</span>
                </div>
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 2 }}>tempo de estudo</div>
                    <div style={{ fontSize: 34, fontWeight: 900, color: "#fff", lineHeight: 0.95, letterSpacing: "-0.03em" }}>2.341</div>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>minutos</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                    {[["questões","487","respondidas"],["acerto","73%","geral"]].map(([l,v,s]) => (
                        <div key={l} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 6, padding: "8px" }}>
                            <div style={{ fontSize: 6, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>{l}</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{v}</div>
                            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)" }}>{s}</div>
                        </div>
                    ))}
                </div>
                {["Dir. Constitucional","Português","Raz. Lógico"].map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 9 }}>
                        <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: 700, minWidth: 14 }}>0{i+1}</span>
                        <span style={{ color: "rgba(255,255,255,0.8)", flex: 1 }}>{d}</span>
                        <span style={{ color: "#fff", fontWeight: 800 }}>{[81,74,68][i]}%</span>
                    </div>
                ))}
                <div style={{ marginTop: "auto", display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em" }}>patente</div>
                        <div style={{ fontSize: 12, fontWeight: 800 }}>Sargento</div>
                    </div>
                    <div style={{ flex: 1, borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: 8, fontSize: 8, color: "rgba(255,255,255,0.3)", fontStyle: "italic", lineHeight: 1.4 }}>
                        "Seu melhor mês — continue!"
                    </div>
                </div>
            </div>
        ),
    },
];

// ── Página ─────────────────────────────────────────────────────────────────

export default function SharingSettingsPage() {
    const { tenant, setTenant } = useTenantStore();
    const toast = useToast();

    const b = (tenant?.branding ?? {}) as Record<string, any>;
    const [selected, setSelected] = useState<CapsuleStyle>(b.capsule_style ?? "operativo");
    const primary = b.primary_color ?? "#6366f1";

    useEffect(() => {
        const br = (tenant?.branding ?? {}) as Record<string, any>;
        if (br.capsule_style) setSelected(br.capsule_style);
    }, [tenant?.id]);

    const save = useMutation({
        mutationFn: () => apiClient.put("/appearance/", { capsule_style: selected }),
        onSuccess: () => {
            if (tenant) {
                setTenant({
                    ...tenant,
                    branding: { ...tenant.branding, capsule_style: selected } as any,
                });
            }
            toast.success("Estilo salvo!", "Seus alunos verão o novo design ao compartilhar.");
        },
        onError: (err: any) => {
            toast.error("Erro ao salvar", err?.response?.data?.message || "Verifique sua conexão.");
        },
    });

    return (
        <div className="max-w-3xl space-y-8 pb-10">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
                        <Share2 className="h-6 w-6 text-primary" />
                        Cápsula de Estudos
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Escolha o design do card que seus alunos vão compartilhar nas redes sociais.
                    </p>
                </div>
                <Button onClick={() => save.mutate()} disabled={save.isPending} className="shrink-0">
                    {save.isPending
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                        : <><Save className="h-4 w-4 mr-2" />Salvar estilo</>}
                </Button>
            </div>

            {/* Info box */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 text-sm text-muted-foreground leading-relaxed">
                <p>
                    A <strong className="text-foreground">Cápsula de Estudos</strong> é gerada automaticamente todo mês com os dados reais de cada aluno —
                    minutos estudados, taxa de acerto, top disciplinas, patente e uma frase personalizada por IA.
                    O aluno pode baixar a imagem ou compartilhar direto no WhatsApp, Instagram e Stories.
                </p>
            </div>

            {/* Seleção de estilo */}
            <div className="space-y-4">
                <h2 className="text-base font-semibold text-foreground">Escolha o design</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {STYLES.map((style) => {
                        const isSelected = selected === style.key;
                        const Preview = style.preview;
                        return (
                            <button
                                key={style.key}
                                onClick={() => setSelected(style.key)}
                                className={cn(
                                    "relative flex flex-col gap-3 rounded-2xl border-2 p-4 text-left transition-all duration-200",
                                    isSelected
                                        ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                                        : "border-border hover:border-primary/40 hover:bg-accent/20"
                                )}
                            >
                                {/* Preview miniatura */}
                                <div className="w-full max-w-[160px] mx-auto">
                                    <Preview primary={primary} />
                                </div>

                                {/* Info */}
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-foreground">{style.label}</p>
                                        {isSelected && (
                                            <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">
                                                Ativo
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">{style.tagline}</p>
                                    <div className="flex flex-wrap gap-1 pt-1">
                                        {style.tags.map(tag => (
                                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {isSelected && (
                                    <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                        <Check className="h-3 w-3 text-primary-foreground" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Botão salvar final */}
            <div className="flex justify-end pt-4 border-t border-border">
                <Button onClick={() => save.mutate()} disabled={save.isPending} size="lg">
                    {save.isPending
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                        : <><Save className="h-4 w-4 mr-2" />Salvar estilo</>}
                </Button>
            </div>
        </div>
    );
}