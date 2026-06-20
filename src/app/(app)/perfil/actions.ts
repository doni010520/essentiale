"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

export async function updateOwnProfile(fd: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Configure o Supabase.");
  const session = await getSession();
  if (!session) throw new Error("Sessão inválida.");
  const sb = await createClient();
  // Nome + sobrenome são dois campos na UI, mas guardados juntos em profiles.name.
  const first = String(fd.get("name") || "").trim();
  const last = String(fd.get("last_name") || "").trim();
  const fullName = [first, last].filter(Boolean).join(" ");
  const { error } = await sb
    .from("profiles")
    .update({
      name: fullName,
      whatsapp: String(fd.get("whatsapp") || "").replace(/\D/g, "") || null,
      status: String(fd.get("status") || "offline"),
      notify: fd.get("notify") === "on",
    })
    .eq("id", session.userId);
  if (error) throw new Error(error.message);
  revalidatePath("/perfil");
}

/** Troca a senha do próprio usuário (sessão atual). */
export async function changeOwnPassword(fd: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Configure o Supabase.");
  const session = await getSession();
  if (!session) throw new Error("Sessão inválida.");
  const password = String(fd.get("password") || "");
  const confirm = String(fd.get("password_confirm") || "");
  if (password.length < 6) throw new Error("A senha deve ter no mínimo 6 caracteres.");
  if (password !== confirm) throw new Error("As senhas não coincidem.");
  const sb = await createClient();
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Sincroniza o flag profiles.totp_enabled (chamado pelo componente de 2FA). */
export async function setTotpEnabled(enabled: boolean) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
  const session = await getSession();
  if (!session) return;
  const sb = await createClient();
  await sb.from("profiles").update({ totp_enabled: enabled }).eq("id", session.userId);
  revalidatePath("/perfil");
}
