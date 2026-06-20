"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

/** Cria ou atualiza um agente de IA. */
export async function saveAiAgent(fd: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Configure o Supabase.");
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const sb = await createClient();

  const id = String(fd.get("id") || "").trim();
  const channelId = String(fd.get("channel_id") || "").trim() || null;
  const temperature = Math.min(2, Math.max(0, Number(fd.get("temperature") || 0.4)));
  const values = {
    name: String(fd.get("name") || "").trim() || "Agente de IA",
    prompt: String(fd.get("prompt") || "").trim() || null,
    model: String(fd.get("model") || "gpt-4o-mini"),
    channel_id: channelId,
    active: fd.get("active") === "on",
    config: {
      temperature,
      knowledge: String(fd.get("knowledge") || "").trim() || undefined,
      greeting: String(fd.get("greeting") || "").trim() || undefined,
      tone: String(fd.get("tone") || "").trim() || undefined,
      base_prompt: String(fd.get("base_prompt") || "").trim() || undefined,
      voice: String(fd.get("voice") || "").trim() || undefined,
      use_emojis: fd.get("use_emojis") === "on",
      execute_actions: fd.get("execute_actions") === "on",
      single_message: fd.get("single_message") === "on",
      audio_replies: fd.get("audio_replies") === "on",
      restrict_to_allowlist: fd.get("restrict_to_allowlist") === "on",
    },
  };

  if (id) {
    const { error } = await sb.from("ai_agents").update(values).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb
      .from("ai_agents")
      .insert({ organization_id: session.organization.id, ...values });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/ajustes/ia");
}

/** Deleta um agente de IA. */
export async function deleteAiAgent(id: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Configure o Supabase.");
  const sb = await createClient();
  const { error } = await sb.from("ai_agents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/ajustes/ia");
}

/* ----------------- Allowlist: números liberados para a IA ----------------- */

/** Adiciona (ou reativa) um número à allowlist da IA. */
export async function addAllowedNumber(fd: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Configure o Supabase.");
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const phone = String(fd.get("phone") || "").replace(/\D+/g, "");
  if (phone.length < 8) throw new Error("Informe um número válido (com DDD).");
  const label = String(fd.get("label") || "").trim() || null;
  const sb = await createClient();
  const { error } = await sb
    .from("ai_allowed_numbers")
    .upsert(
      { organization_id: session.organization.id, phone, label, active: true },
      { onConflict: "organization_id,phone" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/ajustes/ia");
}

/** Ativa/desativa um número da allowlist. */
export async function toggleAllowedNumber(id: string, active: boolean) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Configure o Supabase.");
  const sb = await createClient();
  const { error } = await sb.from("ai_allowed_numbers").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/ajustes/ia");
}

/** Remove um número da allowlist. */
export async function removeAllowedNumber(id: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Configure o Supabase.");
  const sb = await createClient();
  const { error } = await sb.from("ai_allowed_numbers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/ajustes/ia");
}
