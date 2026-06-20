"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { getProvider } from "@/lib/whatsapp";
import { getMessages, getConversations } from "@/lib/data/conversations";
import type { Channel, ContentType, InternalMention } from "@/lib/types";

const isPreview = () => !process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function fetchMessages(conversationId: string) {
  return getMessages(conversationId);
}

/** Lista atualizada de conversas (usada pelo polling da inbox). */
export async function fetchConversations() {
  return getConversations();
}

/** Retorna status dos canais (para mostrar banner de desconectado). */
export async function fetchChannelStatuses(): Promise<{ id: string; name: string; status: string }[]> {
  if (isPreview()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("channels").select("id, name, status");
  return (data as { id: string; name: string; status: string }[]) ?? [];
}

/**
 * Abre (ou cria) uma conversa 1:1 com um participante — ex.: clicar no nome num grupo.
 * Se só houver o LID (mensagem comum de grupo), resolve o telefone via /group/info.
 */
export async function openDirectConversation(
  channelId: string,
  opts: { phone?: string; lid?: string; name?: string; groupJid?: string },
) {
  if (isPreview()) return { id: null as string | null };
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const supabase = await createClient();

  let digits = (opts.phone || "").replace(/\D/g, "");
  // Resolve LID → telefone real consultando os participantes do grupo.
  if (!digits && opts.lid && opts.groupJid) {
    const { data: channel } = await supabase.from("channels").select("*").eq("id", channelId).single();
    const parts = await getProvider(channel as Channel)
      .getGroupParticipants?.(opts.groupJid)
      .catch(() => [] as { lid: string; phone: string }[]);
    const lidDigits = opts.lid.replace(/\D/g, "");
    digits = (parts ?? []).find((p) => p.lid === lidDigits)?.phone ?? "";
  }
  if (!digits) return { id: null };
  const name = opts.name;

  const { data: contact } = await supabase
    .from("contacts")
    .upsert(
      { organization_id: session.organization.id, phone: digits, name: name ?? null, is_group: false },
      { onConflict: "organization_id,phone", ignoreDuplicates: false },
    )
    .select("id")
    .single();
  if (!contact) return { id: null };

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("channel_id", channelId)
    .eq("contact_id", contact.id)
    .in("status", ["bot", "queued", "open"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let id = existing?.id ?? null;
  if (!id) {
    const { data: conv } = await supabase
      .from("conversations")
      .insert({
        organization_id: session.organization.id,
        channel_id: channelId,
        contact_id: contact.id,
        status: "open",
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    id = conv?.id ?? null;
  }
  revalidatePath("/atendimento");
  return { id };
}

/**
 * Resolve o telefone/nome de um participante SEM criar contato/conversa.
 * Usado ao clicar num participante de grupo — só materializa ao digitar/enviar.
 */
export async function resolveDirectContact(
  channelId: string,
  opts: { phone?: string; lid?: string; name?: string; groupJid?: string },
): Promise<{ phone: string | null; name: string | null; existingId: string | null }> {
  if (isPreview()) return { phone: null, name: null, existingId: null };
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const supabase = await createClient();

  let digits = (opts.phone || "").replace(/\D/g, "");
  if (!digits && opts.lid && opts.groupJid) {
    const { data: channel } = await supabase.from("channels").select("*").eq("id", channelId).single();
    const parts = await getProvider(channel as Channel)
      .getGroupParticipants?.(opts.groupJid)
      .catch(() => [] as { lid: string; phone: string }[]);
    const lidDigits = opts.lid.replace(/\D/g, "");
    digits = (parts ?? []).find((p) => p.lid === lidDigits)?.phone ?? "";
  }
  if (!digits) return { phone: null, name: null, existingId: null };

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, name")
    .eq("organization_id", session.organization.id)
    .eq("phone", digits)
    .maybeSingle();

  let existingId: string | null = null;
  if (contact) {
    const { data: ex } = await supabase
      .from("conversations")
      .select("id")
      .eq("channel_id", channelId)
      .eq("contact_id", contact.id)
      .in("status", ["bot", "queued", "open"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    existingId = ex?.id ?? null;
  }
  return { phone: digits, name: opts.name ?? contact?.name ?? null, existingId };
}

export interface ContactDetails {
  id: string;
  name: string | null;
  phone: string;
  avatar_url: string | null;
  is_group: boolean;
  notes: string | null;
  custom_fields: Record<string, unknown>;
}

/** Detalhes do contato da conversa (para o painel lateral / CRM). */
export async function getContactDetails(conversationId: string): Promise<ContactDetails | null> {
  if (isPreview()) return null;
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversation_overview")
    .select("contact_id")
    .eq("id", conversationId)
    .single();
  if (!conv) return null;
  const { data: c } = await supabase
    .from("contacts")
    .select("id, name, phone, avatar_url, is_group, notes, custom_fields")
    .eq("id", conv.contact_id)
    .single();
  return (c as ContactDetails) ?? null;
}

/** Histórico de atendimentos do contato desta conversa. */
export async function getContactHistory(conversationId: string) {
  if (isPreview()) return [];
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversation_overview")
    .select("contact_id")
    .eq("id", conversationId)
    .single();
  if (!conv) return [];
  const { data } = await supabase
    .from("conversations")
    .select("id, protocol, status, opened_at, closed_at")
    .eq("contact_id", conv.contact_id)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as { id: string; protocol: string | null; status: string; opened_at: string | null; closed_at: string | null }[];
}

/** Salva nome, observações e campos personalizados (CRM) do contato. */
export async function updateContactDetails(
  conversationId: string,
  patch: { name?: string; notes?: string; custom_fields?: Record<string, unknown> },
) {
  if (isPreview()) return { ok: true };
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversation_overview")
    .select("contact_id")
    .eq("id", conversationId)
    .single();
  if (!conv) return { ok: false };
  const upd: Record<string, unknown> = {};
  if (patch.name !== undefined) upd.name = patch.name.trim() || null;
  if (patch.notes !== undefined) upd.notes = patch.notes;
  if (patch.custom_fields !== undefined) upd.custom_fields = patch.custom_fields;
  await supabase.from("contacts").update(upd).eq("id", conv.contact_id);
  revalidatePath("/atendimento");
  return { ok: true };
}

export interface GroupInfoResult {
  name?: string;
  description?: string;
  participants: { phone: string; name: string | null; isAdmin: boolean; isOwner: boolean }[];
}

/** Informações do grupo da conversa (nome, descrição, participantes com nomes resolvidos). */
export async function getGroupInfo(conversationId: string): Promise<GroupInfoResult | null> {
  if (isPreview()) return null;
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversation_overview")
    .select("channel_id, is_group, contact_jid, contact_phone")
    .eq("id", conversationId)
    .single();
  if (!conv?.is_group) return null;
  const { data: channel } = await supabase.from("channels").select("*").eq("id", conv.channel_id).single();
  const jid = (conv.contact_jid as string) || `${conv.contact_phone}@g.us`;
  const info = await getProvider(channel as Channel).getGroupInfo?.(jid);
  if (!info) return null;

  // Resolve nomes a partir dos nossos contatos.
  const phones = info.participants.map((p) => p.phone).filter(Boolean);
  const names = new Map<string, string>();
  if (phones.length) {
    const { data: contacts } = await supabase.from("contacts").select("phone, name").in("phone", phones);
    for (const c of contacts ?? []) if (c.name) names.set(c.phone, c.name);
  }
  return {
    name: info.name,
    description: info.description,
    participants: info.participants
      .filter((p) => p.phone)
      .map((p) => ({
        phone: p.phone,
        name: names.get(p.phone) ?? null,
        isAdmin: p.isAdmin,
        isOwner: p.phone === info.owner,
      }))
      .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || Number(b.isAdmin) - Number(a.isAdmin)),
  };
}

export async function sendMessage(
  conversationId: string,
  text: string,
  replyToExternal?: string,
  mentions?: { name: string; phone: string }[],
): Promise<{ ok: boolean; error?: string }> {
  let body = text.trim();
  if (!body) return { ok: false };
  if (isPreview()) return { ok: true }; // modo preview: client mantém otimista

  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const supabase = await createClient();

  // Identificar atendente: prefixa o nome se configurado.
  const orgSettings = (session.organization.settings ?? {}) as Record<string, unknown>;
  if (orgSettings.identify_agent && session.profile?.name) {
    body = `*${session.profile.name}:*\n${body}`;
  }

  const { data: conv } = await supabase
    .from("conversation_overview")
    .select("contact_phone, channel_id, status, is_group, contact_jid")
    .eq("id", conversationId)
    .single();
  if (!conv) throw new Error("Conversa não encontrada.");

  // Trecho da mensagem citada (para exibir o quote no nosso lado).
  let replyExcerpt: string | null = null;
  if (replyToExternal) {
    const { data: q } = await supabase
      .from("messages")
      .select("body, content_type")
      .eq("external_id", replyToExternal)
      .maybeSingle();
    replyExcerpt = q?.body ?? (q?.content_type && q.content_type !== "text" ? `[${q.content_type}]` : null);
  }

  const { data: msg } = await supabase
    .from("messages")
    .insert({
      organization_id: session.organization.id,
      conversation_id: conversationId,
      direction: "out",
      sender_type: "agent",
      sender_id: session.userId,
      content_type: "text",
      body,
      reply_to_external: replyToExternal ?? null,
      reply_excerpt: replyExcerpt,
      status: "pending",
    })
    .select("id")
    .single();

  // Envia pelo provedor do canal.
  let deliveryError: string | null = null;
  try {
    const { data: channel } = await supabase
      .from("channels")
      .select("*")
      .eq("id", conv.channel_id)
      .single();
    const to = recipientOf(conv);
    // Menções: no texto enviado, "@Nome" vira "@<número>" (o que o WhatsApp linka).
    let waText = body;
    const mentionNums: string[] = [];
    for (const m of mentions ?? []) {
      const digits = m.phone.replace(/\D/g, "");
      if (!digits) continue;
      mentionNums.push(digits);
      waText = waText.split(`@${m.name}`).join(`@${digits}`);
    }
    const res = await getProvider(channel as Channel).sendText({
      to,
      text: waText,
      replyId: replyToExternal,
      mentions: mentionNums.length ? mentionNums : undefined,
    });
    await supabase
      .from("messages")
      .update({ status: "sent", external_id: res.externalId ?? null })
      .eq("id", msg!.id);
  } catch (e) {
    console.error("send error", e);
    const raw = (e as Error)?.message ?? "";
    // Janela de 24h da Meta (erro 131047/131026) → mensagem amigável.
    deliveryError = /131047|131026|re-?engag|24 ?h|outside|template/i.test(raw)
      ? "Fora da janela de 24h: neste canal oficial, só é possível enviar um modelo (template) aprovado."
      : "Não foi possível entregar a mensagem.";
    await supabase.from("messages").update({ status: "failed" }).eq("id", msg!.id);
  }

  // Se o atendente respondeu numa conversa que estava na IA, a IA para
  // automaticamente (equivalente ao "atendente assumiu ao interagir").
  const wasBot = conv.status === "bot";
  await supabase
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      status: conv.status === "closed" ? "open" : wasBot ? "open" : conv.status,
      ...(wasBot ? { ai_enabled: false, assigned_user_id: session.userId } : {}),
    })
    .eq("id", conversationId);
  if (wasBot) {
    await supabase.from("messages").insert({
      organization_id: session.organization.id,
      conversation_id: conversationId,
      direction: "out",
      sender_type: "system",
      content_type: "text",
      body: `IA pausada — ${session.profile?.name ?? "atendente"} assumiu ao responder.`,
      is_internal: true,
      status: "sent",
    });
  }

  revalidatePath("/atendimento");
  return { ok: !deliveryError, error: deliveryError ?? undefined };
}

/** Adiciona uma nota interna na conversa (visível só para a equipe, não vai ao cliente). */
export async function addInternalNote(conversationId: string, text: string) {
  if (isPreview()) return { ok: true };
  const note = text.trim();
  if (!note) return { ok: false };
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const supabase = await createClient();
  await supabase.from("messages").insert({
    organization_id: session.organization.id,
    conversation_id: conversationId,
    direction: "out",
    sender_type: "system",
    sender_id: session.userId,
    content_type: "text",
    body: session.profile?.name ? `${session.profile.name}: ${note}` : note,
    is_internal: true,
    status: "sent",
  });
  revalidatePath("/atendimento");
  return { ok: true };
}

/** Lista os atendentes da organização (para o autocomplete de @menção interna). */
export async function getOrgAgents(): Promise<{ id: string; name: string; avatar_url: string | null }[]> {
  if (isPreview()) return [];
  const session = await getSession();
  if (!session?.organization) return [];
  const db = createServiceClient();
  const { data } = await db
    .from("profiles")
    .select("id, name, avatar_url")
    .eq("organization_id", session.organization.id)
    .order("name");
  return ((data ?? []) as { id: string; name: string | null; avatar_url: string | null }[]).map((p) => ({
    id: p.id,
    name: p.name ?? "Atendente",
    avatar_url: p.avatar_url ?? null,
  }));
}

/**
 * Envia uma mensagem INTERNA (entre atendentes) numa conversa. O cliente nunca
 * recebe. Suporta @menção de atendentes, que geram notificação (sino).
 */
export async function sendInternalMessage(
  conversationId: string,
  text: string,
  mentions?: { id: string; name: string }[],
) {
  if (isPreview()) return { ok: true };
  const body = text.trim();
  if (!body) return { ok: false };
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const db = createServiceClient();
  const authorName = session.profile?.name ?? "Atendente";
  // Só conta menções que realmente aparecem no texto final.
  const used = (mentions ?? []).filter((m) => body.includes(`@${m.name}`));

  const { data: msg } = await db
    .from("messages")
    .insert({
      organization_id: session.organization.id,
      conversation_id: conversationId,
      direction: "out",
      sender_type: "agent",
      sender_id: session.userId,
      content_type: "text",
      body,
      author_name: authorName,
      is_internal: true,
      mentions: used,
      status: "sent",
    })
    .select("id")
    .single();

  // Notifica os atendentes mencionados (menos o próprio autor).
  const targets = used.filter((m) => m.id && m.id !== session.userId);
  if (msg && targets.length) {
    const { data: conv } = await db
      .from("conversation_overview")
      .select("contact_name")
      .eq("id", conversationId)
      .maybeSingle();
    await db.from("internal_mentions").insert(
      targets.map((t) => ({
        organization_id: session.organization!.id,
        conversation_id: conversationId,
        message_id: msg.id,
        mentioned_user_id: t.id,
        created_by: session.userId,
        author_name: authorName,
        excerpt: body.slice(0, 140),
        contact_name: (conv?.contact_name as string) ?? null,
      })),
    );
  }

  await db.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
  revalidatePath("/atendimento");
  return { ok: true };
}

/** Menções internas não lidas do atendente logado (para o sino/badge). */
export async function getUnreadMentions(): Promise<InternalMention[]> {
  if (isPreview()) return [];
  const session = await getSession();
  if (!session?.userId) return [];
  const db = createServiceClient();
  const { data } = await db
    .from("internal_mentions")
    .select("*")
    .eq("mentioned_user_id", session.userId)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as InternalMention[]) ?? [];
}

/** Marca menções como lidas (de uma conversa, ou todas se omitido). */
export async function markMentionsRead(conversationId?: string) {
  if (isPreview()) return { ok: true };
  const session = await getSession();
  if (!session?.userId) return { ok: false };
  const db = createServiceClient();
  let q = db
    .from("internal_mentions")
    .update({ read_at: new Date().toISOString() })
    .eq("mentioned_user_id", session.userId)
    .is("read_at", null);
  if (conversationId) q = q.eq("conversation_id", conversationId);
  await q;
  return { ok: true };
}

/** Modelos (templates) aprovados disponíveis para envio (Meta, fora da janela). */
export async function getApprovedTemplates(): Promise<
  { name: string; language: string; bodyText: string; varCount: number }[]
> {
  if (isPreview()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("wa_templates")
    .select("name, language, category, components, status")
    .order("name");
  type Row = { name: string; language: string; status?: string; components?: unknown };
  return ((data as Row[]) ?? [])
    .filter((t) => !t.status || /approved|ativo/i.test(t.status))
    .map((t) => {
      const comps = Array.isArray(t.components) ? (t.components as Record<string, unknown>[]) : [];
      const body = comps.find((c) => String(c.type).toUpperCase() === "BODY");
      const bodyText = body ? String(body.text ?? "") : "";
      const varCount = (bodyText.match(/\{\{\s*\d+\s*\}\}/g) ?? []).length;
      return { name: t.name, language: t.language || "pt_BR", bodyText, varCount };
    });
}

/** Envia uma mensagem de MODELO (template) — permitido fora da janela de 24h (Meta). */
export async function sendTemplateMessage(
  conversationId: string,
  name: string,
  language: string,
  params: string[] = [],
): Promise<{ ok: boolean; error?: string }> {
  if (isPreview()) return { ok: true };
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const supabase = await createClient();

  const { data: conv } = await supabase
    .from("conversation_overview")
    .select("contact_phone, channel_id, is_group, contact_jid, status")
    .eq("id", conversationId)
    .single();
  if (!conv) throw new Error("Conversa não encontrada.");
  const { data: channel } = await supabase.from("channels").select("*").eq("id", conv.channel_id).single();
  const provider = getProvider(channel as Channel);
  if (!provider.sendTemplate) return { ok: false, error: "Este canal não suporta modelos." };

  const components = params.length
    ? [{ type: "body", parameters: params.map((p) => ({ type: "text", text: p })) }]
    : undefined;

  // Renderiza o CONTEÚDO real do template (corpo com {{n}} substituídos) para
  // mostrar na bolha — em vez de um código tipo "[modelo: x]".
  const { data: tpl } = await supabase
    .from("wa_templates")
    .select("components")
    .eq("name", name)
    .eq("language", language)
    .maybeSingle();
  let rendered = "";
  const comps = Array.isArray(tpl?.components) ? (tpl!.components as Record<string, unknown>[]) : [];
  const bodyComp = comps.find((c) => String(c.type).toUpperCase() === "BODY");
  if (bodyComp?.text) {
    rendered = String(bodyComp.text).replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => params[Number(n) - 1] ?? `{{${n}}}`);
  }
  const body = rendered || `Modelo enviado: ${name}`;

  const { data: msg } = await supabase
    .from("messages")
    .insert({
      organization_id: session.organization.id,
      conversation_id: conversationId,
      direction: "out",
      sender_type: "agent",
      sender_id: session.userId,
      content_type: "template",
      body,
      status: "pending",
    })
    .select("id")
    .single();

  try {
    const res = await provider.sendTemplate({ to: recipientOf(conv), name, language, components });
    await supabase.from("messages").update({ status: "sent", external_id: res.externalId ?? null }).eq("id", msg!.id);
  } catch (e) {
    const raw = (e as Error)?.message ?? "";
    console.error("sendTemplate", raw);
    await supabase.from("messages").update({ status: "failed" }).eq("id", msg!.id);
    // Extrai a mensagem de erro legível da Meta (JSON em error.message).
    let friendly = "Falha ao enviar o modelo.";
    const m = raw.match(/"message"\s*:\s*"([^"]+)"/);
    if (m) friendly = m[1];
    if (/131030|not in allowed list|allowed recipient/i.test(raw))
      friendly = "Conta de teste da Meta: este número não está na lista de destinatários permitidos. Adicione-o em WhatsApp → Configuração da API.";
    else if (/132000|132001|template name|does not exist|not found/i.test(raw))
      friendly = "Modelo não encontrado/aprovado para este número. Verifique o idioma e o status na Meta.";
    else if (/132012|param/i.test(raw))
      friendly = "Parâmetros do modelo incorretos (variáveis faltando ou a mais).";
    return { ok: false, error: friendly };
  }
  await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
  revalidatePath("/atendimento");
  return { ok: true };
}

export async function assignToMe(conversationId: string) {
  if (isPreview()) return;
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const supabase = await createClient();
  // Assumir = humano no comando → a IA para nesta conversa (não reengaja).
  await supabase
    .from("conversations")
    .update({ assigned_user_id: session.userId, status: "open", ai_enabled: false })
    .eq("id", conversationId);

  // Mensagem de atribuição (se configurado).
  const orgSettings = (session.organization.settings ?? {}) as Record<string, unknown>;
  if (orgSettings.auto_send_assign_msg && session.profile?.name) {
    const { data: autoMsg } = await supabase.from("auto_messages")
      .select("body").eq("organization_id", session.organization.id)
      .eq("event", "agent_assign").eq("active", true).limit(1).maybeSingle();
    if (autoMsg?.body) {
      const text = autoMsg.body.replace(/@atendente_nome/g, session.profile.name);
      await sendMessage(conversationId, text);
    }
  }

  revalidatePath("/atendimento");
}

export interface CloseOptions {
  reason?: string;
  tagIds?: string[];
  sendSurvey?: boolean;
}

const DEFAULT_SURVEY =
  "Sua opinião é muito importante! De 1 a 5, como você avalia o nosso atendimento? (responda apenas com o número)";

/** Envia a pesquisa de satisfação (CSAT) ao cliente e marca a conversa como aguardando nota. */
async function sendSatisfactionSurvey(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  conversationId: string,
) {
  const { data: org } = await supabase.from("organizations").select("settings").eq("id", orgId).maybeSingle();
  const csat = (org?.settings as { csat?: { message?: string } } | null)?.csat;
  const text = csat?.message?.trim() || DEFAULT_SURVEY;
  try {
    const { to, channel } = await recipientFor(supabase, conversationId);
    const res = await getProvider(channel).sendText({ to, text });
    await supabase.from("messages").insert({
      organization_id: orgId,
      conversation_id: conversationId,
      direction: "out",
      sender_type: "system",
      content_type: "text",
      body: text,
      status: "sent",
      external_id: res.externalId ?? null,
    });
    await supabase.from("conversations").update({ awaiting_satisfaction: true }).eq("id", conversationId);
  } catch (e) {
    console.error("survey", e);
  }
}

/** Encerra o atendimento: classificação (tags) + motivo + pesquisa opcional. */
export async function closeConversation(conversationId: string, opts: CloseOptions = {}) {
  if (isPreview()) return { ok: true };
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const supabase = await createClient();

  // Classificação do atendimento (substitui as tags atuais).
  if (opts.tagIds) {
    await supabase.from("conversation_tags").delete().eq("conversation_id", conversationId);
    if (opts.tagIds.length) {
      await supabase
        .from("conversation_tags")
        .insert(opts.tagIds.map((tag_id) => ({ conversation_id: conversationId, tag_id })));
    }
  }

  await supabase
    .from("conversations")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      close_reason: opts.reason?.trim() || null,
    })
    .eq("id", conversationId);

  // Registro interno do encerramento (histórico, não vai ao cliente).
  if (opts.reason?.trim()) {
    await supabase.from("messages").insert({
      organization_id: session.organization.id,
      conversation_id: conversationId,
      direction: "out",
      sender_type: "system",
      sender_id: session.userId,
      content_type: "text",
      body: `Atendimento encerrado — Motivo: ${opts.reason.trim()}`,
      is_internal: true,
      status: "sent",
    });
  }

  if (opts.sendSurvey) {
    await sendSatisfactionSurvey(supabase, session.organization.id, conversationId);
  }

  revalidatePath("/atendimento");
  return { ok: true };
}

