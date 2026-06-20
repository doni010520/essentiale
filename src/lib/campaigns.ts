import { getProvider } from "@/lib/whatsapp";
import type { Channel } from "@/lib/types";

/**
 * Motor de segmentação e disparo de campanhas (Essentiale, Guia §11).
 *
 * Regras de negócio:
 * - SEGMENTAÇÃO por cidade, tipo_cliente, interesses (jsonb), status_funil.
 * - SOMENTE contatos com consentimento_marketing = true entram na audiência
 *   (Guia §11.3 — opt-in obrigatório). Isso é aplicado SEMPRE, em todo filtro.
 * - JANELA 24h (Meta/HSM): disparo proativo fora da janela exige template HSM
 *   aprovado, que ainda NÃO temos. Logo, no envio: se a última mensagem inbound
 *   do contato for < 24h, manda texto livre; senão marca 'aguardando_template'.
 */

/** Critérios de segmentação preenchidos na tela de campanha. */
export interface CampaignFilter {
  city?: string | null;
  tipo_cliente?: string | null; // 'consumidor' | 'lojista'
  status_funil?: string | null;
  interesses?: string[]; // contato precisa conter pelo menos um destes (jsonb @> não dá OR; filtramos em memória)
}

/** Contato resolvido para disparo. */
export interface AudienceContact {
  id: string;
  phone: string;
  name: string | null;
  interesses: unknown;
}

// Aceita tanto o client de cookie (createClient) quanto o service role
// (createServiceClient). Tipagem estrutural mínima para evitar atrito de
// generics entre os dois — seguindo o padrão de chatbot.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = { from: (table: string) => any };

/** Normaliza o filtro vindo do form/JSON num shape previsível. */
export function normalizeFilter(raw: unknown): CampaignFilter {
  const f = (raw ?? {}) as Record<string, unknown>;
  const trimOrNull = (v: unknown) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s ? s : null;
  };
  let interesses: string[] = [];
  if (Array.isArray(f.interesses)) {
    interesses = f.interesses.map((x) => String(x).trim()).filter(Boolean);
  } else if (typeof f.interesses === "string" && f.interesses.trim()) {
    interesses = f.interesses.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return {
    city: trimOrNull(f.city),
    tipo_cliente: trimOrNull(f.tipo_cliente),
    status_funil: trimOrNull(f.status_funil),
    interesses,
  };
}

/**
 * Resolve a audiência da campanha: aplica o filtro de segmentação + consentimento
 * e devolve a lista de contatos elegíveis. O filtro de `interesses` (OR entre
 * vários interesses num jsonb array) é aplicado em memória por robustez.
 */
export async function resolveAudience(
  db: DB,
  organizationId: string,
  filter: CampaignFilter,
): Promise<AudienceContact[]> {
  let q = db
    .from("contacts")
    .select("id, phone, name, interesses")
    .eq("organization_id", organizationId)
    .eq("consentimento_marketing", true) // opt-in OBRIGATÓRIO (Guia §11.3)
    .neq("is_group", true)
    .not("phone", "is", null)
    .limit(10000);

  if (filter.city) q = q.eq("city", filter.city);
  if (filter.tipo_cliente) q = q.eq("tipo_cliente", filter.tipo_cliente);
  if (filter.status_funil) q = q.eq("status_funil", filter.status_funil);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as AudienceContact[];
  rows = rows.filter((c) => c.phone && String(c.phone).trim());

  // Filtro de interesses em memória: contato deve conter PELO MENOS UM dos
  // interesses selecionados (jsonb array em contacts.interesses).
  if (filter.interesses && filter.interesses.length) {
    const wanted = filter.interesses.map((i) => i.toLowerCase());
    rows = rows.filter((c) => {
      const arr = Array.isArray(c.interesses) ? c.interesses : [];
      const have = arr.map((x) => String(x).toLowerCase());
      return wanted.some((w) => have.includes(w));
    });
  }
  return rows;
}

/** Conta quantos contatos a segmentação atinge (preview de público). */
export async function countAudience(
  db: DB,
  organizationId: string,
  filter: CampaignFilter,
): Promise<number> {
  // Quando não há filtro de interesses, dá pra contar no banco (head+count).
  if (!filter.interesses || filter.interesses.length === 0) {
    let q = db
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("consentimento_marketing", true)
      .neq("is_group", true)
      .not("phone", "is", null);
    if (filter.city) q = q.eq("city", filter.city);
    if (filter.tipo_cliente) q = q.eq("tipo_cliente", filter.tipo_cliente);
    if (filter.status_funil) q = q.eq("status_funil", filter.status_funil);
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return count ?? 0;
  }
  // Com interesses, precisamos resolver em memória.
  const rows = await resolveAudience(db, organizationId, filter);
  return rows.length;
}

/**
 * Verifica se o contato está na janela de 24h da Meta: existe alguma mensagem
 * inbound (direction='in') do contato nas últimas 24h. Em texto livre só é
 * permitido enviar DENTRO dessa janela; fora dela exige template HSM aprovado.
 */
