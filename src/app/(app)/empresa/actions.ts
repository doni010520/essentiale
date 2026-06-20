"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { OrgSchema, fdToObj, parse } from "@/lib/validation";

const COMPANY_FIELDS = [
  "inscription", "phone", "email",
  "zipcode", "street", "number", "complement", "district", "city", "state", "country",
] as const;

export async function updateOrg(fd: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Configure o Supabase.");
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const input = parse(OrgSchema, fdToObj(fd));
  const sb = await createClient();

  // Campos de contato/endereço ficam em settings.company (sem alterar o schema).
  const company: Record<string, string> = {};
  for (const k of COMPANY_FIELDS) {
    const v = String(fd.get(k) || "").trim();
    if (v) company[k] = v;
  }
  const prevSettings = (session.organization.settings ?? {}) as Record<string, unknown>;

  const { error } = await sb
    .from("organizations")
    .update({
      name: input.name,
      document: input.document || null,
      settings: { ...prevSettings, company },
    })
    .eq("id", session.organization.id);
  if (error) throw new Error(error.message);
  revalidatePath("/empresa");
}
