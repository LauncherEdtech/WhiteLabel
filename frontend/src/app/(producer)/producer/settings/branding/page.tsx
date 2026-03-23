// frontend/src/app/(producer)/producer/settings/branding/page.tsx
"use client";

import { apiClient } from "@/lib/api/client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { useToast } from "@/components/ui/toaster";
import { applyBrandingCssVars } from "@/components/TenantBrandingLoader";
import { GraduationCap, Palette, Mail, Check, Loader2 } from "lucide-react";
import Cookies from "js-cookie";

const PRESET_COLORS = [
    "#4F46E5", "#7C3AED", "#DC2626", "#EA580C",
    "#16A34A", "#0891B2", "#DB2777", "#374151",
    "#1D4ED8", "#B45309", "#065F46", "#6B21A8",
];

interface BrandingForm {
    platform_name: string;
    support_email: string;
}

export default function BrandingSettingsPage() {
    const { getBranding, tenant, setTenant } = useTenantStore();
    const toast = useToast();
    const [loadingTenant, setLoadingTenant] = useState(!tenant);
    const [saving, setSaving] = useState(false);

    // ── Garante que o tenant está carregado antes de qualquer coisa ──────────
    useEffect(() => {
        if (tenant) {
            setLoadingTenant(false);
            return;
        }
        const slug = Cookies.get("tenant_slug") || "concurso-demo";

        fetch(`/api/v1/tenants/by-slug/${slug}`, {
            headers: { "X-Tenant-Slug": slug },
        })
            .then(r => r.json())
            .then(data => {
                // resposta vem em data.tenant, não em data diretamente
                const tenantData = data?.tenant;
                if (tenantData?.id) {
                    setTenant(tenantData);
                    if (tenantData.branding) applyBrandingCssVars(tenantData.branding);
                }
            })

            .catch(console.error)
            .finally(() => setLoadingTenant(false));
    }, [tenant, setTenant]);

    const branding = getBranding();
    const [primaryColor, setPrimaryColor] = useState(branding.primary_color);
    const [secondaryColor, setSecondaryColor] = useState(branding.secondary_color);

    // Sincroniza cores quando o tenant carrega
    useEffect(() => {
        if (tenant?.branding) {
            const b = tenant.branding as any;
            setPrimaryColor(b.primary_color || "#4F46E5");
            setSecondaryColor(b.secondary_color || "#10B981");
        }
    }, [tenant]);

    const { register, handleSubmit, watch, reset } = useForm<BrandingForm>({
        defaultValues: {
            platform_name: branding.platform_name,
            support_email: branding.support_email || "",
        },
    });

    // Sincroniza form quando o tenant carrega
    useEffect(() => {
        if (tenant?.branding) {
            const b = tenant.branding as any;
            reset({
                platform_name: b.platform_name || "Plataforma de Estudos",
                support_email: b.support_email || "",
            });
        }
    }, [tenant, reset]);

    const currentName = watch("platform_name");

    const handleSave = async (data: BrandingForm) => {
        if (!tenant?.id) {
            toast.error("Erro", "Tenant não identificado. Recarregue a página.");
            return;
        }

        setSaving(true);
        try {
            const response = await apiClient.put(`/tenants/${tenant.id}/branding`, {
                primary_color: primaryColor,
                secondary_color: secondaryColor,
                platform_name: data.platform_name,
                support_email: data.support_email,
            });

            const savedBranding = response.data?.branding || {
                primary_color: primaryColor,
                secondary_color: secondaryColor,
                platform_name: data.platform_name,
                support_email: data.support_email,
            };

            setTenant({ ...tenant, branding: savedBranding as any });
            applyBrandingCssVars(savedBranding);

            toast.success("Configurações salvas!", "Alterações aplicadas em tempo real.");
        } catch (err: any) {
            console.error("Branding save error:", err?.response?.data || err?.message);
            toast.error(
                "Erro ao salvar",
                err?.response?.data?.message || "Verifique sua conexão e tente novamente."
            );
        } finally {
            setSaving(false);
        }
    };

    if (loadingTenant) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando configurações...</span>
            </div>
        );
    }

    return (
        <div className="max-w-2xl space-y-6 animate-fade-in">
            <div>
                <h1 className="font-display text-2xl font-bold text-foreground">Branding</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Personalize a identidade visual da sua plataforma
                </p>
            </div>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <GraduationCap className="h-4 w-4" />
                        Preview
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: primaryColor }}>
                            <GraduationCap className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">
                                {currentName || "Plataforma de Estudos"}
                            </p>
                            <p className="text-xs text-muted-foreground">Painel do Produtor</p>
                        </div>
                        <div className="ml-auto flex gap-2">
                            <div className="h-4 w-4 rounded-full border-2 border-white shadow-sm"
                                style={{ backgroundColor: primaryColor }} />
                            <div className="h-4 w-4 rounded-full border-2 border-white shadow-sm"
                                style={{ backgroundColor: secondaryColor }} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <GraduationCap className="h-4 w-4" />
                            Nome da Plataforma
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Input {...register("platform_name")} placeholder="Ex: Curso Aprovação PCDF" />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Palette className="h-4 w-4" />
                            Cor Primária
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {PRESET_COLORS.map(color => (
                                <button key={color} type="button" onClick={() => setPrimaryColor(color)}
                                    className="h-8 w-8 rounded-lg border-2 transition-all flex items-center justify-center"
                                    style={{
                                        backgroundColor: color,
                                        borderColor: primaryColor === color ? "white" : "transparent",
                                        boxShadow: primaryColor === color ? `0 0 0 2px ${color}` : "none",
                                    }}>
                                    {primaryColor === color && <Check className="h-4 w-4 text-white" />}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="color" value={primaryColor}
                                onChange={e => setPrimaryColor(e.target.value)}
                                className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent" />
                            <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                                placeholder="#4F46E5" className="w-32 font-mono text-sm" />
                            <span className="text-xs text-muted-foreground">Cor personalizada</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Palette className="h-4 w-4" />
                            Cor Secundária
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {PRESET_COLORS.map(color => (
                                <button key={color} type="button" onClick={() => setSecondaryColor(color)}
                                    className="h-8 w-8 rounded-lg border-2 transition-all flex items-center justify-center"
                                    style={{
                                        backgroundColor: color,
                                        borderColor: secondaryColor === color ? "white" : "transparent",
                                        boxShadow: secondaryColor === color ? `0 0 0 2px ${color}` : "none",
                                    }}>
                                    {secondaryColor === color && <Check className="h-4 w-4 text-white" />}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="color" value={secondaryColor}
                                onChange={e => setSecondaryColor(e.target.value)}
                                className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent" />
                            <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                                placeholder="#10B981" className="w-32 font-mono text-sm" />
                            <span className="text-xs text-muted-foreground">Cor personalizada</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            E-mail de Suporte
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Input {...register("support_email")} type="email"
                            placeholder="suporte@suaplataforma.com" />
                        <p className="text-xs text-muted-foreground mt-1">
                            Exibido para alunos na tela de ajuda
                        </p>
                    </CardContent>
                </Card>

                <Button type="submit" disabled={saving} className="w-full">
                    {saving
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                        : "Salvar Configurações"
                    }
                </Button>
            </form>
        </div>
    );
}