function kindFromMime(mime: string): { kind: "image" | "audio" | "video" | "document"; content: ContentType } {
  if (mime.startsWith("image")) return { kind: "image", content: "image" };
  if (mime.startsWith("audio")) return { kind: "audio", content: "audio" };
  if (mime.startsWith("video")) return { kind: "video", content: "video" };
  return { kind: "document", content: "document" };
}

/** Envia um arquivo (imagem/áudio/vídeo/documento) numa conversa. */
export async function sendMediaMessage(formData: FormData) {
  if (isPreview()) return { ok: true };
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");

  const conversationId = String(formData.get("conversationId") || "");
  const caption = String(formData.get("caption") || "").trim();
  const file = formData.get("file") as File | null;
  if (!conversationId || !file || file.size === 0) return { ok: false };

  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversation_overview")
    .select("contact_phone, channel_id, status, is_group, contact_jid")
    .eq("id", conversationId)
    .single();
  if (!conv) throw new Error("Conversa não encontrada.");

  const override = String(formData.get("kind") || "");
  const { kind, content } =
    override === "sticker"
      ? ({ kind: "sticker", content: "sticker" } as const)
      : kindFromMime(file.type || "");

  // Upload pro bucket público "media" (service client ignora RLS no storage).
  const svc = createServiceClient();
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = (file.name?.split(".").pop() || (file.type.split("/")[1] ?? "bin")).slice(0, 5);
  const path = `${session.organization.id}/out/${conversationId}-${Date.now()}.${ext}`;
  const up = await svc.storage
    .from("media")
    .upload(path, buf, { contentType: file.type || "application/octet-stream", upsert: true });
  if (up.error) throw new Error("Falha ao subir o arquivo.");
  const publicUrl = svc.storage.from("media").getPublicUrl(path).data.publicUrl;

  // Registra a mensagem (pendente) e envia pelo provedor.
  const { data: msg } = await supabase
    .from("messages")
    .insert({
      organization_id: session.organization.id,
      conversation_id: conversationId,
      direction: "out",
      sender_type: "agent",
      sender_id: session.userId,
      content_type: content,
      body: caption || null,
      media_url: publicUrl,
      status: "pending",
    })
    .select("id")
    .single();

  try {
    const { data: channel } = await supabase.from("channels").select("*").eq("id", conv.channel_id).single();
    const to = recipientOf(conv);
    const res = await getProvider(channel as Channel).sendMedia({ to, url: publicUrl, caption, kind });
    await supabase.from("messages").update({ status: "sent", external_id: res.externalId ?? null }).eq("id", msg!.id);
  } catch (e) {
    console.error("sendMedia error", e);
    await supabase.from("messages").update({ status: "failed" }).eq("id", msg!.id);
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString(), status: conv.status === "closed" ? "open" : conv.status })
    .eq("id", conversationId);
  revalidatePath("/atendimento");
  return { ok: true };
}

