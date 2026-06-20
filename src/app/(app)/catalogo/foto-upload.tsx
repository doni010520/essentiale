"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, ImageIcon, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FotoUploadProps {
  value: string | null;
  slug: string;
  label?: string;
  galeria?: boolean;
  onUpload: (filename: string) => void;
  onRemove?: () => void;
}

type UploadState = "idle" | "dragging" | "uploading" | "success" | "error";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

function buildUrl(filename: string | null): string | null {
  if (!filename) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/media/${filename}`;
}

export function FotoUpload({ value, slug, label = "Foto", galeria = false, onUpload, onRemove }: FotoUploadProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = buildUrl(value);

  const upload = useCallback(
    async (file: File) => {
      setState("uploading");
      setProgress(0);
      setErrorMsg("");

      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", slug || "produto");
      if (galeria) fd.append("galeria", "true");

      // Simula progresso enquanto faz upload real
      const ticker = setInterval(() => setProgress((p) => Math.min(p + 8, 85)), 150);

      try {
        const res = await fetch("/api/catalogo/upload", { method: "POST", body: fd });
        clearInterval(ticker);
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error((json as { error?: string }).error ?? "Falha no upload");
        }
        const json = (await res.json()) as { filename: string };
        setProgress(100);
        setState("success");
        onUpload(json.filename);
        setTimeout(() => setState("idle"), 1800);
      } catch (e) {
        clearInterval(ticker);
        setState("error");
        setErrorMsg((e as Error).message);
      }
    },
    [slug, galeria, onUpload],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      const allowed = ["image/webp", "image/jpeg", "image/png", "image/gif", "image/avif"];
      if (!allowed.includes(file.type)) {
        setState("error");
        setErrorMsg("Formato inválido. Use WEBP, JPG ou PNG.");
        return;
      }
      upload(file);
    },
    [upload],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setState("idle");
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setState("dragging"); };
  const onDragLeave = () => setState((s) => s === "dragging" ? "idle" : s);

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-ink-soft">{label}</label>}

      {/* Preview + zone */}
      <div
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all",
          previewUrl ? "h-40 border-border bg-gray-50" : "h-36 border-border bg-gray-50/50",
          state === "dragging" && "border-brand bg-brand/5 scale-[1.01]",
          state === "error" && "border-red-400 bg-red-50",
          state === "uploading" && "pointer-events-none",
          "cursor-pointer select-none",
        )}
        onClick={() => { if (state !== "uploading") inputRef.current?.click(); }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        {previewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Preview" className="h-full w-full rounded-xl object-contain p-1" />
            {/* Overlay on hover */}
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 opacity-0 transition hover:bg-black/40 hover:opacity-100">
              <p className="text-xs font-medium text-white drop-shadow">Clique para substituir</p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-ink-soft">
            {state === "uploading" ? (
              <Loader2 size={24} className="animate-spin text-brand" />
            ) : state === "success" ? (
              <CheckCircle2 size={24} className="text-green-500" />
            ) : state === "error" ? (
              <AlertCircle size={24} className="text-red-500" />
            ) : (
              <Upload size={24} className={cn(state === "dragging" ? "text-brand" : "text-gray-400")} />
            )}
            <p className={cn("text-xs", state === "error" && "text-red-600")}>
              {state === "uploading" ? "Enviando..."
                : state === "success" ? "Enviado!"
                : state === "error" ? errorMsg
                : state === "dragging" ? "Solte aqui"
                : "Arraste ou clique para enviar"}
            </p>
            {state === "idle" && (
              <p className="text-[11px] text-gray-400">WEBP, JPG, PNG — máx 5 MB</p>
            )}
          </div>
        )}

        {/* Barra de progresso */}
        {state === "uploading" && (
          <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-xl bg-gray-200">
            <div
              className="h-full bg-brand transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Botão remover */}
        {previewUrl && onRemove && state !== "uploading" && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-600"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Erro inline */}
      {state === "error" && previewUrl && (
        <p className="text-xs text-red-600">{errorMsg}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

// ── Galeria múltipla ──────────────────────────────────────────────────────────

interface GaleriaUploadProps {
  value: string[];
  slug: string;
  onChange: (filenames: string[]) => void;
}

export function GaleriaUpload({ value, slug, onChange }: GaleriaUploadProps) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-ink-soft">Galeria de fotos</label>

      <div className="flex flex-wrap gap-3">
        {value.map((filename, idx) => {
          const url = buildUrl(filename);
          return (
            <div key={filename} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-border">
              {url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={`Galeria ${idx + 1}`} className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== idx))}
                className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition group-hover:flex hover:bg-red-600"
              >
                <X size={10} />
              </button>
            </div>
          );
        })}

        {/* Adicionar nova foto */}
        <FotoUpload
          value={null}
          slug={slug}
          galeria
          label=""
          onUpload={(filename) => onChange([...value, filename])}
        />
      </div>

      {value.length > 0 && (
        <p className="text-xs text-ink-soft">{value.length} foto{value.length !== 1 ? "s" : ""} na galeria</p>
      )}
    </div>
  );
}
