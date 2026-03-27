// frontend/src/app/(auth)/[tenant]/login/LoginPageClient.tsx
// FIXES:
// 1. Cookie setado dentro do onSubmit (antes da API call) — sem race condition
// 2. Import de TenantBrandingLoader apenas para applyBrandingCssVars (não COLOR_PALETTES)
// 3. Conteúdo do login editável pelo produtor via branding JSON

"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Eye, EyeOff, GraduationCap, Shield, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { useLogin } from "@/lib/hooks/useAuth";
import { applyBrandingCssVars } from "@/components/TenantBrandingLoader";
import { cn } from "@/lib/utils/cn";
import { AxiosError } from "axios";
import Cookies from "js-cookie";

const loginSchema = z.object({
    email: z.string().email("E-mail inválido"),
    password: z.string().min(1, "Senha obrigatória"),
});
type LoginForm = z.infer<typeof loginSchema>;

export interface TenantData {
    id: string;
    name: string;
    slug: string;
    plan: string;
    branding: Record<string, any>;
    features: Record<string, boolean>;
}

interface Props {
    tenant: TenantData | null;
    tenantSlug: string;
}

// ── Conteúdo editável pelo produtor ──────────────────────────────────────────
function getContent(branding: Record<string, any>) {
    return {
        badge: branding.login_badge ?? "Rumo à Aprovação",
        headline: branding.login_headline ?? "Sua aprovação começa aqui.",
        subtext: branding.login_subtext ?? "Estudo inteligente com cronograma adaptativo, questões com feedback e simulados completos.",
        features: (branding.login_features ?? [
            "Cronograma Personalizado",
            "Questões do seu edital",
            "Simulados Estratégicos",
            "Dashboard Inteligente",
        ]) as string[],
        formTitle: branding.login_form_title ?? "Entrar",
        formSubtitle: branding.login_form_subtitle ?? "Acesse sua conta para continuar estudando.",
        logoUrl: (branding.logo_url ?? null) as string | null,
        platformName: branding.platform_name ?? "Plataforma de Estudos",
    };
}

