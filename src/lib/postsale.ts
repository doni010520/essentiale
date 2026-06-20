import "server-only";
import type { createServiceClient } from "@/lib/supabase/server";
import { getProvider } from "@/lib/whatsapp";
import { logEvent } from "@/lib/log";
import type { Channel } from "@/lib/types";

type DB = ReturnType<typeof createServiceClient>;

/**
 * Pós-venda automático da Essentiale (Guia de Automação §12).
 *
 * Este módulo concentra:
 *  - As mensagens de mudança de status do pedido (enviadas pela action de pedidos).
 *  - As réguas de relacionamento (constantes/lógica) que o cron materializa como
 *    followups e depois envia.
 *  - O envio efetivo de followups respeitando a janela de 24h da Meta.
 *
 * ⚠️ RESTRIÇÃO DURA DA META (janela de 24h): só é permitido enviar TEXTO LIVRE
 * proativo se a última mensagem RECEBIDA do cliente (direction='in' /
 * sender_type='contact') foi há menos de 24h. Fora disso a Meta exige um
 * template HSM aprovado (que ainda não temos). Portanto, quando estiver fora da
 * janela, marcamos o followup como 'aguardando_template' e PULAMOS o envio —
 * nunca quebramos o fluxo.
 */

// ── Mensagens de mudança de status do pedido ────────────────────────────────
// [Nome] é substituído pelo primeiro nome / nome do contato no momento do envio.
export const ORDER_STATUS_MESSAGES: Record<string, string> = {
  embalado:
    "Olá [Nome], tudo bem? Seu pedido já está embalado, pronto para retirada/envio. 🌷",
  saiu:
    "Olá [Nome], bom dia! Passando para informar que seu pedido saiu para entrega. Agradecemos a preferência! Qualquer dúvida, é só me chamar. Ta bom?! 🌷",
  entregue:
    "Olá [Nome]! Passando para informar que seu pedido foi entregue hoje. Ficamos muito felizes em fazer parte dos seus momentos. Desejamos muito sucesso com os produtos! 🌷",
};

// ── Réguas de relacionamento (Guia §12.4) ───────────────────────────────────
// Cada régua é um "tipo" de followup. As que dependem de janela temporal são
// agendadas pelo cron a partir de um marco (criação do pedido, último contato).
export const FOLLOWUP_TIPOS = {
  /** D+0 — confirmação do pedido + agradecimento (logo após o pedido). */
  d0_confirmacao: "d0_confirmacao",
  /** D+3 a D+7 — acompanhamento da experiência com o aroma. */
  experiencia: "experiencia",
  /** Aniversário do cliente — mensagem afetiva + menção a cupom. */
  aniversario: "aniversario",
  /** Inatividade 60–90 dias — reativação. */
  reativacao: "reativacao",
} as const;

export type FollowupTipo = (typeof FOLLOWUP_TIPOS)[keyof typeof FOLLOWUP_TIPOS];

/** Substitui [Nome] pelo nome (primeiro nome) do contato. */
export function applyName(text: string, name?: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0] || "";
  return text.replace(/\[Nome\]/g, first);
}

/** Mensagens-modelo das réguas (com placeholder [Nome]). */
export const FOLLOWUP_MESSAGES: Record<FollowupTipo, string> = {
  [FOLLOWUP_TIPOS.d0_confirmacao]:
    "Olá [Nome]! Recebemos o seu pedido aqui na Essentiale Fragrance. 🌷 Muito obrigada pela confiança! Já estamos cuidando de tudo com carinho e te aviso a cada etapa. Qualquer dúvida, é só me chamar.",
  [FOLLOWUP_TIPOS.experiencia]:
    "Oi [Nome], tudo bem? 🌷 Passando para saber como está sendo a sua experiência com o aroma. Está agradando? Sua opinião é muito importante para a gente!",
  [FOLLOWUP_TIPOS.aniversario]:
    "Feliz aniversário, [Nome]! 🌷🎉 A Essentiale Fragrance deseja um dia repleto de aromas e momentos especiais. Preparamos um cupom de presente para você — me chama aqui que eu te conto os detalhes!",
  [FOLLOWUP_TIPOS.reativacao]:
    "Oi [Nome]! Sentimos sua falta por aqui. 🌷 Que tal renovar os aromas da sua casa? Temos novidades que combinam com você. Me chama que te ajudo a escolher!",
};