/** Destinatário do provedor: para grupos usa o JID completo (preserva traço). */
function recipientOf(conv: { contact_phone: string; is_group?: boolean; contact_jid?: string | null }) {
  if (conv.is_group) return conv.contact_jid || `${conv.contact_phone}@g.us`;
  return conv.contact_phone;
}

async function recipientFor(supabase: Awaited<ReturnType<typeof createClient>>, conversationId: string) {
  const { data: conv } = await supabase
    .from("conversation_overview")
    .select("contact_phone, channel_id, is_group, contact_jid")
    .eq("id", conversationId)
    .single();
  if (!conv) throw new Error("Conversa não encontrada.");
  const { data: channel } = await supabase.from("channels").select("*").eq("id", conv.channel_id).single();
  return { to: recipientOf(conv), channel: channel as Channel };
}

/** Reage a uma mensagem com um emoji (vazio remove a reação). */
export async function reactToMessage(conversationId: string, messageId: string, emoji: string) {
  if (isPreview()) return { ok: true };
  const supabase = await createClient();
  const { data: m } = await supabase.from("messages").select("external_id, reactions").eq("id", messageId).single();
  if (!m?.external_id) return { ok: false };
  const { to, channel } = await recipientFor(supabase, conversationId);
  try {
    await getProvider(channel).reactMessage?.(to, m.external_id, emoji);
  } catch (e) {
    console.error("react error", e);
  }
  const current = Array.isArray(m.reactions) ? (m.reactions as { emoji: string; by: string }[]) : [];
  const without = current.filter((r) => r.by !== "Você");
  const next = emoji ? [...without, { emoji, by: "Você" }] : without;
  await supabase.from("messages").update({ reactions: next }).eq("id", messageId);
  revalidatePath("/atendimento");
  return { ok: true };
}