// ── Formulário ────────────────────────────────────────────────────────────────
function LoginForm({
    tenantSlug, formTitle, formSubtitle, logoUrl, platformName,
}: {
    tenantSlug: string;
    formTitle: string;
    formSubtitle: string;
    logoUrl?: string | null;
    platformName?: string;
}) {
    const [showPassword, setShowPassword] = useState(false);
    const [serverError, setServerError] = useState("");
    const login = useLogin();

    const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginForm) => {
        // FIX crítico: seta o cookie imediatamente antes da chamada API
        // Garante que X-Tenant-Slug será enviado corretamente pelo apiClient
        Cookies.set("tenant_slug", tenantSlug, { sameSite: "lax", expires: 1 });
        setServerError("");
        try {
            await login.mutateAsync(data);
        } catch (err) {
            const e = err as AxiosError<{ message: string }>;
            setServerError(e.response?.data?.message ?? "Erro ao fazer login. Tente novamente.");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={platformName} className="h-10 mb-5 object-contain" />
                ) : (
                    <div className="flex items-center gap-2 mb-5 lg:hidden">
                        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                            <GraduationCap className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <span className="font-bold text-sm text-foreground">{platformName}</span>
                    </div>
                )}
                <h2 className="font-display text-2xl font-bold text-foreground">{formTitle}</h2>
                <p className="text-muted-foreground text-sm mt-1">{formSubtitle}</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">E-mail</label>
                    <input
                        {...register("email")}
                        type="email"
                        autoComplete="email"
                        placeholder="seu@email.com"
                        className={cn(
                            "w-full h-10 px-3 rounded-lg border bg-background text-sm text-foreground",
                            "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                            "transition-colors placeholder:text-muted-foreground",
                            errors.email ? "border-destructive" : "border-input hover:border-ring"
                        )}
                    />
                    {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-foreground">Senha</label>
                        <Link href={`/${tenantSlug}/forgot-password`} className="text-xs text-primary hover:underline">
                            Esqueceu a senha?
                        </Link>
                    </div>
                    <div className="relative">
                        <input
                            {...register("password")}
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            placeholder="Sua senha"
                            className={cn(
                                "w-full h-10 px-3 pr-10 rounded-lg border bg-background text-sm text-foreground",
                                "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                                "transition-colors placeholder:text-muted-foreground",
                                errors.password ? "border-destructive" : "border-input hover:border-ring"
                            )}
                        />
                        <button type="button" onClick={() => setShowPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                </div>

                {serverError && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <p className="text-sm text-destructive">{serverError}</p>
                    </div>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={login.isPending}>
                    {login.isPending ? "Entrando..." : "Entrar"}
                </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
                Não tem conta?{" "}
                <Link href={`/${tenantSlug}/register`} className="text-primary font-medium hover:underline">
                    Criar conta
                </Link>
            </p>
        </div>
    );
}

// ── Layouts ───────────────────────────────────────────────────────────────────

type ContentType = ReturnType<typeof getContent>;

function SplitLayout({ c, tenantSlug }: { c: ContentType; tenantSlug: string }) {
    return (
        <div className="min-h-screen flex">
            {/* Esquerda */}
            <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12">
                <div className="inline-flex items-center gap-2 bg-white/15 border border-white/20
                    text-white text-sm font-semibold px-4 py-1.5 rounded-full w-fit">
                    🎯 {c.badge}
                </div>
                <div className="space-y-6">
                    <h1 className="font-display text-4xl font-bold text-white leading-tight">{c.headline}</h1>
                    <p className="text-white/70 text-lg leading-relaxed">{c.subtext}</p>
                    {c.features.length > 0 && (
                        <ul className="space-y-3 pt-2">
                            {c.features.map((f, i) => (
                                <li key={i} className="flex items-center gap-3 text-white/80">
                                    <CheckCircle2 className="h-4 w-4 text-white/50 shrink-0" />
                                    <span className="text-sm">{f}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <p className="text-white/30 text-xs">© {new Date().getFullYear()} {c.platformName}</p>
            </div>

            {/* Direita */}
            <div className="flex-1 flex items-center justify-center p-8 bg-background">
                <div className="w-full max-w-sm">
                    {/* Logo visível apenas no desktop (lado direito) */}
                    {c.logoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.logoUrl} alt={c.platformName}
                            className="h-12 mb-8 object-contain hidden lg:block" />
                    )}
                    <LoginForm tenantSlug={tenantSlug} formTitle={c.formTitle}
                        formSubtitle={c.formSubtitle} logoUrl={c.logoUrl} platformName={c.platformName} />
                </div>
            </div>
        </div>
    );
}

function CenteredLayout({ c, tenantSlug }: { c: ContentType; tenantSlug: string }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
            <div className="flex flex-col items-center mb-8">
                {c.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logoUrl} alt={c.platformName} className="h-14 mb-4 object-contain" />
                ) : (
                    <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/25">
                        <GraduationCap className="h-8 w-8 text-primary-foreground" />
                    </div>
                )}
                <h1 className="text-xl font-bold text-foreground">{c.platformName}</h1>
                <p className="text-sm text-muted-foreground mt-1 text-center max-w-xs">{c.subtext}</p>
            </div>
            <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-xl">
                <LoginForm tenantSlug={tenantSlug} formTitle={c.formTitle} formSubtitle={c.formSubtitle} />
            </div>
            <p className="mt-6 text-xs text-muted-foreground">© {new Date().getFullYear()} {c.platformName}</p>
        </div>
    );
}

function FullBgLayout({ c, tenantSlug, branding }: { c: ContentType; tenantSlug: string; branding: Record<string, any> }) {
    const bgStyle: React.CSSProperties = branding.login_bg_url
        ? { backgroundImage: `url(${branding.login_bg_url})`, backgroundSize: "cover", backgroundPosition: "center" }
        : { background: branding.login_bg_color ?? "hsl(var(--primary))" };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 relative" style={bgStyle}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
            <div className="relative z-10 w-full max-w-sm">
                <div className="flex flex-col items-center mb-6">
                    {c.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.logoUrl} alt={c.platformName} className="h-12 mb-3 object-contain" />
                    ) : (
                        <>
                            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center mb-3">
                                <GraduationCap className="h-7 w-7 text-white" />
                            </div>
                            <h1 className="text-white text-xl font-bold">{c.platformName}</h1>
                        </>
                    )}
                </div>
                <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl">
                    <LoginForm tenantSlug={tenantSlug} formTitle={c.formTitle} formSubtitle={c.formSubtitle} />
                </div>
            </div>
        </div>
    );
}

function MinimalLayout({ c, tenantSlug }: { c: ContentType; tenantSlug: string }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-full max-w-sm px-6">
                <div className="flex items-center gap-2 mb-10">
                    {c.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.logoUrl} alt={c.platformName} className="h-7 object-contain" />
                    ) : (
                        <>
                            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
                                <Shield className="h-3.5 w-3.5 text-primary-foreground" />
                            </div>
                            <span className="text-sm font-semibold text-foreground">{c.platformName}</span>
                        </>
                    )}
                </div>
                <LoginForm tenantSlug={tenantSlug} formTitle={c.formTitle} formSubtitle={c.formSubtitle} />
            </div>
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function LoginPageClient({ tenant, tenantSlug }: Props) {
    const { setTenant } = useTenantStore();
    const branding = (tenant?.branding ?? {}) as Record<string, any>;
    const loginLayout: string = branding.login_layout ?? "split";
    const c = getContent(branding);

    useEffect(() => {
        Cookies.set("tenant_slug", tenantSlug, { sameSite: "lax", expires: 1 });
        if (tenant) {
            setTenant(tenant as any);
            applyBrandingCssVars(branding);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const props = { c, tenantSlug };

    switch (loginLayout) {
        case "centered": return <CenteredLayout {...props} />;
        case "fullbg": return <FullBgLayout   {...props} branding={branding} />;
        case "minimal": return <MinimalLayout  {...props} />;
        default: return <SplitLayout    {...props} />;
    }
}