// frontend/src/components/producer/PdfUploader.tsx
// Componente reutilizável para upload de PDF de material de aula.
// Usado na página de detalhes do curso, dentro do modal de edição de aula.
"use client";

import { useState, useRef } from "react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { FileText, Upload, X, Loader2, ExternalLink, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface PdfUploaderProps {
  lessonId: string;
  currentUrl?: string | null;
  onUploaded: (url: string | null) => void;
}

export function PdfUploader({ lessonId, currentUrl, onUploaded }: PdfUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(currentUrl ?? null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

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
      // 1. Pede URL pré-assinada
      const { data: presignData } = await apiClient.post("/uploads/pdf/presigned", {
        lesson_id: lessonId,
        filename: file.name,
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
      await apiClient.patch("/uploads/pdf/confirm", {
        lesson_id: lessonId,
        material_url: presignData.public_url,
        filename: file.name,
      });

      setCurrentPdfUrl(presignData.public_url);
      onUploaded(presignData.public_url);
      toast.success("PDF enviado!", `${file.name} foi anexado à aula.`);
    } catch (err: any) {
      toast.error("Erro no upload", "Tente novamente.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await apiClient.delete(`/uploads/pdf/${lessonId}`);
      setCurrentPdfUrl(null);
      onUploaded(null);
      toast.success("Material removido.");
    } catch {
      toast.error("Erro ao remover material.");
    } finally {
      setRemoving(false);
    }
  };

  // Se já tem PDF, mostra o arquivo atual
  if (currentPdfUrl) {
    const filename = decodeURIComponent(currentPdfUrl.split("/").pop() ?? "Material.pdf");
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
        <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{filename}</p>
          <p className="text-xs text-muted-foreground">PDF anexado</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a href={currentPdfUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon-sm" title="Abrir PDF">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Remover PDF"
            className="hover:text-destructive"
            onClick={handleRemove}
            disabled={removing}
          >
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    );
  }

  return (
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
        "flex flex-col items-center gap-2 p-5 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
        dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/20"
      )}
    >
      {uploading
        ? <Loader2 className="h-7 w-7 text-primary animate-spin" />
        : <FileText className="h-7 w-7 text-muted-foreground" />
      }
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          {uploading ? "Enviando..." : "Arraste ou clique para enviar PDF"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Apenas PDF · Máx 50 MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
}