// Janelas das réguas (em dias). Centralizadas para fácil ajuste.
export const FOLLOWUP_OFFSET_DAYS = {
  experiencia: 4, // D+4 (entre D+3 e D+7)
  reativacaoMin: 60,
  reativacaoMax: 90,
} as const;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Encontra o canal meta_cloud conectado da org (preferindo conectado). */
export async function getMetaChannel(db: DB, organizationId: string): Promise<Channel | null> {
  const { data } = await db
    .from("channels")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("type", "meta_cloud")
    .order("status", { ascending: false }); // 'connected' tende a vir antes, mas validamos abaixo
  const list = (data ?? []) as Channel[];
  return list.find((c) => c.status === "connected") ?? list[0] ?? null;
}

/**
 * Verifica se a conversa está dentro da janela de atendimento de 24h da Meta:
 * última mensagem RECEBIDA do cliente há menos de 24h.
 */
export async function isWithin24hWindow(db: DB, conversationId: string): Promise<boolean> {
  const { data } = await db
    .from("messages")
    .select("created_at")
    .eq("conversation_id", conversationId)
    .eq("direction", "in")
    .eq("sender_type", "contact")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.created_at) return false;
  const last = new Date(data.created_at as string).getTime();
  return Date.now() - last < ONE_DAY_MS;
}

/**
 * Envia um texto livre proativo ao contato de uma conversa, registrando em
 * `messages`. Respeita a janela de 24h: se estiver fora, NÃO envia e retorna
 * "aguardando_template". Retorna o status resultante para gravar no followup.
 *
 * @returns "enviado" | "aguardando_template" | "falhou"
 */
export async function sendProactiveText(params: {
  db: DB;
  channel: Channel;
  organizationId: string;
  conversationId: string;
  to: string;
  text: string;
  senderType?: "system" | "bot";
}): Promise<"enviado" | "aguardando_template" | "falhou"> {
  const { db, channel, organizationId, conversationId, to, text } = params;
  const senderType = params.senderType ?? "system";

  // RESTRIÇÃO META: fora da janela de 24h só template HSM (indisponível) → pula.
  const inWindow = await isWithin24hWindow(db, conversationId);
  if (!inWindow) {
    void logEvent(
      "info",
      "postsale",
      "Followup fora da janela de 24h — requer template HSM (indisponível). Marcado como aguardando_template.",
      { conversationId, channel: channel.type },
      organizationId,
    );
    return "aguardando_template";
  }

  let failed = false;
  const res = await getProvider(channel)
    .sendText({ to, text })
    .catch((e) => {
      failed = true;
      void logEvent(
        "error",
        "postsale",
        `Falha ao enviar followup: ${(e as Error)?.message ?? e}`,
        { conversationId, channel: channel.type },
        organizationId,
      );
      return { externalId: undefined as string | undefined };
    });

  await db.from("messages").insert({
    organization_id: organizationId,
    conversation_id: conversationId,
    direction: "out",
    sender_type: senderType,
    content_type: "text",
    body: text,
    external_id: res.externalId ?? null,
    status: failed ? "failed" : "sent",
  });

  return failed ? "falhou" : "enviado";
}

/**
 * Envia a mensagem de mudança de status de um pedido (embalado/saiu/entregue).
 * Usado pela action updateOrderStatusAction. Resolve canal, conversa e telefone,
 * respeita a janela de 24h e registra a mensagem. Nunca lança.
 */
