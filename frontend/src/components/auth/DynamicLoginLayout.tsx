// frontend/src/components/auth/DynamicLoginLayout.tsx
// Renderiza o layout de login baseado na config do tenant.
// Layouts: split | centered | fullbg | minimal

"use client";

import { useAppearance } from "@/lib/hooks/useAppearance";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { GraduationCap, Shield } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface DynamicLoginLayoutProps {
    children: React.ReactNode; // O formulário de login
}

// ── Layout: Split (padrão) ────────────────────────────────────────────────────
// Metade esquerda: painel da marca | Metade direita: formulário
function SplitLayout({ children }: DynamicLoginLayoutProps) {
    const { getBranding } = useTenantStore();
    const branding = getBranding();

    return (
        <div className="min-h-screen flex">
            {/* Painel esquerdo — identidade da plataforma */}
            <div className={cn(
                "hidden lg:flex flex-col w-1/2 relative overflow-hidden",
                "bg-primary"
            )}>
                {/* Pattern de fundo */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0"
                        style={{
                            backgroundImage: `radial-gradient(circle at 25% 25%, hsl(var(--primary-foreground)) 0%, transparent 50%),
                                             radial-gradient(circle at 75% 75%, hsl(var(--primary-foreground)) 0%, transparent 50%)`,
                        }}
                    />
                </div>

                {/* Conteúdo */}
                <div className="relative z-10 flex flex-col h-full p-12">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary-foreground/20 backdrop-blur flex items-center justify-center">
                            <GraduationCap className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <span className="text-primary-foreground font-bold text-lg">
                            {branding.platform_name}
                        </span>
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                        <h1 className="text-primary-foreground text-4xl font-bold leading-tight mb-4">
                            Sua aprovação começa aqui.
                        </h1>
                        <p className="text-primary-foreground/70 text-lg">
                            Estude de forma inteligente, com cronograma adaptativo e questões direcionadas ao seu edital.
                        </p>

                        {/* Features */}
                        <div className="mt-10 space-y-3">
                            {[
                                { icon: "📅", text: "Cronograma adaptativo com IA" },
                                { icon: "🎯", text: "Questões do seu edital" },
                                { icon: "📊", text: "Analytics de desempenho em tempo real" },
                                { icon: "🏅", text: "Gamificação e conquistas" },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3 text-primary-foreground/80">
                                    <span className="text-xl">{item.icon}</span>
                                    <span className="text-sm">{item.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <p className="text-primary-foreground/40 text-xs">
                        © {new Date().getFullYear()} {branding.platform_name}
                    </p>
                </div>
            </div>

            {/* Painel direito — formulário */}
            <div className="flex-1 flex items-center justify-center p-6 bg-background">
                <div className="w-full max-w-sm">
                    {/* Logo mobile */}
                    <div className="flex items-center gap-2 mb-8 lg:hidden">
                        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                            <GraduationCap className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <span className="font-bold text-foreground">{branding.platform_name}</span>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}

// ── Layout: Centered ──────────────────────────────────────────────────────────
// Formulário centralizado com card, fundo neutro
function CenteredLayout({ children }: DynamicLoginLayoutProps) {
    const { getBranding } = useTenantStore();
    const branding = getBranding();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
                <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/25">
                    <GraduationCap className="h-8 w-8 text-primary-foreground" />
                </div>
                <h1 className="text-xl font-bold text-foreground">{branding.platform_name}</h1>
                <p className="text-sm text-muted-foreground mt-1">Plataforma de estudos para concursos</p>
            </div>

            {/* Card do formulário */}
            <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-xl">
                {children}
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
                © {new Date().getFullYear()} {branding.platform_name}
            </p>
        </div>
    );
}

// ── Layout: Full Background ───────────────────────────────────────────────────
// Imagem ou cor de fundo cobrindo a tela toda, card flutuante no centro
function FullBgLayout({ children }: DynamicLoginLayoutProps) {
    const { getBranding } = useTenantStore();
    const { loginBgUrl, loginBgColor } = useAppearance();
    const branding = getBranding();

    const bgStyle: React.CSSProperties = loginBgUrl
        ? {
            backgroundImage: `url(${loginBgUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
        }
        : {
            background: loginBgColor || "hsl(var(--primary))",
        };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 relative" style={bgStyle}>
            {/* Overlay escuro para garantir legibilidade */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

            {/* Card */}
            <div className="relative z-10 w-full max-w-sm">
                {/* Logo */}
                <div className="flex flex-col items-center mb-6">
                    <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center mb-3">
                        <GraduationCap className="h-7 w-7 text-white" />
                    </div>
                    <h1 className="text-white text-xl font-bold">{branding.platform_name}</h1>
                </div>

                <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl">
                    {children}
                </div>

                <p className="text-center text-white/40 text-xs mt-4">
                    © {new Date().getFullYear()} {branding.platform_name}
                </p>
            </div>
        </div>
    );
}

// ── Layout: Minimal ───────────────────────────────────────────────────────────
// Ultra limpo: só o formulário, sem decoração
function MinimalLayout({ children }: DynamicLoginLayoutProps) {
    const { getBranding } = useTenantStore();
    const branding = getBranding();

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-full max-w-sm px-6">
                {/* Logo muito simples */}
                <div className="flex items-center gap-2 mb-10">
                    <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
                        <Shield className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">{branding.platform_name}</span>
                </div>

                {children}
            </div>
        </div>
    );
}

// ── Export principal ───────────────────────────────────────────────────────────
export function DynamicLoginLayout({ children }: DynamicLoginLayoutProps) {
    const { loginLayout } = useAppearance();

    switch (loginLayout) {
        case "centered": return <CenteredLayout>{children}</CenteredLayout>;
        case "fullbg": return <FullBgLayout>{children}</FullBgLayout>;
        case "minimal": return <MinimalLayout>{children}</MinimalLayout>;
        default: return <SplitLayout>{children}</SplitLayout>;
    }
}