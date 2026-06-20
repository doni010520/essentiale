"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { orgInsert, orgUpdate, orgDelete } from "@/lib/crud-helpers";
import {
  normalizeFilter,
  countAudience,
  resolveAudience,
  sendCampaign,
  type CampaignFilter,
} from "@/lib/campaigns";
import type { Channel } from "@/lib/types";

/** Extrai o filtro de segmentação dos campos do formulário. */
function parseFilter(fd: FormData): CampaignFilter {
  const interessesRaw = String(fd.get("interesses") || "").trim();
  return normalizeFilter({
    city: fd.get("city"),
    tipo_cliente: fd.get("tipo_cliente"),
    status_funil: fd.get("status_funil"),
    interesses: interessesRaw,
  });
}

function parseCampaign(fd: FormData) {
  return {
    name: String(fd.get("name") || "").trim(),
    channel_id: String(fd.get("channel_id") || "").trim() || null,
    automation_id: String(fd.get("automation_id") || "").trim() || null,
    message: String(fd.get("message") || "").trim() || null,
    scheduled_at: String(fd.get("scheduled_at") || "").trim() || null,
    contact_filter: parseFilter(fd),
  };
}

export async function createCampaign(fd: FormData) {
  const data = parseCampaign(fd);
  await orgInsert("campaigns", {
    ...data,
    status: data.scheduled_at ? "scheduled" : "draft",
  });
  revalidatePath("/campanhas");
}

export async function updateCampaign(id: string, fd: FormData) {
  await orgUpdate("campaigns", id, parseCampaign(fd));
  revalidatePath("/campanhas");
}

export async function updateCampaignStatus(id: string, status: string) {
  await orgUpdate("campaigns", id, { status });
  revalidatePath("/campanhas");
}

export async function deleteCampaign(id: string) {
  await orgDelete("campaigns", id);
  revalidatePath("/campanhas");
}

/**
 * Preview de público: conta quantos contatos a segmentação atinge, já
 * respeitando consentimento_marketing = true (opt-in). Usado pela tela ao
 * montar/ajustar a campanha. Respeita RLS (client de cookie).
 */
export async function previewAudienceAction(filter: unknown): Promise<number> {
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const sb = await createClient();
  return countAudience(sb, session.organization.id, normalizeFilter(filter));
}

/**
 * Disparo real da campanha (Guia §11):
 * - resolve a audiência por segmentação + consentimento;
 * - para cada contato, respeita a janela de 24h da Meta (texto livre só dentro
 *   da janela; fora dela marca 'aguardando_template' — HSM ainda não disponível);
 * - personaliza com o nome do contato e registra status por destinatário em
 *   `campaign_recipients`.
 *
 * Usa service role para varrer contatos e enviar (ignora RLS), mas todo acesso
 * é escopado por organization_id da sessão.
 */
export async function launchCampaign(campaignId: string) {
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const org = session.organization.id;
  const db = createServiceClient();

  const { data: campaign } = await db
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("organization_id", org)
    .single();
  if (!campaign) throw new Error("Campanha não encontrada.");
  if (!campaign.channel_id) throw new Error("Defina um canal na campanha antes de disparar.");

  const { data: channel } = await db
    .from("channels")
    .select("*")
    .eq("id", campaign.channel_id)
    .eq("organization_id", org)
    .single();
  if (!channel) throw new Error("Canal não encontrado.");

  const message = (campaign.message ?? "").trim();
  if (!message) throw new Error("Campanha sem mensagem para disparar.");

  const filter = normalizeFilter(campaign.contact_filter);
  const audience = await resolveAudience(db, org, filter);
  if (!audience.length) throw new Error("Nenhum contato com consentimento atende à segmentação.");

  await sendCampaign(db, {
    organizationId: org,
    campaignId,
    channel: channel as Channel,
    message,
    audience,
  });

  revalidatePath("/campanhas");
}
