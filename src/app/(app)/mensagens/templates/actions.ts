"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { listMetaTemplates } from "@/lib/whatsapp/meta";
import { orgInsert, orgUpdate, orgDelete } from "@/lib/crud-helpers";

/**
 * Sincroniza os modelos aprovados direto da Meta para a tabela wa_templates.
 * Usa o WABA id e o token do 1º canal Meta conectado (ou env META_WABA_ID/TOKEN).
 */
export async function syncMetaTemplates(): Promise<{ ok: boolean; count?: number; error?: string }> {
  const session = await getSession();
  if (!session?.organization) return { ok: false, error: "Sessão inválida." };
  const sb = await createClient();

  const { data: ch } = await sb
    .from("channels")
    .select("credentials")
    .eq("type", "meta_cloud")
    .limit(1)
    .maybeSingle();
  const creds = (ch?.credentials ?? {}) as { waba_id?: string; access_token?: string };
  const wabaId = creds.waba_id || process.env.META_WABA_ID;
  const token = creds.access_token || process.env.META_ACCESS_TOKEN;
  if (!wabaId) return { ok: false, error: "Defina o WABA id no canal Meta (credentials.waba_id) ou META_WABA_ID." };
  if (!token) return { ok: false, error: "Token da Meta ausente." };

  let list: Awaited<ReturnType<typeof listMetaTemplates>>;
  try {
    list = await listMetaTemplates(wabaId, token);
  } catch (e) {
    return { ok: false, error: `Falha ao consultar a Meta: ${(e as Error)?.message?.slice(0, 140)}` };
  }

  // Ignora os modelos de AMOSTRA/biblioteca da Meta (não servem para envio real).
  const SAMPLE = /^(hello_world$|jaspers_market_|sample_)/i;
  list = list.filter((t) => !SAMPLE.test(t.name));

  // Upsert por (name, language): atualiza existentes, insere novos.
  const { data: existing } = await sb.from("wa_templates").select("id, name, language");
  const byKey = new Map((existing ?? []).map((t) => [`${t.name}|${t.language}`, t.id]));
  let count = 0;
  for (const t of list) {
    const row = {
      organization_id: session.organization.id,
      name: t.name,
      language: t.language,
      category: t.category ?? "UTILITY",
      status: t.status,
      components: t.components ?? [],
    };
    const id = byKey.get(`${t.name}|${t.language}`);
    if (id) await sb.from("wa_templates").update(row).eq("id", id);
    else await sb.from("wa_templates").insert(row);
    count++;
  }
  revalidatePath("/mensagens/templates");
  return { ok: true, count };
}

export async function createTemplate(fd: FormData) {
  await orgInsert("wa_templates", {
    name: String(fd.get("name") || "").trim(),
    language: String(fd.get("language") || "pt_BR"),
    category: String(fd.get("category") || "UTILITY"),
    status: "pending",
    components: JSON.parse(String(fd.get("components") || "[]")),
  });
  revalidatePath("/mensagens/templates");
}

export async function updateTemplate(id: string, fd: FormData) {
  await orgUpdate("wa_templates", id, {
    name: String(fd.get("name") || "").trim(),
    language: String(fd.get("language") || "pt_BR"),
    category: String(fd.get("category") || "UTILITY"),
    components: JSON.parse(String(fd.get("components") || "[]")),
  });
  revalidatePath("/mensagens/templates");
}

export async function deleteTemplate(id: string) {
  await orgDelete("wa_templates", id);
  revalidatePath("/mensagens/templates");
}