/** Edita o texto de uma mensagem enviada. */
export async function editMessageAction(conversationId: string, messageId: string, newText: string) {
  if (isPreview()) return { ok: true };
  const text = newText.trim();
  if (!text) return { ok: false };
  const supabase = await createClient();
  const { data: m } = await supabase.from("messages").select("external_id").eq("id", messageId).single();
  if (!m?.external_id) return { ok: false };
  const { channel } = await recipientFor(supabase, conversationId);
  try {
    await getProvider(channel).editMessage?.(m.external_id, text);
  } catch (e) {
    console.error("edit error", e);
  }
  await supabase.from("messages").update({ body: text, edited: true }).eq("id", messageId);
  revalidatePath("/atendimento");
  return { ok: true };
}

/** Apaga uma mensagem (para todos). */
export async function deleteMessageAction(conversationId: string, messageId: string) {
  if (isPreview()) return { ok: true };
  const supabase = await createClient();
  const { data: m } = await supabase.from("messages").select("external_id").eq("id", messageId).single();
  const { channel } = await recipientFor(supabase, conversationId);
  try {
    if (m?.external_id) await getProvider(channel).deleteMessage?.(m.external_id);
  } catch (e) {
    console.error("delete error", e);
  }
  await supabase.from("messages").update({ is_deleted: true, body: null, media_url: null }).eq("id", messageId);
  revalidatePath("/atendimento");
  return { ok: true };
}

