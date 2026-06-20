import type { createServiceClient } from "@/lib/supabase/server";
import { getProvider } from "./index";
import type { Channel } from "@/lib/types";

type DB = ReturnType<typeof createServiceClient>;

/**
 * Busca a foto de perfil do contato no provedor (UAZAPI), baixa e salva no
 * Supabase Storage (bucket público "avatars"), e grava a URL em contacts.avatar_url.
 * Best-effort: se algo falhar, mantém a URL crua ou ignora. Só roda para canais UAZAPI.
 */
export async function syncContactAvatar(db: DB, channel: Channel, contactId: string, phone: string) {
  if (channel.type !== "uazapi") return;
  const provider = getProvider(channel);
  if (!provider.getProfilePicture) return;

  const url = await provider.getProfilePicture(phone).catch(() => null);
  if (!url) return;

  let finalUrl = url;
  try {
    const resp = await fetch(url);
    if (resp.ok) {
      const buf = Buffer.from(await resp.arrayBuffer());
      const path = `${channel.organization_id}/${contactId}.jpg`;
      const { error } = await db.storage
        .from("avatars")
        .upload(path, buf, { contentType: resp.headers.get("content-type") || "image/jpeg", upsert: true });
      if (!error) {
        finalUrl = db.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
    }
  } catch {
    /* mantém a URL crua se o download/upload falhar */
  }

  await db.from("contacts").update({ avatar_url: finalUrl }).eq("id", contactId);
}

/**
 * Baixa uma imagem (ex.: foto do chat/grupo que vem em URL efêmera do WhatsApp)
 * e re-hospeda no bucket público "avatars". Retorna a URL durável (ou null).
 */
export async function rehostImageUrl(db: DB, orgId: string, contactId: string, url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    const path = `${orgId}/${contactId}.jpg`;
    const { error } = await db.storage
      .from("avatars")
      .upload(path, buf, { contentType: resp.headers.get("content-type") || "image/jpeg", upsert: true });
    if (error) return null;
    return db.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}
