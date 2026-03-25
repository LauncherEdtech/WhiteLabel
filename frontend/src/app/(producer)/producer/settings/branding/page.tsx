// frontend/src/app/(producer)/producer/settings/branding/page.tsx
"use client";

import { apiClient } from "@/lib/api/client";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { useToast } from "@/components/ui/toaster";
import { applyBrandingCssVars } from "@/components/TenantBrandingLoader";
import {
  GraduationCap, Palette, Mail, Check,
  Loader2, Upload, X, ImageIcon,
} from "lucide-react";
import Cookies from "js-cookie";
import { cn } from "@/lib/utils/cn";

const PRESET_COLORS = [
  "#4F46E5", "#7C3AED", "#DC2626", "#EA580C",
  "#16A34A", "#0891B2", "#DB2777", "#374151",
  "#1D4ED8", "#B45309", "#065F46", "#6B21A8",
];

interface BrandingForm {
  platform_name: string;
  support_email: string;
}

// ── Logo uploader ─────────────────────────────────────────────────────────────

function LogoUploader({
  currentUrl,
  onUploaded,
}: {
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => { setPreview(currentUrl ?? null); }, [currentUrl]);

  const handleFile = async (file: File) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      toast.error("Formato inválido", "Use JPG, PNG, WebP ou SVG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande", "Máximo 2 MB.");
      return;
    }

    // Preview local imediato
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      // 1. Pede a URL pré-assinada
      const { data: presignData } = await apiClient.post("/uploads/logo/presigned", {
        content_type: file.type,
      });

      // 2. Upload direto para o S3
      const formData = new FormData();
      Object.entries(presignData.fields as Record<string, string>).forEach(([k, v]) => {
        formData.append(k, v);
      });
      formData.append("file", file);

      const uploadRes = await fetch(presignData.upload_url, {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Upload para S3 falhou");

      // 3. Confirma no backend
      await apiClient.patch("/uploads/logo/confirm", {
        logo_url: presignData.public_url,
      });

      setPreview(presignData.public_url);
      onUploaded(presignData.public_url);
      toast.success("Logo enviada!", "Sua logo foi atualizada.");
    } catch (err: any) {
      toast.error("Erro no upload", "Tente novamente.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Preview */}
      {preview && (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Logo"
            className="h-20 w-auto max-w-[200px] object-contain rounded-lg border border-border bg-muted p-2"
          />
          <button
            type="button"
            onClick={() => { setPreview(null); onUploaded(""); }}
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        ) : (
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        )}
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {uploading ? "Enviando..." : "Arraste ou clique para enviar"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            JPG, PNG, WebP ou SVG · Máx 2 MB
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BrandingSettingsPage() {
  const { getBranding, tenant, setTenant } = useTenantStore();
  const toast = useToast();
  const [loadingTenant, setLoadingTenant] = useState(!tenant);
  const [saving, setSaving] = useState(false);

  // Carrega tenant se não estiver no store
  useEffect(() => {
    if (tenant) { setLoadingTenant(false); return; }
    const slug = Cookies.get("tenant_slug") || "concurso-demo";
    fetch(`/api/v1/tenants/by-slug/${slug}`, { headers: { "X-Tenant-Slug": slug } })
      .then(r => r.json())
      .then(data => {
        if (data?.tenant?.id) {
          setTenant(data.tenant);
          if (data.tenant.branding) applyBrandingCssVars(data.tenant.branding);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingTenant(false));
  }, [tenant, setTenant]);

  const branding = getBranding();
  const [primaryColor, setPrimaryColor] = useState(branding.primary_color);
  const [secondaryColor, setSecondaryColor] = useState(branding.secondary_color);
  const [logoUrl, setLogoUrl] = useState<string>(branding.logo_url ?? "");

  // Sincroniza quando tenant carrega
  useEffect(() => {
    if (tenant?.branding) {
      const b = tenant.branding as any;
      setPrimaryColor(b.primary_color || "#4F46E5");
      setSecondaryColor(b.secondary_color || "#10B981");
      setLogoUrl(b.logo_url || "");
    }
  }, [tenant]);

  const { register, handleSubmit, watch, reset } = useForm<BrandingForm>({
    defaultValues: {
      platform_name: branding.platform_name,
      support_email: branding.support_email || "",
    },
  });

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
        logo_url: logoUrl || null,
      });

      const savedBranding = response.data?.branding || {
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        platform_name: data.platform_name,
        support_email: data.support_email,
        logo_url: logoUrl || null,
      };

      setTenant({ ...tenant, branding: savedBranding as any });
      applyBrandingCssVars(savedBranding);
      toast.success("Configurações salvas!", "Alterações aplicadas em tempo real.");
    } catch (err: any) {
      console.error("Branding save error:", err?.response?.data || err?.message);
      toast.error("Erro ao salvar", err?.response?.data?.message || "Verifique sua conexão.");
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

      {/* Preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <GraduationCap className="h-4 w-4" /> Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
              style={{ backgroundColor: logoUrl ? "transparent" : primaryColor }}
            >
              {logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
                : <GraduationCap className="h-5 w-5 text-white" />
              }
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {currentName || "Plataforma de Estudos"}
              </p>
              <p className="text-xs text-muted-foreground">Painel do Produtor</p>
            </div>
            <div className="ml-auto flex gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: primaryColor }} />
              <div className="h-4 w-4 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: secondaryColor }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit(handleSave)} className="space-y-4">

        {/* Logo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ImageIcon className="h-4 w-4" /> Logo da Plataforma
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LogoUploader
              currentUrl={logoUrl}
              onUploaded={(url) => {
                setLogoUrl(url);
                // Atualiza o store → sidebar e topbar refletem instantaneamente
                if (tenant) {
                  setTenant({
                    ...tenant,
                    branding: {
                      ...(tenant.branding as any),
                      logo_url: url || null,
                    } as any,
                  });
                }
                // Se removeu a logo, confirma no backend
                if (!url && tenant?.id) {
                  apiClient.put(`/tenants/${tenant.id}/branding`, {
                    ...((tenant.branding as any) || {}),
                    logo_url: null,
                  }).catch(console.error);
                }
              }}
            />
          </CardContent>
        </Card>

        {/* Nome da plataforma */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <GraduationCap className="h-4 w-4" /> Nome da Plataforma
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input {...register("platform_name")} placeholder="Ex: Curso Aprovação PCDF" />
          </CardContent>
        </Card>

        {/* Cor primária */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Palette className="h-4 w-4" /> Cor Primária
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
              <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent" />
              <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                placeholder="#4F46E5" className="w-32 font-mono text-sm" />
              <span className="text-xs text-muted-foreground">Cor personalizada</span>
            </div>
          </CardContent>
        </Card>

        {/* Cor secundária */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Palette className="h-4 w-4" /> Cor Secundária
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
              <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent" />
              <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                placeholder="#10B981" className="w-32 font-mono text-sm" />
              <span className="text-xs text-muted-foreground">Cor personalizada</span>
            </div>
          </CardContent>
        </Card>

        {/* E-mail de suporte */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="h-4 w-4" /> E-mail de Suporte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input {...register("support_email")} type="email" placeholder="suporte@suaplataforma.com" />
            <p className="text-xs text-muted-foreground mt-1">Exibido para alunos na tela de ajuda</p>
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