"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { orgInsert, orgUpdate, orgDelete } from "@/lib/crud-helpers";
import { getProvider } from "@/lib/whatsapp";
import type { Channel } from "@/lib/types";

function parseCampaign(fd: FormData) {
  return {
    name: String(fd.get("name") || "").trim(),
    channel_id: String(fd.get("channel_id") || "").trim() || null,
    automation_id: String(fd.get("automation_id") || "").trim() || null,
    message: String(fd.get("message") || "").trim() || null,
    scheduled_at: String(fd.get("scheduled_at") || "").trim() || null,
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

interface FlowNode { id: string; data?: { kind?: string; content?: string } }
interface FlowEdge { source: string; target: string }
interface Flow { nodes: FlowNode[]; edges: FlowEdge[] }

/**
 * Resolve o 1º nó de mensagem do fluxo de uma automação: texto a disparar e o
 * id do nó (para semear o bot a partir do nó seguinte, sem reenviar a 1ª msg).
 */
function firstFlowMessage(flow: Flow | null): { text: string | null; nodeId: string | null } {
  if (!flow?.nodes?.length) return { text: null, nodeId: null };
  const start = flow.nodes.find((n) => n.data?.kind === "start") ?? flow.nodes.find((n) => n.id === "start");
  const firstId = start ? flow.edges.find((e) => e.source === start.id)?.target ?? null : null;
  const first = firstId ? flow.nodes.find((n) => n.id === firstId) : null;
  if (first && (first.data?.kind ?? "message") === "message") {
    return { text: first.data?.content ?? null, nodeId: first.id };
  }
  return { text: null, nodeId: null };
}

/**
 * Disparo real de campanha: para cada contato da audiência, envia o texto
 * (mensagem da campanha ou 1ª mensagem do fluxo) e — se houver automação —
 * semeia a conversa em "bot" a partir do nó seguinte, dando continuidade ao fluxo.
 * Atualiza o progresso na tabela conforme dispara.
 */
export async function launchCampaign(campaignId: string) {
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const org = session.organization.id;
  const sb = await createClient();

  const { data: campaign } = await sb.from("campaigns").select("*").eq("id", campaignId).single();
  if (!campaign || !campaign.channel_id) throw new Error("Campanha sem canal.");

  const { data: channel } = await sb.from("channels").select("*").eq("id", campaign.channel_id).single();
  if (!channel) throw new Error("Canal não encontrado.");

  // Fluxo da automação vinculada (opcional).
  let flowMsg: { text: string | null; nodeId: string | null } = { text: null, nodeId: null };
  if (campaign.automation_id) {
    const { data: automation } = await sb.from("automations").select("flow").eq("id", campaign.automation_id).single();
    flowMsg = firstFlowMessage((automation?.flow as Flow) ?? null);
  }

  // Texto a disparar: prioriza a mensagem da campanha; senão a 1ª msg do fluxo; senão o nome.
  const text = campaign.message?.trim() || flowMsg.text || campaign.name;
  if (!text) throw new Error("Campanha sem mensagem para disparar.");

  // Audiência: todos os contatos não-grupo da org.
  const { data: contacts } = await sb
    .from("contacts")
    .select("id, phone")
    .eq("organization_id", org)
    .neq("is_group", true)
    .limit(10000);

  const audience = (contacts ?? []).filter((c) => c.phone);
  await sb.from("campaigns").update({
    status: "running",
    started_at: new Date().toISOString(),
    total_contacts: audience.length,
    sent_count: 0,
    failed_count: 0,
  }).eq("id", campaignId);

  const provider = getProvider(channel as Channel);
  let sent = 0;
  let failed = 0;

  for (const contact of audience) {
    try {
      const res = await provider.sendText({ to: contact.phone, text });
      sent++;

      // Reaproveita conversa aberta ou cria uma nova.
      const { data: existing } = await sb
        .from("conversations")
        .select("id")
        .eq("channel_id", campaign.channel_id)
        .eq("contact_id", contact.id)
        .in("status", ["bot", "queued", "open"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let convId = existing?.id ?? null;
      if (!convId) {
        const { data: conv } = await sb
          .from("conversations")
          .insert({
            organization_id: org,
            channel_id: campaign.channel_id,
            contact_id: contact.id,
            status: campaign.automation_id ? "bot" : "queued",
            bot_automation_id: campaign.automation_id,
            bot_node_id: flowMsg.nodeId,
            last_message_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        convId = conv?.id ?? null;
      }

      if (convId) {
        await sb.from("messages").insert({
          organization_id: org,
          conversation_id: convId,
          direction: "out",
          sender_type: "bot",
          content_type: "text",
          body: text,
          external_id: res.externalId ?? null,
          status: "sent",
        });
        await sb.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);
      }
    } catch {
      failed++;
    }
    if ((sent + failed) % 10 === 0) {
      const progress = audience.length ? Math.round(((sent + failed) / audience.length) * 100) : 100;
      await sb.from("campaigns").update({ sent_count: sent, failed_count: failed, progress }).eq("id", campaignId);
    }
  }

  await sb.from("campaigns").update({
    status: "done",
    sent_count: sent,
    failed_count: failed,
    progress: 100,
    finished_at: new Date().toISOString(),
    stats: { sent, failed, total: audience.length },
  }).eq("id", campaignId);

  revalidatePath("/campanhas");
}
