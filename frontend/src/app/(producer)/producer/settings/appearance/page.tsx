// frontend/src/app/(producer)/producer/settings/appearance/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { applyPalette, COLOR_PALETTES } from "@/components/TenantBrandingLoader";
import { useToast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import {
    Palette, Check, Loader2, Sidebar, PanelTop, Minimize2,
    SplitSquareHorizontal, Square, Image, Save, X, Plus,
    Type, List,
} from "lucide-react";
import type { ColorPaletteKey, StudentLayout, ProducerLayout, LoginLayout } from "@/types/tenant";

// ── Dados de layouts ───────────────────────────────────────────────────────────

const STUDENT_LAYOUTS: { key: StudentLayout; label: string; desc: string; icon: React.ElementType }[] = [
    { key: "sidebar", label: "Sidebar Lateral", desc: "Menu fixo na esquerda — clássico e organizado", icon: Sidebar },
    { key: "topbar", label: "Barra Superior", desc: "Menu no topo — mais espaço para conteúdo", icon: PanelTop },
    { key: "minimal", label: "Dock Minimal", desc: "Dock flutuante na parte inferior — moderno e limpo", icon: Minimize2 },
];

const PRODUCER_LAYOUTS: { key: ProducerLayout; label: string; desc: string; icon: React.ElementType }[] = [
    { key: "sidebar", label: "Sidebar Lateral", desc: "Menu fixo na esquerda — padrão profissional", icon: Sidebar },
    { key: "topbar", label: "Barra Superior", desc: "Navegação no topo — mais espaço horizontal", icon: PanelTop },
];

const LOGIN_LAYOUTS: { key: LoginLayout; label: string; desc: string; icon: React.ElementType }[] = [
    { key: "split", label: "Split Screen", desc: "Painel da marca à esq., formulário à dir.", icon: SplitSquareHorizontal },
    { key: "centered", label: "Centralizado", desc: "Formulário centralizado com card elegante", icon: Square },
    { key: "fullbg", label: "Fundo Total", desc: "Imagem ou cor cobrindo a tela toda", icon: Image },
    { key: "minimal", label: "Minimal", desc: "Ultra limpo, sem distrações visuais", icon: Minimize2 },
];

// ── Componentes auxiliares ────────────────────────────────────────────────────

function SectionTitle({ n }: { n: number }) {
    return (
        <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-primary text-xs font-bold">{n}</span>
        </div>
    );
}

function PaletteCard({ paletteKey, selected, onSelect, onPreview, onPreviewEnd }: {
    paletteKey: string; selected: boolean;
    onSelect: () => void; onPreview: () => void; onPreviewEnd: () => void;
}) {
    const palette = COLOR_PALETTES[paletteKey];
    if (!palette) return null;
    return (
        <button onClick={onSelect} onMouseEnter={onPreview} onMouseLeave={onPreviewEnd}
            className={cn(
                "relative flex flex-col gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-left group w-full",
                selected ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                    : "border-border hover:border-primary/40 hover:bg-accent/30"
            )}>
            <div className="flex items-center gap-2">
                {palette.preview.map((color: string, i: number) => (
                    <div key={i} className={cn("rounded-full border border-black/10 transition-transform group-hover:scale-110",
                        i === 0 ? "h-8 w-8" : i === 1 ? "h-6 w-6" : "h-5 w-5")}
                        style={{ backgroundColor: color }} />
                ))}
                <div className="ml-auto">
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                        {palette.dark ? "Dark" : "Light"}
                    </Badge>
                </div>
            </div>
            <div>
                <p className="text-sm font-semibold text-foreground">{palette.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{palette.description}</p>
            </div>
            {selected && (
                <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                </div>
            )}
        </button>
    );
}

function LayoutCard<T extends string>({ item, selected, onSelect }: {
    item: { key: T; label: string; desc: string; icon: React.ElementType };
    selected: boolean; onSelect: () => void;
}) {
    const Icon = item.icon;
    return (
        <button onClick={onSelect}
            className={cn(
                "relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-center w-full",
                selected ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                    : "border-border hover:border-primary/40 hover:bg-accent/30"
            )}>
            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center transition-colors",
                selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
            </div>
            {selected && (
                <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                </div>
            )}
        </button>
    );
}

function LoginPreview({ layout, bgColor }: { layout: LoginLayout; bgColor?: string }) {
    switch (layout) {
        case "split":
            return (
                <div className="flex h-24 rounded-lg overflow-hidden border border-border">
                    <div className="w-1/2 bg-primary/80 flex items-center justify-center">
                        <div className="w-6 h-6 rounded bg-primary-foreground/30" />
                    </div>
                    <div className="w-1/2 bg-background flex items-center justify-center">
                        <div className="space-y-1 w-10">
                            <div className="h-1 bg-muted rounded" /><div className="h-1 bg-muted rounded" />
                            <div className="h-2 bg-primary rounded" />
                        </div>
                    </div>
                </div>
            );
        case "centered":
            return (
                <div className="h-24 bg-muted/50 flex items-center justify-center rounded-lg border border-border">
                    <div className="bg-card border border-border rounded-lg p-3 space-y-1 w-14">
                        <div className="h-3 w-3 bg-primary rounded-full mx-auto" />
                        <div className="h-1 bg-muted rounded" /><div className="h-1 bg-muted rounded" />
                        <div className="h-2 bg-primary rounded" />
                    </div>
                </div>
            );
        case "fullbg":
            return (
                <div className="h-24 flex items-center justify-center rounded-lg border border-border overflow-hidden relative"
                    style={{ background: bgColor || "hsl(var(--primary))" }}>
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="relative bg-card/90 border border-border/50 rounded-lg p-3 space-y-1 w-14 backdrop-blur-sm">
                        <div className="h-1 bg-muted rounded" /><div className="h-1 bg-muted rounded" />
                        <div className="h-2 bg-primary rounded" />
                    </div>
                </div>
            );
        case "minimal":
            return (
                <div className="h-24 bg-background flex items-start justify-start p-3 rounded-lg border border-border">
                    <div className="space-y-1 w-full">
                        <div className="flex items-center gap-1 mb-2">
                            <div className="h-2 w-2 bg-primary rounded" />
                            <div className="h-1 w-8 bg-foreground/30 rounded" />
                        </div>
                        <div className="h-1 bg-muted rounded w-10" /><div className="h-1 bg-muted rounded w-10" />
                        <div className="h-2 bg-primary rounded w-10" />
                    </div>
                </div>
            );
    }
}

// ── Defaults do conteúdo de login ─────────────────────────────────────────────

const DEFAULT_BADGE = "Rumo à Aprovação";
const DEFAULT_HEADLINE = "Sua aprovação começa aqui.";
const DEFAULT_SUBTEXT = "Estudo inteligente com cronograma adaptativo, questões com feedback e simulados completos.";
const DEFAULT_FEATURES = ["Cronograma Personalizado", "Questões do seu edital", "Simulados Estratégicos", "Dashboard Inteligente"];
const DEFAULT_FORM_TITLE = "Entrar";
const DEFAULT_FORM_SUBTITLE = "Acesse sua conta para continuar estudando.";

// ── Input e Textarea reutilizáveis ────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">{label}</label>
            {children}
            {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
        </div>
    );
}

const inputCls = "w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors placeholder:text-muted-foreground";
const textareaCls = "w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors placeholder:text-muted-foreground";

// ── Página principal ──────────────────────────────────────────────────────────

export default function AppearancePage() {
    const { tenant, setTenant } = useTenantStore();
    const toast = useToast();
    const queryClient = useQueryClient();

    const b = (tenant?.branding ?? {}) as Record<string, any>;

    // ── Estado: visual ────────────────────────────────────────────────────────
    const [selectedPalette, setSelectedPalette] = useState<ColorPaletteKey | "custom">(b.color_palette || "classic");
    const [layoutStudent, setLayoutStudent] = useState<StudentLayout>(b.layout_student || "sidebar");
    const [layoutProducer, setLayoutProducer] = useState<ProducerLayout>(b.layout_producer || "sidebar");
    const [loginLayout, setLoginLayout] = useState<LoginLayout>(b.login_layout || "split");
    const [loginBgColor, setLoginBgColor] = useState<string>(b.login_bg_color || "#4F46E5");
    const [previewKey, setPreviewKey] = useState<string | null>(null);

    // ── Estado: conteúdo do login (editável pelo produtor) ────────────────────
    const [loginBadge, setLoginBadge] = useState<string>(b.login_badge || DEFAULT_BADGE);
    const [loginHeadline, setLoginHeadline] = useState<string>(b.login_headline || DEFAULT_HEADLINE);
    const [loginSubtext, setLoginSubtext] = useState<string>(b.login_subtext || DEFAULT_SUBTEXT);
    const [loginFeatures, setLoginFeatures] = useState<string[]>(b.login_features || DEFAULT_FEATURES);
    const [loginFormTitle, setLoginFormTitle] = useState<string>(b.login_form_title || DEFAULT_FORM_TITLE);
    const [loginFormSubtitle, setLoginFormSubtitle] = useState<string>(b.login_form_subtitle || DEFAULT_FORM_SUBTITLE);
    const [newFeature, setNewFeature] = useState<string>("");

    // ── Sincroniza quando tenant.id muda (reload / primeiro carregamento) ─────
    useEffect(() => {
        const br = (tenant?.branding ?? {}) as Record<string, any>;
        if (br.color_palette) setSelectedPalette(br.color_palette);
        if (br.layout_student) setLayoutStudent(br.layout_student);
        if (br.layout_producer) setLayoutProducer(br.layout_producer);
        if (br.login_layout) setLoginLayout(br.login_layout);
        if (br.login_bg_color) setLoginBgColor(br.login_bg_color);
        if (br.login_badge) setLoginBadge(br.login_badge);
        if (br.login_headline) setLoginHeadline(br.login_headline);
        if (br.login_subtext) setLoginSubtext(br.login_subtext);
        if (br.login_features) setLoginFeatures(br.login_features);
        if (br.login_form_title) setLoginFormTitle(br.login_form_title);
        if (br.login_form_subtitle) setLoginFormSubtitle(br.login_form_subtitle);
    }, [tenant?.id]);

    // ── Busca dados frescos do servidor sem bloquear a UI ─────────────────────
    useEffect(() => {
        apiClient.get("/appearance/")
            .then(res => {
                const a = res.data?.appearance;
                if (!a) return;
                if (a.color_palette) setSelectedPalette(a.color_palette);
                if (a.layout_student) setLayoutStudent(a.layout_student);
                if (a.layout_producer) setLayoutProducer(a.layout_producer);
                if (a.login_layout) setLoginLayout(a.login_layout);
                if (a.login_bg_color) setLoginBgColor(a.login_bg_color || "#4F46E5");
                if (a.login_badge) setLoginBadge(a.login_badge);
                if (a.login_headline) setLoginHeadline(a.login_headline);
                if (a.login_subtext) setLoginSubtext(a.login_subtext);
                if (a.login_features) setLoginFeatures(a.login_features);
                if (a.login_form_title) setLoginFormTitle(a.login_form_title);
                if (a.login_form_subtitle) setLoginFormSubtitle(a.login_form_subtitle);
            })
            .catch(() => { });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Preview de paleta ─────────────────────────────────────────────────────
    const handlePreview = (key: string) => { setPreviewKey(key); applyPalette(key); };
    const handlePreviewEnd = () => { setPreviewKey(null); applyPalette(selectedPalette); };
    const handleSelectPalette = (key: ColorPaletteKey | "custom") => { setSelectedPalette(key); applyPalette(key); };

    // ── Helpers de features ───────────────────────────────────────────────────
    const updateFeature = (i: number, val: string) => {
        const next = [...loginFeatures]; next[i] = val; setLoginFeatures(next);
    };
    const removeFeature = (i: number) => setLoginFeatures(loginFeatures.filter((_, j) => j !== i));
    const addFeature = () => {
        const v = newFeature.trim();
        if (!v) return;
        setLoginFeatures([...loginFeatures, v]);
        setNewFeature("");
    };

    // ── Salvar ────────────────────────────────────────────────────────────────
    const save = useMutation({
        mutationFn: () => apiClient.put("/appearance/", {
            // visual
            color_palette: selectedPalette,
            layout_student: layoutStudent,
            layout_producer: layoutProducer,
            login_layout: loginLayout,
            login_bg_color: loginBgColor,
            // conteúdo do login
            login_badge: loginBadge,
            login_headline: loginHeadline,
            login_subtext: loginSubtext,
            login_features: loginFeatures,
            login_form_title: loginFormTitle,
            login_form_subtitle: loginFormSubtitle,
        }),
        onSuccess: (res) => {
            const cssVars = res.data?.css_vars as Record<string, string> | undefined;
            if (cssVars) {
                const root = document.documentElement;
                Object.entries(cssVars).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
                if (COLOR_PALETTES[selectedPalette]?.dark) {
                    document.documentElement.classList.add("dark");
                } else {
                    document.documentElement.classList.remove("dark");
                }
            }
            if (tenant) {
                setTenant({
                    ...tenant,
                    branding: {
                        ...tenant.branding,
                        color_palette: selectedPalette,
                        layout_student: layoutStudent,
                        layout_producer: layoutProducer,
                        login_layout: loginLayout,
                        login_bg_color: loginBgColor,
                        login_badge: loginBadge,
                        login_headline: loginHeadline,
                        login_subtext: loginSubtext,
                        login_features: loginFeatures,
                        login_form_title: loginFormTitle,
                        login_form_subtitle: loginFormSubtitle,
                    } as any,
                });
            }
            toast.success("Aparência salva!", "Alterações aplicadas à plataforma.");
            queryClient.invalidateQueries({ queryKey: ["appearance"] });
        },
        onError: (err: any) => {
            toast.error("Erro ao salvar", err?.response?.data?.message || "Verifique sua conexão.");
        },
    });

    const activePaletteName = COLOR_PALETTES[selectedPalette]?.name || selectedPalette;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-4xl space-y-8 pb-10">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
                        <Palette className="h-6 w-6 text-primary" />
                        Aparência
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Tema visual, layouts de navegação e tela de login.
                    </p>
                </div>
                <Button onClick={() => save.mutate()} disabled={save.isPending} className="shrink-0">
                    {save.isPending
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                        : <><Save className="h-4 w-4 mr-2" />Salvar alterações</>}
                </Button>
            </div>

            {/* ── 1. Paletas ── */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <SectionTitle n={1} />
                    <h2 className="text-base font-semibold text-foreground">Paleta de cores</h2>
                    <Badge variant="outline" className="text-xs">
                        {previewKey ? `Preview: ${COLOR_PALETTES[previewKey]?.name}` : `Ativa: ${activePaletteName}`}
                    </Badge>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">Passe o mouse para pré-visualizar. Clique para selecionar.</p>

                <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-slate-800 border border-slate-600" />
                        Temas escuros — popular em concursos policiais e militares
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {["midnight", "tactical", "carbon", "slate_dark"].map(key => (
                            <PaletteCard key={key} paletteKey={key}
                                selected={selectedPalette === key}
                                onSelect={() => handleSelectPalette(key as ColorPaletteKey)}
                                onPreview={() => handlePreview(key)}
                                onPreviewEnd={handlePreviewEnd} />
                        ))}
                    </div>
                </div>

                <div className="mt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-white border border-gray-300" />
                        Temas claros
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {["classic", "emerald", "warm"].map(key => (
                            <PaletteCard key={key} paletteKey={key}
                                selected={selectedPalette === key}
                                onSelect={() => handleSelectPalette(key as ColorPaletteKey)}
                                onPreview={() => handlePreview(key)}
                                onPreviewEnd={handlePreviewEnd} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ── 2. Layout aluno ── */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <SectionTitle n={2} />
                    <h2 className="text-base font-semibold text-foreground">Layout do portal do aluno</h2>
                    <Badge variant="outline" className="text-xs capitalize">{layoutStudent}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {STUDENT_LAYOUTS.map(item => (
                        <LayoutCard key={item.key} item={item}
                            selected={layoutStudent === item.key}
                            onSelect={() => setLayoutStudent(item.key)} />
                    ))}
                </div>
            </section>

            {/* ── 3. Layout produtor ── */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <SectionTitle n={3} />
                    <h2 className="text-base font-semibold text-foreground">Layout do seu painel</h2>
                    <Badge variant="outline" className="text-xs capitalize">{layoutProducer}</Badge>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">Recarregue a página após salvar para ver o novo layout.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PRODUCER_LAYOUTS.map(item => (
                        <LayoutCard key={item.key} item={item}
                            selected={layoutProducer === item.key}
                            onSelect={() => setLayoutProducer(item.key)} />
                    ))}
                </div>
            </section>

            {/* ── 4. Layout de login ── */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <SectionTitle n={4} />
                    <h2 className="text-base font-semibold text-foreground">Estilo da tela de login</h2>
                    <Badge variant="outline" className="text-xs capitalize">{loginLayout}</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {LOGIN_LAYOUTS.map(item => {
                        const isSelected = loginLayout === item.key;
                        return (
                            <button key={item.key} onClick={() => setLoginLayout(item.key)}
                                className={cn(
                                    "relative flex flex-col gap-2 rounded-xl border-2 overflow-hidden transition-all duration-200 text-left",
                                    isSelected ? "border-primary shadow-md shadow-primary/10" : "border-border hover:border-primary/40"
                                )}>
                                <div className="p-2 pb-0">
                                    <LoginPreview layout={item.key} bgColor={loginBgColor} />
                                </div>
                                <div className="px-3 pb-3">
                                    <p className="text-xs font-semibold text-foreground">{item.label}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                                </div>
                                {isSelected && (
                                    <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {loginLayout === "fullbg" && (
                    <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                        <p className="text-sm font-medium text-foreground">Cor de fundo do login</p>
                        <div className="flex items-center gap-3">
                            <input type="color" value={loginBgColor}
                                onChange={e => setLoginBgColor(e.target.value)}
                                className="h-10 w-16 rounded-lg border border-border cursor-pointer bg-transparent" />
                            <p className="text-xs text-muted-foreground">
                                Um overlay escuro é aplicado automaticamente para garantir legibilidade.
                            </p>
                        </div>
                    </div>
                )}
            </section>

            {/* ── 5. Conteúdo da tela de login ── */}
            <section className="space-y-5">
                <div className="flex items-center gap-2">
                    <SectionTitle n={5} />
                    <h2 className="text-base font-semibold text-foreground">Conteúdo da tela de login</h2>
                    <Badge variant="outline" className="text-xs">Editável</Badge>
                </div>
                <p className="text-xs text-muted-foreground -mt-3">
                    Personalize os textos exibidos na tela de login. A logo vem do Branding.
                </p>

                {/* Painel esquerdo (layout Split) */}
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-4">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Type className="h-3.5 w-3.5 text-primary" />
                        Painel esquerdo <span className="font-normal text-muted-foreground">(layout Split)</span>
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Badge" hint="Pequeno destaque no topo esquerdo.">
                            <input value={loginBadge} onChange={e => setLoginBadge(e.target.value)}
                                placeholder={DEFAULT_BADGE} className={inputCls} />
                        </Field>

                        <Field label="Headline principal" hint="Frase de impacto em destaque.">
                            <input value={loginHeadline} onChange={e => setLoginHeadline(e.target.value)}
                                placeholder={DEFAULT_HEADLINE} className={inputCls} />
                        </Field>

                        <Field label="Descrição" hint="Subtexto abaixo da headline." >
                            <textarea value={loginSubtext} onChange={e => setLoginSubtext(e.target.value)}
                                placeholder={DEFAULT_SUBTEXT} rows={2} className={textareaCls} />
                        </Field>
                    </div>

                    {/* Lista de diferenciais */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                            <List className="h-3.5 w-3.5 text-primary" />
                            Lista de diferenciais
                        </label>

                        <div className="space-y-2">
                            {loginFeatures.map((feature, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <input value={feature} onChange={e => updateFeature(i, e.target.value)}
                                        className={cn(inputCls, "flex-1")} />
                                    <button onClick={() => removeFeature(i)}
                                        className="h-9 w-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors shrink-0">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            <input value={newFeature} onChange={e => setNewFeature(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }}
                                placeholder="Novo diferencial... (Enter para adicionar)"
                                className={cn(inputCls, "flex-1")} />
                            <button onClick={addFeature}
                                className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1 shrink-0">
                                <Plus className="h-3.5 w-3.5" /> Adicionar
                            </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Máximo recomendado: 5 itens.</p>
                    </div>
                </div>

                {/* Formulário */}
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-4">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Type className="h-3.5 w-3.5 text-primary" />
                        Formulário de login <span className="font-normal text-muted-foreground">(todos os layouts)</span>
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Título do formulário">
                            <input value={loginFormTitle} onChange={e => setLoginFormTitle(e.target.value)}
                                placeholder={DEFAULT_FORM_TITLE} className={inputCls} />
                        </Field>

                        <Field label="Subtítulo do formulário">
                            <input value={loginFormSubtitle} onChange={e => setLoginFormSubtitle(e.target.value)}
                                placeholder={DEFAULT_FORM_SUBTITLE} className={inputCls} />
                        </Field>
                    </div>
                </div>
            </section>

            {/* Botão salvar final */}
            <div className="flex justify-end pt-4 border-t border-border">
                <Button onClick={() => save.mutate()} disabled={save.isPending} size="lg">
                    {save.isPending
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                        : <><Save className="h-4 w-4 mr-2" />Salvar alterações</>}
                </Button>
            </div>
        </div>
    );
}