/** Marca as mensagens recebidas da conversa como lidas (✓✓ azul no WhatsApp). */
export async function markConversationRead(conversationId: string) {
  if (isPreview()) return { ok: true };
  const supabase = await createClient();
  const { data: msgs } = await supabase
    .from("messages")
    .select("id, external_id")
    .eq("conversation_id", conversationId)
    .eq("direction", "in")
    .neq("status", "read")
    .limit(200);
  const ids = (msgs ?? []).map((m) => m.external_id).filter(Boolean) as string[];
  if (!ids.length) return { ok: true };
  try {
    const { channel } = await recipientFor(supabase, conversationId);
    await getProvider(channel).markRead?.(ids);
  } catch (e) {
    console.warn("markRead", (e as Error)?.message);
  }
  await supabase.from("messages").update({ status: "read" }).eq("conversation_id", conversationId).eq("direction", "in");
  return { ok: true };
}

/** Envia uma localização na conversa. */
export async function sendLocationMessage(
  conversationId: string,
  loc: { latitude: number; longitude: number; name?: string; address?: string },
) {
  if (isPreview()) return { ok: true };
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const supabase = await createClient();
  const { to, channel } = await recipientFor(supabase, conversationId);
  const label = loc.name || loc.address || `${loc.latitude}, ${loc.longitude}`;
  const { data: msg } = await supabase
    .from("messages")
    .insert({
      organization_id: session.organization.id,
      conversation_id: conversationId,
      direction: "out",
      sender_type: "agent",
      sender_id: session.userId,
      content_type: "location",
      body: `📍 ${label}\nhttps://maps.google.com/?q=${loc.latitude},${loc.longitude}`,
      status: "pending",
    })
    .select("id")
    .single();
  try {
    const res = await getProvider(channel).sendLocation?.(to, loc);
    await supabase.from("messages").update({ status: "sent", external_id: res?.externalId ?? null }).eq("id", msg!.id);
  } catch (e) {
    console.error("sendLocation", e);
    await supabase.from("messages").update({ status: "failed" }).eq("id", msg!.id);
  }
  await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
  revalidatePath("/atendimento");
  return { ok: true };
}

