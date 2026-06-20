"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { getProvider } from "@/lib/whatsapp";
import {
  exchangeCodeForToken,
  subscribeApp,
  setPhoneWebhook,
  getPhoneNumbers,
} from "@/lib/whatsapp/meta";
import type { Channel } from "@/lib/types";

export async function createChannel(formData: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Modo preview: configure o Supabase (.env.local) para cadastrar canais reais.");
  }

  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");

  const type = String(formData.get("type")) as Channel["type"];
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").replace(/\D/g, "") || null;
  if (!name) throw new Error("Informe o nome do canal.");

  const credentials: Record<string, unknown> = {};
  if (type === "meta_cloud") {
    credentials.phone_number_id = String(formData.get("phone_number_id") || "");
    credentials.access_token = String(formData.get("access_token") || "");
    const waba = String(formData.get("waba_id") || "").trim();
    if (waba) credentials.waba_id = waba;
  }

  const supabase = await createClient();
  const { data: channel, error } = await supabase
    .from("channels")
    .insert({
      organization_id: session.organization.id,
      name,
      type,
      phone,
      status: "pending",
      external_id: type === "meta_cloud" ? (credentials.phone_number_id as string) : null,
      credentials,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  // Inicia a conexão no provedor.
  let qrCode: string | undefined;
  let status: Channel["status"] = "pending";
  try {
    const result = await getProvider(channel as Channel).connect();
    qrCode = result.qrCode;
    status = result.status;
    await supabase
      .from("channels")
      .update({
        status: result.status,
        external_id: result.externalId ?? (channel as Channel).external_id,
        credentials:
          type === "uazapi" && result.externalId
            ? { ...credentials, token: result.externalId }
            : credentials,
      })
      .eq("id", channel.id);
  } catch (e) {
    console.error("connect error", e);
  }

  revalidatePath("/canais");
  return { id: channel.id as string, status, qrCode };
}

/**
 * Finaliza a conexão de um canal Meta via Coexistência (após o Embedded Signup):
 * troca o code por token, inscreve o app na WABA, configura o webhook do número
 * e cria o canal.
 */
export async function finalizeMetaCoexistence(input: {
  code: string;
  wabaId: string;
  phoneNumberId: string;
  name?: string;
}) {
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");

  const token = await exchangeCodeForToken(input.code);
  await subscribeApp(input.wabaId, token);
  await setPhoneWebhook(input.phoneNumberId, token).catch((e) =>
    console.warn("setPhoneWebhook", e?.message),
  );

  // Tenta descobrir o número de exibição.
  let phone: string | null = null;
  let displayName = input.name;
  try {
    const nums = await getPhoneNumbers(input.wabaId, token);
    const match = nums.find((n) => n.id === input.phoneNumberId) ?? nums[0];
    phone = match?.display_phone_number?.replace(/\D/g, "") ?? null;
    displayName = displayName || match?.verified_name;
  } catch (e) {
    console.warn("getPhoneNumbers", (e as Error)?.message);
  }

  const supabase = await createClient();
  const { data: channel, error } = await supabase
    .from("channels")
    .insert({
      organization_id: session.organization.id,
      name: displayName || "WhatsApp (Coexistência)",
      type: "meta_cloud",
      phone,
      status: "connected",
      external_id: input.phoneNumberId,
      credentials: {
        waba_id: input.wabaId,
        phone_number_id: input.phoneNumberId,
        access_token: token,
      },
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/canais");
  return { id: channel.id as string };
}

/**
 * Reconecta o canal e devolve QR atualizado OU código de pareamento.
 * Se `phone` vier, pede o código de 8 dígitos (parear por número).
 */
export async function refreshChannelConnection(channelId: string, phone?: string) {
  const supabase = await createClient();
  const { data: channel } = await supabase.from("channels").select("*").eq("id", channelId).single();
  if (!channel) throw new Error("Canal não encontrado.");

  const result = await getProvider(channel as Channel).connect(phone);
  await supabase
    .from("channels")
    .update({
      status: result.status,
      external_id: result.externalId ?? (channel as Channel).external_id,
      credentials:
        (channel as Channel).type === "uazapi" && result.externalId
          ? { ...(channel.credentials as object), token: result.externalId }
          : channel.credentials,
    })
    .eq("id", channelId);

  return { status: result.status, qrCode: result.qrCode, pairCode: result.pairCode, debug: result.debug };
}

/** Consulta o status atual (polling) e persiste. */
export async function syncChannelStatus(channelId: string) {
  const supabase = await createClient();
  const { data: channel } = await supabase.from("channels").select("*").eq("id", channelId).single();
  if (!channel) return { status: "disconnected" as Channel["status"] };

  let status: Channel["status"];
  try {
    status = await getProvider(channel as Channel).status();
  } catch {
    status = (channel as Channel).status;
  }
  if (status !== (channel as Channel).status) {
    await supabase.from("channels").update({ status }).eq("id", channelId);
    revalidatePath("/canais");
  }
  return { status };
}

/** Desconecta o canal (mantém o cadastro). */
export async function disconnectChannel(channelId: string) {
  const supabase = await createClient();
  const { data: channel } = await supabase.from("channels").select("*").eq("id", channelId).single();
  if (!channel) throw new Error("Canal não encontrado.");
  try {
    await getProvider(channel as Channel).disconnect?.();
  } catch (e) {
    console.warn("disconnect", (e as Error)?.message);
  }
  await supabase.from("channels").update({ status: "disconnected" }).eq("id", channelId);
  revalidatePath("/canais");
  revalidatePath("/dashboard");
}

/** Exclui o canal (apaga a instância no provedor e o registro). */
export async function deleteChannel(channelId: string) {
  const supabase = await createClient();
  const { data: channel } = await supabase.from("channels").select("*").eq("id", channelId).single();
  if (!channel) return;
  try {
    await getProvider(channel as Channel).deleteInstance?.();
  } catch (e) {
    console.warn("deleteInstance", (e as Error)?.message);
  }
  const { error } = await supabase.from("channels").delete().eq("id", channelId);
  if (error) throw new Error(error.message);
  revalidatePath("/canais");
  revalidatePath("/dashboard");
}


export async function renameChannel(channelId: string, name: string) {
  const sb = await createClient();
  const { error } = await sb.from("channels").update({ name: name.trim() }).eq("id", channelId);
  if (error) throw new Error(error.message);
  revalidatePath("/canais");
  revalidatePath("/dashboard");
}
