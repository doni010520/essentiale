import type { createServiceClient } from "@/lib/supabase/server";
import { getProvider } from "./index";
import type { Channel } from "@/lib/types";

type DB = ReturnType<typeof createServiceClient>;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac",
  "video/mp4": "mp4", "video/3gpp": "3gp", "application/pdf": "pdf",
};

/**
 * Baixa a mídia recebida (descriptografada pela UAZAPI), re-hospeda no bucket
 * público "media" do Supabase e retorna a URL final + transcrição (áudio).
 * Best-effort: se falhar, devolve a URL crua da UAZAPI (que costuma ser pública).
 */
export async function storeInboundMedia(
  db: DB,
  channel: Channel,
  externalId: string | undefined,
): Promise<{ url?: string; transcription?: string }> {
  if (!externalId) return {};
  const provider = getProvider(channel);
  if (!provider.downloadMedia) return {};

  const { url, mimetype, transcription } = await provider.downloadMedia(externalId).catch(() => ({}) as never);
  if (!url) return { transcription };

  try {
    const resp = await fetch(url);
    if (resp.ok) {
      const buf = Buffer.from(await resp.arrayBuffer());
      const ct = resp.headers.get("content-type") || mimetype || "application/octet-stream";
      const ext = EXT[ct.split(";")[0]] || (url.split(".").pop() || "bin").slice(0, 5);
      const safeId = externalId.replace(/[^a-zA-Z0-9]/g, "").slice(-40);
      const path = `${channel.organization_id}/${safeId}.${ext}`;
      const { error } = await db.storage
        .from("media")
        .upload(path, buf, { contentType: ct, upsert: true });
      if (!error) {
        return { url: db.storage.from("media").getPublicUrl(path).data.publicUrl, transcription };
      }
    }
  } catch {
    /* mantém a URL crua da UAZAPI */
  }
  return { url, transcription };
}