/** Envia um contato (vCard) na conversa. */
export async function sendContactMessage(conversationId: string, fullName: string, phoneNumber: string) {
  if (isPreview()) return { ok: true };
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const name = fullName.trim();
  const phone = phoneNumber.replace(/\D/g, "");
  if (!name || !phone) return { ok: false };
  const supabase = await createClient();
  const { to, channel } = await recipientFor(supabase, conversationId);
  const { data: msg } = await supabase
    .from("messages")
    .insert({
      organization_id: session.organization.id,
      conversation_id: conversationId,
      direction: "out",
      sender_type: "agent",
      sender_id: session.userId,
      content_type: "contact",
      body: `👤 ${name} — ${phone}`,
      status: "pending",
    })
    .select("id")
    .single();
  try {
    const res = await getProvider(channel).sendContact?.(to, { fullName: name, phoneNumber: phone });
    await supabase.from("messages").update({ status: "sent", external_id: res?.externalId ?? null }).eq("id", msg!.id);
  } catch (e) {
    console.error("sendContact", e);
    await supabase.from("messages").update({ status: "failed" }).eq("id", msg!.id);
  }
  await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
  revalidatePath("/atendimento");
  return { ok: true };
}

/**
 * Pausa (assume) ou reativa o atendimento por IA nesta conversa.
 * - Pausar (enabled=false): atendente assume; o chatbot não reengaja, mesmo
 *   em mensagem nova (block_return_to_bot por conversa).
 * - Reativar (enabled=true): devolve a conversa para a automação (status "bot").
 */
