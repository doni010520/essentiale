import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

function ensureReal() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Modo preview: configure o Supabase (.env.local) para salvar dados reais.");
  }
}

/** Insert com organization_id da sessão. */
export async function orgInsert(table: string, values: Record<string, unknown>) {
  ensureReal();
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const sb = await createClient();
  const { error } = await sb.from(table).insert({ organization_id: session.organization.id, ...values });
  if (error) throw new Error(error.message);
}

/** Update (RLS garante o escopo da organização). */
export async function orgUpdate(table: string, id: string, values: Record<string, unknown>) {
  ensureReal();
  const sb = await createClient();
  const { error } = await sb.from(table).update(values).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Delete (RLS garante o escopo da organização). */
export async function orgDelete(table: string, id: string) {
  ensureReal();
  const sb = await createClient();
  const { error } = await sb.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
