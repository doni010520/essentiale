"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

export async function createApiKey(fd: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Configure o Supabase.");
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");

  const name = String(fd.get("name") || "").trim() || "Chave";
  const channelId = String(fd.get("channel_id") || "").trim() || null;
  const key = "mvf_" + crypto.randomBytes(24).toString("hex");
  const key_hash = crypto.createHash("sha256").update(key).digest("hex");

  const sb = await createClient();
  const { error } = await sb.from("api_keys").insert({
    organization_id: session.organization.id,
    name,
    key_hash,
    channel_id: channelId,
    scopes: ["messages:send"],
  });
  if (error) throw new Error(error.message);
  revalidatePath("/api");
  return { key }; // mostrado uma única vez
}

export async function deleteApiKey(id: string) {
  const sb = await createClient();
  const { error } = await sb.from("api_keys").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/api");
}
