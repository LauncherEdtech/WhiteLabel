// frontend/src/components/producer/PdfUploader.tsx
"use client";

import { useState, useRef } from "react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { FileText, Upload, Loader2, ExternalLink, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Material {
  id: string;
  url: string;
  filename: string;
}

interface PdfUploaderProps {
  lessonId: string;
  currentUrl?: string | null;         // legado — ignorado se materials vier preenchido
  materials?: Material[];             // novo: array de materiais existentes
  onUploaded: (url: string | null) => void;
  onMaterialsChange?: (materials: Material[]) => void;
}

export function PdfUploader({
  lessonId,
  currentUrl,
  materials: initialMaterials,
  onUploaded,
  onMaterialsChange,
}: PdfUploaderProps) {
  // Normaliza legado: se só veio currentUrl, trata como materials[0]
  const normalize = (): Material[] => {
    if (initialMaterials && initialMaterials.length > 0) return initialMaterials;
    if (currentUrl) return [{ id: "legacy", url: currentUrl, filename: decodeURIComponent(currentUrl.split("/").pop() ?? "Material.pdf") }];
    return [];
  };

  const [materials, setMaterials] = useState<Material[]>(normalize);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const notify = (updated: Material[]) => {
    onMaterialsChange?.(updated);
    // Compatibilidade com onUploaded legado
    onUploaded(updated[0]?.url ?? null);
  };

  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Formato inválido", "Apenas arquivos PDF são aceitos.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Arquivo muito grande", "Máximo 50 MB.");
      return;
    }

    setUploading(true);
    try {
      const { data: presignData } = await apiClient.post("/uploads/pdf/presigned", {
        lesson_id: lessonId,
        filename: file.name,
      });

      const formData = new FormData();
      Object.entries(presignData.fields as Record<string, string>).forEach(([k, v]) => {
        formData.append(k, v);
      });
      formData.append("file", file);

      const uploadRes = await fetch(presignData.upload_url, {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("Upload S3 falhou");

      const { data: confirmed } = await apiClient.patch("/uploads/pdf/confirm", {
        lesson_id: lessonId,
        material_url: presignData.public_url,
        filename: file.name,
      });

      const updated = [...materials, confirmed.material as Material];
      setMaterials(updated);
      notify(updated);
      toast.success("PDF adicionado!", `"${file.name}" foi anexado à aula.`);
    } catch (err) {
      toast.error("Erro no upload", "Tente novamente.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async (material: Material) => {
    setRemovingId(material.id);
    try {
      if (material.id === "legacy") {
        await apiClient.delete(`/uploads/pdf/${lessonId}`);
      } else {
        await apiClient.delete(`/uploads/pdf/${lessonId}/${material.id}`);
      }
      const updated = materials.filter(m => m.id !== material.id);
      setMaterials(updated);
      notify(updated);
      toast.success("Material removido.");
    } catch {
      toast.error("Erro ao remover material.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-2">
      {/* Lista de materiais existentes */}
      {materials.map(mat => (
        <div key={mat.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
          <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{mat.filename}</p>
            <p className="text-xs text-muted-foreground">PDF anexado</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <a href={mat.url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon-sm" title="Abrir PDF">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Remover"
              className="hover:text-destructive"
              onClick={() => handleRemove(mat)}
              disabled={removingId === mat.id}
            >
              {removingId === mat.id
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Trash2 className="h-3.5 w-3.5" />
              }
            </Button>
          </div>
        </div>
      ))}

      {/* Área de upload */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          "flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/20",
          uploading && "cursor-wait opacity-70"
        )}
      >
        {uploading
          ? <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
          : <Plus className="h-5 w-5 text-muted-foreground shrink-0" />
        }
        <div>
          <p className="text-sm font-medium text-foreground">
            {uploading ? "Enviando..." : materials.length > 0 ? "Adicionar outro PDF" : "Enviar PDF"}
          </p>
          <p className="text-xs text-muted-foreground">Arraste ou clique · Apenas PDF · Máx 50 MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>
    </div>
  );
}