// frontend/src/components/producer/VideoUploader.tsx
// Upload de vídeo hospedado para aulas (feature: video_hosting).
// Usa XHR para rastreamento de progresso — fetch não suporta upload progress.
"use client";

import { useState, useRef, useCallback } from "react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Video, Upload, X, Loader2, Trash2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface VideoUploaderProps {
    lessonId: string;
    /** lesson.video_hosted — indica se já existe um vídeo hospedado */
    isHosted?: boolean;
    /** Chamado após upload+confirm ou após delete com sucesso */
    onSaved: () => void;
}

const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const MAX_SIZE_LABEL = "2 GB";

export function VideoUploader({ lessonId, isHosted, onSaved }: VideoUploaderProps) {
    const [hosted, setHosted] = useState(!!isHosted);
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [dragOver, setDragOver] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const xhrRef = useRef<XMLHttpRequest | null>(null);
    const toast = useToast();

    const handleFile = useCallback(
        async (file: File) => {
            if (!ALLOWED_TYPES.includes(file.type)) {
                toast.error("Formato inválido", "Use MP4, WebM ou MOV.");
                return;
            }
            if (file.size > MAX_SIZE_BYTES) {
                toast.error("Arquivo muito grande", `Máximo ${MAX_SIZE_LABEL}.`);
                return;
            }

            setUploading(true);
            setProgress(0);

            try {
                // 1. Solicita presigned POST ao backend
                const { data: presign } = await apiClient.post("/uploads/video/presigned", {
                    lesson_id: lessonId,
                    filename: file.name,
                    content_type: file.type,
                });

                // 2. Upload direto para S3 via XHR (suporta onprogress)
                await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhrRef.current = xhr;

                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            // Vai até 95% — os últimos 5% são o confirm no backend
                            setProgress(Math.round((e.loaded / e.total) * 95));
                        }
                    };

                    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 ${xhr.status}`)));
                    xhr.onerror = () => reject(new Error("Falha de rede"));
                    xhr.onabort = () => reject(new Error("cancelado"));

                    const formData = new FormData();
                    Object.entries(presign.fields as Record<string, string>).forEach(([k, v]) =>
                        formData.append(k, v)
                    );
                    formData.append("file", file); // "file" sempre por último (regra S3)

                    xhr.open("POST", presign.upload_url);
                    xhr.send(formData);
                });

                setProgress(98);

                // 3. Confirma no backend — vincula key à aula e limpa video_url externo
                await apiClient.patch("/uploads/video/confirm", {
                    lesson_id: lessonId,
                    key: presign.key,
                });

                setProgress(100);
                setHosted(true);
                onSaved();
                toast.success("Vídeo hospedado!", "Envio concluído com sucesso.");
            } catch (err: any) {
                if (err?.message === "cancelado") return; // usuário cancelou, sem toast
                toast.error("Erro no upload", "Tente novamente.");
                setProgress(0);
            } finally {
                setUploading(false);
                xhrRef.current = null;
            }
        },
        [lessonId, onSaved, toast]
    );

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await apiClient.delete(`/uploads/video/${lessonId}`);
            setHosted(false);
            onSaved();
            toast.success("Vídeo removido.");
        } catch {
            toast.error("Erro ao remover vídeo.");
        } finally {
            setDeleting(false);
        }
    };

    const cancelUpload = () => {
        xhrRef.current?.abort();
        setUploading(false);
        setProgress(0);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    // ── Vídeo já hospedado ────────────────────────────────────────────────────
    if (hosted) {
        return (
            <div className="flex items-center justify-between p-3 rounded-lg border border-success/30 bg-success/5">
                <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Vídeo hospedado</p>
                        <p className="text-xs text-muted-foreground">Substituir sobe um novo arquivo</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => inputRef.current?.click()}
                    >
                        <Upload className="h-3 w-3 mr-1" />
                        Substituir
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="hover:text-destructive"
                        onClick={handleDelete}
                        disabled={deleting}
                    >
                        {deleting
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />
                        }
                    </Button>
                </div>
                <input
                    ref={inputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                        e.target.value = "";
                    }}
                />
            </div>
        );
    }

    // ── Upload em andamento ───────────────────────────────────────────────────
    if (uploading) {
        return (
            <div className="p-4 rounded-lg border border-border space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm font-medium text-foreground">
                            Enviando… {progress}%
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelUpload}
                        className="text-muted-foreground hover:text-destructive h-7"
                    >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Cancelar
                    </Button>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                        className="bg-primary h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        );
    }

    // ── Drop zone ─────────────────────────────────────────────────────────────
    return (
        <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => inputRef.current?.click()}
            className={cn(
                "flex flex-col items-center gap-2 p-5 rounded-lg border-2 border-dashed",
                "cursor-pointer transition-colors select-none",
                dragOver
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/30"
            )}
        >
            <Video className="h-7 w-7 text-muted-foreground" />
            <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                    Clique ou arraste o vídeo
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                    MP4, WebM ou MOV · máximo {MAX_SIZE_LABEL}
                </p>
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = "";
                }}
            />
        </div>
    );
}