export async function isWithin24hWindow(
  db: DB,
  organizationId: string,
  contactId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // Conversas do contato → última mensagem inbound recente.
  const { data: convs } = await db
    .from("conversations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId);
  const convIds = (convs ?? []).map((c: { id: string }) => c.id);
  if (!convIds.length) return false;

  const { count } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", convIds)
    .eq("direction", "in")
    .gte("created_at", since);
  return (count ?? 0) > 0;
}

/** Personaliza a mensagem com o primeiro nome do contato. */
export function personalize(template: string, name: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0] || "";
  // Suporta {nome} e {{nome}} como placeholders opcionais.
  return template.replace(/\{\{?\s*nome\s*\}?\}/gi, first);
}

export interface SendResult {
  total: number;
  sent: number;
  failed: number;
  awaitingTemplate: number;
}

/**
 * Dispara a campanha: percorre a audiência, respeita a janela de 24h e registra
 * cada destinatário em `campaign_recipients`. NÃO lança erro por falha individual
 * — cada contato vira uma linha com seu status. Atualiza contadores da campanha.
 *
 * @param db client com permissão de varrer contatos (service role nas actions).
 */
export async function sendCampaign(
  db: DB,
  opts: {
    organizationId: string;
    campaignId: string;
    channel: Channel;
    message: string;
    audience: AudienceContact[];
  },
): Promise<SendResult> {
  const { organizationId, campaignId, channel, message, audience } = opts;
  const provider = getProvider(channel);

  let sent = 0;
  let failed = 0;
  let awaitingTemplate = 0;

  await db.from("campaigns").update({
    status: "sending",
    started_at: new Date().toISOString(),
    total_contacts: audience.length,
    sent_count: 0,
    failed_count: 0,
  }).eq("id", campaignId);

  for (const contact of audience) {
    const text = personalize(message, contact.name);
    const inWindow = await isWithin24hWindow(db, organizationId, contact.id);

    // ── RESTRIÇÃO META: fora da janela de 24h, texto livre é proibido. Sem HSM
    //    aprovado, marcamos 'aguardando_template' e NÃO enviamos — sem quebrar. ──
    if (!inWindow) {
      awaitingTemplate++;
      await upsertRecipient(db, {
        organizationId, campaignId, contact, channel: channel.type,
        status: "aguardando_template", inWindow: false,
      });
      continue;
    }

    try {
      const res = await provider.sendText({ to: contact.phone, text });
      sent++;
      await upsertRecipient(db, {
        organizationId, campaignId, contact, channel: channel.type,
        status: "sent", inWindow: true, externalId: res.externalId ?? null,
        sentAt: new Date().toISOString(),
      });
    } catch (e) {
      failed++;
      await upsertRecipient(db, {
        organizationId, campaignId, contact, channel: channel.type,
        status: "failed", inWindow: true,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    if ((sent + failed + awaitingTemplate) % 10 === 0) {
      await db.from("campaigns").update({ sent_count: sent, failed_count: failed }).eq("id", campaignId);
    }
  }

  await db.from("campaigns").update({
    status: "done",
    sent_count: sent,
    failed_count: failed,
    progress: 100,
    finished_at: new Date().toISOString(),
    stats: { sent, failed, awaitingTemplate, total: audience.length },
  }).eq("id", campaignId);

  return { total: audience.length, sent, failed, awaitingTemplate };
}

/** Registra (idempotente por campanha+contato) o status de um destinatário. */
async function upsertRecipient(
  db: DB,
  r: {
    organizationId: string;
    campaignId: string;
    contact: AudienceContact;
    channel: string;
    status: "sent" | "failed" | "aguardando_template" | "pending" | "skipped_opt_out";
    inWindow: boolean;
    externalId?: string | null;
    error?: string | null;
    sentAt?: string | null;
  },
): Promise<void> {
  await db.from("campaign_recipients").upsert(
    {
      organization_id: r.organizationId,
      campaign_id: r.campaignId,
      contact_id: r.contact.id,
      phone: r.contact.phone,
      name: r.contact.name,
      status: r.status,
      channel: r.channel,
      external_id: r.externalId ?? null,
      error: r.error ?? null,
      in_window_24h: r.inWindow,
      sent_at: r.sentAt ?? null,
    },
    { onConflict: "campaign_id,contact_id" },
  );
}

/** 3 modelos prontos (Guia §11.2). [link] é substituído pelo usuário/UI. */
export const CAMPAIGN_TEMPLATES: { id: string; label: string; message: string }[] = [
  {
    id: "vip",
    label: "Grupo VIP",
    message:
      "Você já conhece o nosso Grupo VIP? 🌷\n" +
      "Lá você encontra: acesso antecipado a lançamentos, condições e descontos exclusivos, conteúdos de bem-estar e aromaterapia e atendimento personalizado.\n" +
      "Entre e viva a experiência completa Essentiale: [link]\n" +
      "Com carinho, Equipe Essentiale 🤍",
  },
  {
    id: "lancamento",
    label: "Lançamento",
    message:
      "Oiiii! Passando pra contar uma novidade cheia de amor: a nova coleção da Essentiale chegou e está lindíssima! 🥰🌷\n" +
      "Feita com muito carinho para tocar o coração. Confira: [link]\n" +
      "Se quiser ajuda para escolher, estou por aqui!",
  },
  {
    id: "promocao",
    label: "Promoção",
    message:
      "✨ PROMOÇÃO ESSENTIALE ✨\n" +
      "Todos os refis estão em promoção 💛 (difusor, home spray e sabonete).\n" +
      "👉 Aproveita enquanto durar o estoque! 🔗 [link]",
  },
];