export async function setConversationAi(conversationId: string, enabled: boolean) {
  if (isPreview()) return { enabled };
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const supabase = await createClient();

  const patch: Record<string, unknown> = { ai_enabled: enabled };
  if (enabled) {
    patch.status = "bot";
  } else {
    patch.status = "open";
    patch.assigned_user_id = session.userId;
  }
  await supabase.from("conversations").update(patch).eq("id", conversationId);

  await supabase.from("messages").insert({
    organization_id: session.organization.id,
    conversation_id: conversationId,
    direction: "out",
    sender_type: "system",
    content_type: "text",
    body: enabled
      ? "Atendimento devolvido para a IA."
      : `IA pausada — atendimento assumido${session.profile?.name ? ` por ${session.profile.name}` : ""}.`,
    is_internal: true,
    status: "sent",
  });

  revalidatePath("/atendimento");
  return { enabled };
}

/** Silencia/dessilencia uma conversa (grupo ou contato). */
export async function toggleMute(conversationId: string, muted: boolean) {
  if (isPreview()) return { muted };
  const supabase = await createClient();
  await supabase.from("conversations").update({ is_muted: muted }).eq("id", conversationId);
  revalidatePath("/atendimento");
  return { muted };
}

export interface TransferOptions {
  toUserId?: string | null;
  toDepartmentId?: string | null;
  internalNote?: string;
  customerMessage?: string;
}

/**
 * Transferência avançada: para uma pessoa e/ou departamento, com nota interna
 * (só atendentes) e mensagem ao cliente (enviada de verdade).
 */
