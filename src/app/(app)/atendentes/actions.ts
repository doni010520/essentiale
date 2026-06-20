"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { AgentCreateSchema, AgentUpdateSchema, fdToObj, parse } from "@/lib/validation";

function ensureReal() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Configure o Supabase para gerenciar atendentes.");
}

export async function createAgent(fd: FormData) {
  ensureReal();
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");

  const input = parse(AgentCreateSchema, fdToObj(fd));
  const { name, email, password, role } = input;
  const department_id = input.department_id ?? null;

  const admin = createServiceClient();
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (authErr) throw new Error(authErr.message);

  const { error } = await admin.from("profiles").upsert({
    id: created.user!.id,
    organization_id: session.organization.id,
    name,
    email,
    role,
    department_id,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/atendentes");
}

export async function updateAgent(id: string, fd: FormData) {
  ensureReal();
  const input = parse(AgentUpdateSchema, fdToObj(fd));
  const sb = await createClient();
  const { error } = await sb
    .from("profiles")
    .update({
      name: input.name,
      role: input.role,
      department_id: input.department_id ?? null,
      status: input.status,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/atendentes");
}

export async function deleteAgent(id: string) {
  ensureReal();
  const session = await getSession();
  if (session?.userId === id) throw new Error("Você não pode excluir o próprio usuário.");
  const admin = createServiceClient();
  // Remover o usuário do Auth remove o profile em cascata.
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
  revalidatePath("/atendentes");
}