export async function sendOrderStatusMessage(
  db: DB,
  orderId: string,
  status: string,
): Promise<void> {
  try {
    const template = ORDER_STATUS_MESSAGES[status];
    if (!template) return; // status sem mensagem associada → nada a fazer

    const { data: order } = await db
      .from("orders")
      .select("id, organization_id, conversation_id, contact_id, nome_completo, telefone")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return;

    const organizationId = order.organization_id as string;

    // Contato (nome + telefone).
    let contactName: string | null = (order.nome_completo as string | null) ?? null;
    let phone: string | null = (order.telefone as string | null) ?? null;
    if (order.contact_id) {
      const { data: contact } = await db
        .from("contacts")
        .select("name, phone")
        .eq("id", order.contact_id)
        .maybeSingle();
      if (contact) {
        contactName = (contact.name as string | null) ?? contactName;
        phone = (contact.phone as string | null) ?? phone;
      }
    }

    // Conversa: a do pedido, ou a conversa mais recente do contato.
    let conversationId: string | null = (order.conversation_id as string | null) ?? null;
    if (!conversationId && order.contact_id) {
      const { data: conv } = await db
        .from("conversations")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("contact_id", order.contact_id)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      conversationId = (conv?.id as string | null) ?? null;
    }

    if (!conversationId || !phone) {
      void logEvent(
        "warn",
        "postsale",
        "Mensagem de status não enviada: sem conversa ou telefone do contato.",
        { orderId, status },
        organizationId,
      );
      return;
    }

    const channel = await getMetaChannel(db, organizationId);
    if (!channel) {
      void logEvent(
        "warn",
        "postsale",
        "Mensagem de status não enviada: nenhum canal meta_cloud disponível.",
        { orderId, status },
        organizationId,
      );
      return;
    }

    const text = applyName(template, contactName);
    await sendProactiveText({
      db,
      channel,
      organizationId,
      conversationId,
      to: phone,
      text,
      senderType: "system",
    });
  } catch (e) {
    void logEvent(
      "error",
      "postsale",
      `Erro ao enviar mensagem de status do pedido: ${(e as Error)?.message ?? e}`,
      { orderId, status },
    );
  }
}

// ── Agendamento de réguas (chamado pelo cron) ───────────────────────────────

/**
 * Materializa os followups DEVIDOS de réguas de relacionamento como linhas
 * 'pendente' na tabela `followups`, sem duplicar (checa por tipo + alvo).
 * Não envia nada — o cron processa os pendentes em seguida.
 *
 * Cria:
 *  - experiencia: para pedidos com >= 4 dias e ainda sem followup 'experiencia'.
 *  - aniversario: para contatos cujo data_aniversario cai hoje (mês/dia),
 *    sem followup 'aniversario' criado hoje.
 *  - reativacao: para contatos sem mensagem recebida entre 60 e 90 dias,
 *    sem followup 'reativacao' pendente/recente.
 *
 * @returns número de followups criados
 */
