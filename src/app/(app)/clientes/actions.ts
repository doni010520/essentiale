"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const EDITABLE = [
  "name", "email", "city", "address", "cpf", "data_aniversario",
  "tipo_cliente", "status_funil", "origem_lead", "consentimento_marketing",
  "interesses", "notes",
] as const;

/** Atualiza os campos editáveis do contato/CRM. */
export async function updateContact(
  id: string,
  patch: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of EDITABLE) {
    if (!(k in patch)) continue;
    const v = patch[k];
    // interesses é jsonb (array): aceita string separada por vírgula e converte.
    if (k === "interesses") {
      clean[k] = typeof v === "string"
        ? v.split(",").map((s) => s.trim()).filter(Boolean)
        : Array.isArray(v) ? v : [];
      continue;
    }
    clean[k] = typeof v === "string" && v.trim() === "" ? null : v;
  }
  const { error } = await sb.from("contacts").update(clean).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return { ok: true };
}

/** Move o contato entre etapas do funil (Kanban). */
export async function moveFunnelStage(id: string, stage: string): Promise<void> {
  const sb = await createClient();
  await sb
    .from("contacts")
    .update({ status_funil: stage, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/clientes");
}