export async function transferConversation(conversationId: string, opts: TransferOptions) {
  if (isPreview()) return { ok: true };
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const supabase = await createClient();

  const update: Record<string, unknown> = {};
  if (opts.toDepartmentId !== undefined) update.department_id = opts.toDepartmentId || null;
  if (opts.toUserId) {
    update.assigned_user_id = opts.toUserId;
    update.status = "open";
  } else if (opts.toDepartmentId) {
    // Volta para a fila do departamento, sem atendente específico.
    update.assigned_user_id = null;
    update.status = "queued";
  }
  if (Object.keys(update).length) {
    await supabase.from("conversations").update(update).eq("id", conversationId);
  }

  // Nota interna de transferência (não vai ao cliente).
  if (opts.internalNote?.trim()) {
    await supabase.from("messages").insert({
      organization_id: session.organization.id,
      conversation_id: conversationId,
      direction: "out",
      sender_type: "system",
      sender_id: session.userId,
      content_type: "text",
      body: opts.internalNote.trim(),
      is_internal: true,
      status: "sent",
    });
  }

  // Mensagem ao cliente (enviada pelo provedor).
  if (opts.customerMessage?.trim()) {
    await sendMessage(conversationId, opts.customerMessage.trim());
  }

  revalidatePath("/atendimento");
  return { ok: true };
}

/** Fixa/desfixa uma conversa. */
export async function togglePin(conversationId: string, pinned: boolean) {
  if (isPreview()) return { pinned };
  const supabase = await createClient();
  await supabase.from("conversations").update({ pinned }).eq("id", conversationId);
  revalidatePath("/atendimento");
  return { pinned };
}

/** Arquiva/desarquiva uma conversa. */
export async function toggleArchive(conversationId: string, archived: boolean) {
  if (isPreview()) return { archived };
  const supabase = await createClient();
  await supabase.from("conversations").update({ archived }).eq("id", conversationId);
  revalidatePath("/atendimento");
  return { archived };
}

/** Busca conversas por protocolo (global). */
export async function searchByProtocol(protocol: string) {
  if (isPreview()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversation_overview")
    .select("id, protocol, contact_name, contact_phone, status")
    .ilike("protocol", `%${protocol.trim()}%`)
    .limit(20);
  return data ?? [];
}

/** Ação SGP manual no painel do contato (2ª via, PIX, liberação, status). */
export async function sgpAction(conversationId: string, action: string, contrato: number): Promise<string> {
  if (isPreview()) return "Modo preview.";
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const { sgpForOrg } = await import("@/lib/sgp");
  const supabase = await createClient();
  const sgp = await sgpForOrg(supabase as unknown as Parameters<typeof sgpForOrg>[0], session.organization.id);
  if (!sgp) return "SGP não configurado. Cadastre a integração em Ajustes > Integrações.";
  try {
    switch (action) {
      case "segunda_via": {
        const r = await sgp.segundaVia({ contrato });
        if (!r.ok) return r.mensagem ?? "Erro ao gerar 2ª via.";
        const lines = r.faturas.map((f) =>
          `Fatura ${f.fatura}: R$ ${f.valor?.toFixed(2)} (venc. ${f.vencimento})${f.linhaDigitavel ? `\nLinha: ${f.linhaDigitavel}` : ""}${f.link ? `\nLink: ${f.link}` : ""}`,
        );
        return lines.length ? lines.join("\n\n") : "Nenhuma fatura encontrada.";
      }
      case "pix": {
        // Pega a 1ª fatura em aberto
        const titulos = await sgp.titulosEmAberto({ contrato });
        if (!titulos.length) return "Nenhuma fatura em aberto.";
        const px = await sgp.gerarPix(titulos[0].fatura, contrato);
        return px.codigoPix ?? "PIX não disponível para esta fatura.";
      }
      case "liberacao": {
        const r = await sgp.liberacaoConfianca({ contrato });
        return r.ok ? `Liberado! Protocolo: ${r.protocolo ?? "—"}` : (r.mensagem ?? "Não foi possível liberar.");
      }
      case "status": {
        const r = await sgp.statusConexao({ contrato });
        return r.online ? "Conexão ONLINE" : `Conexão OFFLINE${r.mensagem ? ` — ${r.mensagem}` : ""}`;
      }
      default:
        return "Ação desconhecida.";
    }
  } catch (e) {
    return `Erro SGP: ${(e as Error)?.message ?? "desconhecido"}`;
  }
}

/** Remove um participante de um grupo WhatsApp. */
export async function removeGroupParticipant(conversationId: string, phone: string): Promise<{ ok: boolean; error?: string }> {
  if (isPreview()) return { ok: false, error: "Modo preview." };
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversation_overview")
    .select("channel_id, is_group, contact_jid, contact_phone")
    .eq("id", conversationId)
    .single();
  if (!conv?.is_group) return { ok: false, error: "Não é um grupo." };
  const { data: channel } = await supabase.from("channels").select("*").eq("id", conv.channel_id).single();
  if (!channel) return { ok: false, error: "Canal não encontrado." };
  const jid = (conv.contact_jid as string) || `${conv.contact_phone}@g.us`;
  const provider = getProvider(channel as Channel);
  if (!provider.removeGroupParticipant) return { ok: false, error: "Provedor não suporta remoção de participantes." };
  const ok = await provider.removeGroupParticipant(jid, phone);
  return ok ? { ok: true } : { ok: false, error: "Falha ao remover participante." };
}