export async function scheduleRelationshipFollowups(
  db: DB,
  organizationId: string,
  now: Date = new Date(),
): Promise<number> {
  let created = 0;

  // Conversa mais recente do contato (para anexar o followup). Cache simples.
  const convCache = new Map<string, string | null>();
  const latestConversation = async (contactId: string): Promise<string | null> => {
    if (convCache.has(contactId)) return convCache.get(contactId)!;
    const { data } = await db
      .from("conversations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const id = (data?.id as string | null) ?? null;
    convCache.set(contactId, id);
    return id;
  };

  // ── Régua D+3..D+7 (experiência com o aroma) ──────────────────────────────
  // Pedidos com >= FOLLOWUP_OFFSET_DAYS dias, sem followup 'experiencia' criado.
  {
    const since = new Date(now.getTime() - FOLLOWUP_OFFSET_DAYS.experiencia * ONE_DAY_MS).toISOString();
    const { data: orders } = await db
      .from("orders")
      .select("id, contact_id, conversation_id, nome_completo")
      .eq("organization_id", organizationId)
      .not("contact_id", "is", null)
      .lte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    for (const o of (orders ?? []) as Array<{
      id: string;
      contact_id: string;
      conversation_id: string | null;
      nome_completo: string | null;
    }>) {
      // Já existe followup 'experiencia' para este pedido? → pula.
      const { count } = await db
        .from("followups")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("order_id", o.id)
        .eq("tipo", FOLLOWUP_TIPOS.experiencia);
      if ((count ?? 0) > 0) continue;

      const { data: contact } = await db
        .from("contacts")
        .select("name")
        .eq("id", o.contact_id)
        .maybeSingle();
      const conversationId = o.conversation_id ?? (await latestConversation(o.contact_id));

      const body = applyName(FOLLOWUP_MESSAGES[FOLLOWUP_TIPOS.experiencia], (contact?.name as string | null) ?? o.nome_completo);
      const { error } = await db.from("followups").insert({
        organization_id: organizationId,
        contact_id: o.contact_id,
        conversation_id: conversationId,
        order_id: o.id,
        tipo: FOLLOWUP_TIPOS.experiencia,
        status: "pendente",
        scheduled_at: now.toISOString(),
        message_body: body,
      });
      if (!error) created++;
    }
  }

  // ── Régua de aniversário (data_aniversario = hoje, mês/dia) ───────────────
  {
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    // O supabase-js não expõe to_char facilmente, então buscamos os contatos com
    // aniversário e comparamos mês/dia aqui (ignorando o ano).
    const { data: birthdays } = await db
      .from("contacts")
      .select("id, name, data_aniversario")
      .eq("organization_id", organizationId)
      .not("data_aniversario", "is", null)
      .limit(2000);

    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    for (const c of (birthdays ?? []) as Array<{ id: string; name: string | null; data_aniversario: string }>) {
      const d = String(c.data_aniversario); // 'YYYY-MM-DD'
      if (d.slice(5, 7) !== mm || d.slice(8, 10) !== dd) continue;

      // Já criamos um followup 'aniversario' para este contato hoje? → pula.
      const { count } = await db
        .from("followups")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("contact_id", c.id)
        .eq("tipo", FOLLOWUP_TIPOS.aniversario)
        .gte("created_at", startOfDay);
      if ((count ?? 0) > 0) continue;

      const conversationId = await latestConversation(c.id);
      const body = applyName(FOLLOWUP_MESSAGES[FOLLOWUP_TIPOS.aniversario], c.name);
      const { error } = await db.from("followups").insert({
        organization_id: organizationId,
        contact_id: c.id,
        conversation_id: conversationId,
        order_id: null,
        tipo: FOLLOWUP_TIPOS.aniversario,
        status: "pendente",
        scheduled_at: now.toISOString(),
        message_body: body,
      });
      if (!error) created++;
    }
  }

  // ── Régua de inatividade 60–90 dias (reativação) ──────────────────────────
  // Conversas cuja última atividade está entre 60 e 90 dias atrás.
  {
    const max = new Date(now.getTime() - FOLLOWUP_OFFSET_DAYS.reativacaoMin * ONE_DAY_MS).toISOString(); // <= 60 dias atrás
    const min = new Date(now.getTime() - FOLLOWUP_OFFSET_DAYS.reativacaoMax * ONE_DAY_MS).toISOString(); // >= 90 dias atrás
    const { data: convs } = await db
      .from("conversations")
      .select("id, contact_id")
      .eq("organization_id", organizationId)
      .not("contact_id", "is", null)
      .gte("last_message_at", min)
      .lte("last_message_at", max)
      .limit(200);

    // Para não disparar reativação repetida, ignoramos contatos com followup
    // 'reativacao' criado nos últimos 90 dias.
    const reativSince = new Date(now.getTime() - FOLLOWUP_OFFSET_DAYS.reativacaoMax * ONE_DAY_MS).toISOString();

    for (const cv of (convs ?? []) as Array<{ id: string; contact_id: string }>) {
      const { count } = await db
        .from("followups")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("contact_id", cv.contact_id)
        .eq("tipo", FOLLOWUP_TIPOS.reativacao)
        .gte("created_at", reativSince);
      if ((count ?? 0) > 0) continue;

      const { data: contact } = await db
        .from("contacts")
        .select("name")
        .eq("id", cv.contact_id)
        .maybeSingle();
      const body = applyName(FOLLOWUP_MESSAGES[FOLLOWUP_TIPOS.reativacao], (contact?.name as string | null) ?? null);
      const { error } = await db.from("followups").insert({
        organization_id: organizationId,
        contact_id: cv.contact_id,
        conversation_id: cv.id,
        order_id: null,
        tipo: FOLLOWUP_TIPOS.reativacao,
        status: "pendente",
        scheduled_at: now.toISOString(),
        message_body: body,
      });
      if (!error) created++;
    }
  }

  return created;
}

/**
 * Processa followups DEVIDOS de uma org: status='pendente' e scheduled_at <= now.
 * Para cada um: resolve canal/conversa/telefone, respeita a janela de 24h e envia.
 *  - Enviado com sucesso → status='enviado', sent_at=now().
 *  - Fora da janela de 24h → status='aguardando_template' (não envia).
 *  - Sem conversa/telefone/canal → status='aguardando_template' (não envia) + log.
 *
 * @returns { sent, awaiting } contadores
 */
export async function processDueFollowups(
  db: DB,
  organizationId: string,
  now: Date = new Date(),
): Promise<{ sent: number; awaiting: number }> {
  let sent = 0;
  let awaiting = 0;

  const { data: due } = await db
    .from("followups")
    .select("id, contact_id, conversation_id, order_id, tipo, message_body")
    .eq("organization_id", organizationId)
    .eq("status", "pendente")
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(100);

  if (!due?.length) return { sent, awaiting };

  const channel = await getMetaChannel(db, organizationId);

  for (const f of due as Array<{
    id: string;
    contact_id: string | null;
    conversation_id: string | null;
    order_id: string | null;
    tipo: string;
    message_body: string | null;
  }>) {
    // Resolve telefone + nome do contato.
    let phone: string | null = null;
    let contactName: string | null = null;
    if (f.contact_id) {
      const { data: contact } = await db
        .from("contacts")
        .select("name, phone")
        .eq("id", f.contact_id)
        .maybeSingle();
      phone = (contact?.phone as string | null) ?? null;
      contactName = (contact?.name as string | null) ?? null;
    }

    // Resolve conversa (a do followup, ou a mais recente do contato).
    let conversationId = f.conversation_id;
    if (!conversationId && f.contact_id) {
      const { data: conv } = await db
        .from("conversations")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("contact_id", f.contact_id)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      conversationId = (conv?.id as string | null) ?? null;
    }

    // Sem canal/conversa/telefone/corpo → não dá para enviar texto livre agora.
    if (!channel || !conversationId || !phone || !f.message_body) {
      await db
        .from("followups")
        .update({ status: "aguardando_template" })
        .eq("id", f.id);
      awaiting++;
      void logEvent(
        "warn",
        "postsale",
        "Followup não enviável (sem canal/conversa/telefone/corpo) — aguardando_template.",
        { followupId: f.id, tipo: f.tipo },
        organizationId,
      );
      continue;
    }

    const text = applyName(f.message_body, contactName);
    const result = await sendProactiveText({
      db,
      channel,
      organizationId,
      conversationId,
      to: phone,
      text,
      senderType: "system",
    });

    if (result === "enviado") {
      await db
        .from("followups")
        .update({ status: "enviado", sent_at: now.toISOString() })
        .eq("id", f.id);
      sent++;
    } else if (result === "aguardando_template") {
      // Fora da janela de 24h: marca para reenvio futuro via template HSM.
      await db
        .from("followups")
        .update({ status: "aguardando_template" })
        .eq("id", f.id);
      awaiting++;
    } else {
      // Falha de envio dentro da janela: deixa 'pendente' para nova tentativa
      // no próximo ciclo do cron (idempotente).
    }
  }

  return { sent, awaiting };
}
