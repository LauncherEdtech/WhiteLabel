// frontend/src/app/(producer)/producer/settings/branding/page.tsx
"use client";

import { apiClient } from "@/lib/api/client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { useToast } from "@/components/ui/toaster";
import { GraduationCap, Palette, Mail } from "lucide-react";

const PRESET_COLORS = [
    "#4F46E5", "#7C3AED", "#DC2626", "#EA580C",
    "#16A34A", "#0891B2", "#DB2777", "#374151",
];

interface BrandingForm {
    platform_name: string;
    support_email: string;
}

export default function BrandingSettingsPage() {
    const { getBranding, tenant, setTenant } = useTenantStore();
    const branding = getBranding();
    const toast = useToast();
    const [primaryColor, setPrimaryColor] = useState(branding.primary_color);
    const [saving, setSaving] = useState(false);

    const { register, handleSubmit, watch } = useForm<BrandingForm>({
        defaultValues: {
            platform_name: branding.platform_name,
            support_email: branding.support_email || "",
        },
    });

    const currentName = watch("platform_name");

    const handleSave = async (data: BrandingForm) => {
        setSaving(true);
        try {
            if (!tenant?.id) throw new Error("Tenant não encontrado");

            // 1. Salva na API
            await apiClient.put(`/tenants/${tenant.id}/branding`, {
                primary_color: primaryColor,
                platform_name: data.platform_name,
                support_email: data.support_email,
            });

            // 2. Atualiza o tenantStore — persiste no localStorage
            setTenant({
                ...tenant,
                branding: {
                    ...(tenant.branding as Record<string, unknown>),
                    primary_color: primaryColor,
                    platform_name: data.platform_name,
                    support_email: data.support_email || "",
                } as any,
            });

            // 3. Aplica CSS vars imediatamente
            const hsl = hexToHslString(primaryColor);
            document.documentElement.style.setProperty("--primary", hsl);
            document.documentElement.style.setProperty("--ring", hsl);
            document.title = data.platform_name;

            toast.success("Configurações salvas!", "Alterações aplicadas em tempo real.");
        } catch {
            toast.error("Erro ao salvar configurações");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl space-y-6 animate-fade-in">
            <div>
                <h1 className="font-display text-2xl font-bold text-foreground">Branding</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Personalize a aparência da sua plataforma
                </p>
            </div>

            <form onSubmit={handleSubmit(handleSave)} className="space-y-5">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <GraduationCap className="h-4 w-4 text-primary" />
                            Identidade
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground">
                                Nome da plataforma
                            </label>
                            <Input {...register("platform_name")} placeholder="Ex: Aprova Jurídico" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" /> E-mail de suporte
                            </label>
                            <Input
                                {...register("support_email")}
                                type="email"
                                placeholder="suporte@seusite.com"
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Palette className="h-4 w-4 text-primary" />
                            Cor principal
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                className="h-10 w-16 rounded-lg border border-border cursor-pointer"
                            />
                            <Input
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                className="w-32 font-mono text-sm"
                                placeholder="#4F46E5"
                            />
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            {PRESET_COLORS.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setPrimaryColor(color)}
                                    className="h-8 w-8 rounded-lg border-2 transition-all hover:scale-110"
                                    style={{
                                        backgroundColor: color,
                                        borderColor: primaryColor === color ? "white" : "transparent",
                                        boxShadow: primaryColor === color ? `0 0 0 2px ${color}` : "none",
                                    }}
                                />
                            ))}
                        </div>

                        <div className="p-4 rounded-xl border border-border bg-muted/30">
                            <p className="text-xs text-muted-foreground mb-3">Preview</p>
                            <div className="flex items-center gap-3 mb-3">
                                <div
                                    className="h-10 w-10 rounded-xl flex items-center justify-center"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    <GraduationCap className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <p className="font-display font-semibold text-foreground text-sm">
                                        {currentName || branding.platform_name}
                                    </p>
                                    <p className="text-xs" style={{ color: primaryColor }}>
                                        Plataforma de estudos
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div
                                    className="h-8 px-3 rounded-lg text-white text-xs font-medium flex items-center"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    Botão primário
                                </div>
                                <div
                                    className="h-8 px-3 rounded-lg text-xs font-medium flex items-center border-2"
                                    style={{ borderColor: primaryColor, color: primaryColor }}
                                >
                                    Outline
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Button type="submit" loading={saving} className="w-full">
                    Salvar configurações
                </Button>
            </form>
        </div>
    );
}

function hexToHslString(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return "243 75% 59%";
    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
