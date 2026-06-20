import { createClient } from "@/lib/supabase/server";
import { PREVIEW_MODE } from "@/lib/mock";

export interface ReportData {
  totals: { all: number; open: number; queued: number; bot: number; closed: number };
  byDay: { date: string; total: number }[];
  byStatus: { name: string; value: number }[];
  byChannel: { name: string; value: number }[];
  byDepartment: { name: string; value: number }[];
}

export interface AgentReport { name: string; total: number; open: number; closed: number }
export interface ClientReport { name: string; phone: string; total: number; last: string | null }
export interface CsatReport { survey: string; avg: number; count: number; distribution: { note: number; count: number }[] }

const STATUS_LABEL: Record<string, string> = {
  open: "Em andamento", queued: "Em espera", bot: "Na automação", closed: "Encerrados",
};

function mockReport(): ReportData {
  const byDay = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400000);
    return { date: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`, total: 20 + Math.round(40 * Math.abs(Math.sin(i))) };
  });
  return {
    totals: { all: 1698, open: 13, queued: 14, bot: 6, closed: 1665 },
    byDay,
    byStatus: [
      { name: "Encerrados", value: 1665 }, { name: "Em espera", value: 14 },
      { name: "Em andamento", value: 13 }, { name: "Na automação", value: 6 },
    ],
    byChannel: [
      { name: "CENTRAL MVFNET", value: 520 }, { name: "IBICUI - API Oficial", value: 410 },
      { name: "MVF NET CANAA 1730", value: 360 }, { name: "IGUAI - API Oficial", value: 280 }, { name: "Outros", value: 128 },
    ],
    byDepartment: [
      { name: "Suporte Técnico", value: 980 }, { name: "Financeiro", value: 430 }, { name: "Comercial", value: 288 },
    ],
  };
}

export async function getReportData(): Promise<ReportData> {
  if (PREVIEW_MODE) return mockReport();
  const sb = await createClient();

  const [{ data: convs }, { data: channels }, { data: depts }] = await Promise.all([
    sb.from("conversations").select("status, channel_id, department_id, created_at").limit(2000),
    sb.from("channels").select("id, name"),
    sb.from("departments").select("id, name"),
  ]);

  const rows = convs ?? [];
  const chName = new Map((channels ?? []).map((c) => [c.id, c.name]));
  const deptName = new Map((depts ?? []).map((d) => [d.id, d.name]));

  const totals = { all: rows.length, open: 0, queued: 0, bot: 0, closed: 0 };
  const byStatusMap: Record<string, number> = {};
  const byChannelMap: Record<string, number> = {};
  const byDeptMap: Record<string, number> = {};
  const byDayMap: Record<string, number> = {};

  // últimos 14 dias
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    days.push(key);
    byDayMap[key] = 0;
  }

  for (const r of rows) {
    if (r.status in totals) (totals as Record<string, number>)[r.status]++;
    byStatusMap[STATUS_LABEL[r.status] ?? r.status] = (byStatusMap[STATUS_LABEL[r.status] ?? r.status] ?? 0) + 1;
    const cn = chName.get(r.channel_id) ?? "Sem canal";
    byChannelMap[cn] = (byChannelMap[cn] ?? 0) + 1;
    if (r.department_id) {
      const dn = deptName.get(r.department_id) ?? "Outro";
      byDeptMap[dn] = (byDeptMap[dn] ?? 0) + 1;
    }
    if (r.created_at) {
      const d = new Date(r.created_at);
      const key = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key in byDayMap) byDayMap[key]++;
    }
  }

  const topN = (m: Record<string, number>, n = 6) =>
    Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, n);

  return {
    totals,
    byDay: days.map((date) => ({ date, total: byDayMap[date] })),
    byStatus: topN(byStatusMap),
    byChannel: topN(byChannelMap),
    byDepartment: topN(byDeptMap),
  };
}

/** Relatório por atendente. */
export async function getAgentReports(): Promise<AgentReport[]> {
  if (PREVIEW_MODE) return [];
  const sb = await createClient();
  const [{ data: convs }, { data: profiles }] = await Promise.all([
    sb.from("conversations").select("assigned_user_id, status").not("assigned_user_id", "is", null).limit(5000),
    sb.from("profiles").select("id, name"),
  ]);
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.name || p.id]));
  const map: Record<string, { total: number; open: number; closed: number }> = {};
  for (const c of convs ?? []) {
    const k = c.assigned_user_id as string;
    const e = (map[k] ??= { total: 0, open: 0, closed: 0 });
    e.total++;
    if (c.status === "open") e.open++;
    if (c.status === "closed") e.closed++;
  }
  return Object.entries(map)
    .map(([id, v]) => ({ name: nameOf.get(id) ?? id, ...v }))
    .sort((a, b) => b.total - a.total);
}

/** Relatório por cliente (top contatos). */
export async function getClientReports(): Promise<ClientReport[]> {
  if (PREVIEW_MODE) return [];
  const sb = await createClient();
  const { data } = await sb
    .from("conversations")
    .select("contact_id, contacts(name, phone), created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  const map: Record<string, { name: string; phone: string; total: number; last: string | null }> = {};
  for (const c of (data ?? []) as unknown as { contact_id: string; contacts: { name: string; phone: string } | null; created_at: string }[]) {
    const k = c.contact_id;
    if (!map[k]) map[k] = { name: c.contacts?.name ?? "—", phone: c.contacts?.phone ?? "", total: 0, last: null };
    map[k].total++;
    if (!map[k].last) map[k].last = c.created_at;
  }
  return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 100);
}

/** Relatório CSAT. */
export async function getCsatReport(): Promise<CsatReport[]> {
  if (PREVIEW_MODE) return [];
  const sb = await createClient();
  const { data: convs } = await sb
    .from("conversations")
    .select("satisfaction, survey_id")
    .not("satisfaction", "is", null)
    .limit(5000);
  const { data: surveys } = await sb.from("satisfaction_surveys").select("id, name");
  const surveyName = new Map((surveys ?? []).map((s) => [s.id, s.name]));
  const map: Record<string, { sum: number; count: number; dist: Record<number, number> }> = {};
  for (const c of (convs ?? []) as { satisfaction: number; survey_id: string | null }[]) {
    const k = c.survey_id ?? "__default";
    const e = (map[k] ??= { sum: 0, count: 0, dist: {} });
    e.sum += c.satisfaction;
    e.count++;
    e.dist[c.satisfaction] = (e.dist[c.satisfaction] ?? 0) + 1;
  }
  return Object.entries(map).map(([id, v]) => ({
    survey: surveyName.get(id) ?? "Padrão",
    avg: v.count ? Math.round((v.sum / v.count) * 10) / 10 : 0,
    count: v.count,
    distribution: [1, 2, 3, 4, 5].map((n) => ({ note: n, count: v.dist[n] ?? 0 })),
  }));
}

/* ════════════════════════════════════════════════════════════════════════════
 * PAINEL DE KPIs — Essentiale Fragrance (Guia §1.3 — Indicadores de sucesso)
 * Cálculos a partir dos dados REAIS do banco (org Essentiale).
 * ════════════════════════════════════════════════════════════════════════════ */

export type PeriodDays = 7 | 30 | 90;

/** Pacote completo de KPIs do painel de relatórios. */
export interface KpiReport {
  periodDays: PeriodDays;
  /** Resumo de volume no período. */
  volume: {
    conversations: number;
    contacts: number;
    orders: number;
    revenueCentavos: number;
  };
  /** 1) Tempo de 1ª resposta (meta < 1 min). */
  firstResponse: {
    medianSeconds: number | null;
    avgSeconds: number | null;
    sample: number;
    /** % de 1as respostas dentro da meta (< 60s). */
    withinTargetPct: number | null;
  };
  /** 2) Taxa de resposta a leads (meta 100%). */
  responseRate: {
    conversations: number;
    answered: number;
    pct: number | null;
  };
  /** 3) Conversão lead → pedido. */
  conversion: {
    conversations: number;
    withOrder: number;
    orders: number;
    pct: number | null;
  };
  /** 4) Handoff — conversas transferidas para humano. */
  handoff: {
    count: number;
    pct: number | null;
  };
  /** 5) CSAT pós-entrega (meta ≥ 4,7). */
  csat: {
    avg: number | null;
    count: number;
    distribution: { note: number; count: number }[];
  };
  /** 6) Reativação por disparo (followups + campanhas). */
  reactivation: {
    followupsSent: number;
    campaignsRun: number;
    campaignMessagesSent: number;
    hasData: boolean;
  };
  /** Série diária para gráficos (conversas × pedidos × receita). */
  byDay: { date: string; conversations: number; orders: number; revenueCentavos: number }[];
}

function dayKey(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Quantil (linear) de uma lista numérica já ordenada ou não. */
function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

interface MockKpiOpts {
  periodDays: PeriodDays;
}

function mockKpiReport({ periodDays }: MockKpiOpts): KpiReport {
  const span = Math.min(periodDays, 30);
  const byDay = Array.from({ length: span }, (_, i) => {
    const d = new Date(Date.now() - (span - 1 - i) * 86400000);
    const conversations = 6 + Math.round(10 * Math.abs(Math.sin(i)));
    const orders = Math.round(conversations * 0.35);
    return { date: dayKey(d), conversations, orders, revenueCentavos: orders * 18900 };
  });
  const conversations = byDay.reduce((s, d) => s + d.conversations, 0);
  const orders = byDay.reduce((s, d) => s + d.orders, 0);
  const revenue = byDay.reduce((s, d) => s + d.revenueCentavos, 0);
  return {
    periodDays,
    volume: { conversations, contacts: Math.round(conversations * 0.8), orders, revenueCentavos: revenue },
    firstResponse: { medianSeconds: 42, avgSeconds: 58, sample: conversations, withinTargetPct: 78 },
    responseRate: { conversations, answered: Math.round(conversations * 0.98), pct: 98 },
    conversion: { conversations, withOrder: Math.round(conversations * 0.32), orders, pct: 32 },
    handoff: { count: Math.round(conversations * 0.12), pct: 12 },
    csat: {
      avg: 4.8,
      count: Math.round(orders * 0.4),
      distribution: [
        { note: 1, count: 0 }, { note: 2, count: 1 }, { note: 3, count: 2 },
        { note: 4, count: 8 }, { note: 5, count: 26 },
      ],
    },
    reactivation: { followupsSent: Math.round(orders * 1.5), campaignsRun: 3, campaignMessagesSent: 240, hasData: true },
    byDay,
  };
}

/**
 * Calcula todos os KPIs do painel para o período informado (7/30/90 dias).
 * Tudo computado em TS a partir de queries limitadas ao período, para performance.
 */
export async function getKpiReport(periodDays: PeriodDays = 30): Promise<KpiReport> {
  if (PREVIEW_MODE) return mockKpiReport({ periodDays });

  const sb = await createClient();
  const sinceIso = new Date(Date.now() - periodDays * 86400000).toISOString();

  // ── Buscas paralelas, todas restritas ao período. ─────────────────────────
  const [
    { data: convs },
    { data: orders },
    { data: contacts },
    { data: followups },
    { data: campaigns },
  ] = await Promise.all([
    sb
      .from("conversations")
      .select("id, status, assigned_user_id, department_id, satisfaction, created_at")
      .gte("created_at", sinceIso)
      .limit(5000),
    sb
      .from("orders")
      .select("id, conversation_id, contact_id, total_centavos, status, created_at")
      .gte("created_at", sinceIso)
      .limit(5000),
    sb
      .from("contacts")
      .select("id")
      .gte("created_at", sinceIso)
      .limit(5000),
    sb
      .from("followups")
      .select("id, status, sent_at, created_at")
      .gte("created_at", sinceIso)
      .limit(5000),
    sb
      .from("campaigns")
      .select("id, status, sent_count, created_at")
      .gte("created_at", sinceIso)
      .limit(2000),
  ]);

  const convRows = (convs ?? []) as {
    id: string;
    status: string;
    assigned_user_id: string | null;
    department_id: string | null;
    satisfaction: number | null;
    created_at: string;
  }[];
  const orderRows = (orders ?? []) as {
    id: string;
    conversation_id: string | null;
    contact_id: string | null;
    total_centavos: number;
    status: string;
    created_at: string;
  }[];

  const convIds = convRows.map((c) => c.id);

  // ── 1) Tempo de 1ª resposta — busca mensagens das conversas do período. ────
  // Para performance, só busca msgs das conversas listadas (chunked).
  const firstIn = new Map<string, number>(); // convId → ts(ms) da 1ª 'in'
  const firstOut = new Map<string, number>(); // convId → ts(ms) da 1ª 'out'
  if (convIds.length > 0) {
    const CHUNK = 200;
    for (let i = 0; i < convIds.length; i += CHUNK) {
      const slice = convIds.slice(i, i + CHUNK);
      const { data: msgs } = await sb
        .from("messages")
        .select("conversation_id, direction, created_at")
        .in("conversation_id", slice)
        .order("created_at", { ascending: true })
        .limit(20000);
      for (const m of (msgs ?? []) as { conversation_id: string; direction: string; created_at: string }[]) {
        const ts = new Date(m.created_at).getTime();
        if (m.direction === "in") {
          if (!firstIn.has(m.conversation_id)) firstIn.set(m.conversation_id, ts);
        } else if (m.direction === "out") {
          if (!firstOut.has(m.conversation_id)) firstOut.set(m.conversation_id, ts);
        }
      }
    }
  }

  const responseTimes: number[] = []; // segundos
  let answered = 0;
  for (const id of convIds) {
    const tin = firstIn.get(id);
    const tout = firstOut.get(id);
    if (tout !== undefined) answered++;
    if (tin !== undefined && tout !== undefined && tout >= tin) {
      responseTimes.push((tout - tin) / 1000);
    }
  }
  const median = quantile(responseTimes, 0.5);
  const avg =
    responseTimes.length > 0
      ? responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length
      : null;
  const withinTarget = responseTimes.filter((s) => s < 60).length;
  const firstResponse = {
    medianSeconds: median,
    avgSeconds: avg,
    sample: responseTimes.length,
    withinTargetPct: responseTimes.length > 0 ? Math.round((withinTarget / responseTimes.length) * 100) : null,
  };

  // ── 2) Taxa de resposta a leads (meta 100%). ──────────────────────────────
  const responseRate = {
    conversations: convRows.length,
    answered,
    pct: convRows.length > 0 ? Math.round((answered / convRows.length) * 100) : null,
  };

  // ── 3) Conversão lead → pedido. ───────────────────────────────────────────
  const convsWithOrder = new Set<string>();
  for (const o of orderRows) {
    if (o.conversation_id) convsWithOrder.add(o.conversation_id);
  }
  const conversion = {
    conversations: convRows.length,
    withOrder: convsWithOrder.size,
    orders: orderRows.length,
    pct: convRows.length > 0 ? Math.round((convsWithOrder.size / convRows.length) * 100) : null,
  };

  // ── 4) Handoff — transferidas para humano (atribuição a usuário/depto). ────
  const handoffCount = convRows.filter(
    (c) => (c.status === "queued" || c.status === "open") && (c.assigned_user_id || c.department_id),
  ).length;
  const handoff = {
    count: handoffCount,
    pct: convRows.length > 0 ? Math.round((handoffCount / convRows.length) * 100) : null,
  };

  // ── 5) CSAT pós-entrega (meta ≥ 4,7). ─────────────────────────────────────
  const sats = convRows.map((c) => c.satisfaction).filter((s): s is number => s != null);
  const distMap: Record<number, number> = {};
  let satSum = 0;
  for (const s of sats) {
    satSum += s;
    distMap[s] = (distMap[s] ?? 0) + 1;
  }
  const csat = {
    avg: sats.length > 0 ? Math.round((satSum / sats.length) * 10) / 10 : null,
    count: sats.length,
    distribution: [1, 2, 3, 4, 5].map((n) => ({ note: n, count: distMap[n] ?? 0 })),
  };

  // ── 6) Reativação por disparo (followups + campanhas). ────────────────────
  const followupRows = (followups ?? []) as { status: string; sent_at: string | null }[];
  const followupsSent = followupRows.filter(
    (f) => f.sent_at != null || f.status === "enviado",
  ).length;
  const campaignRows = (campaigns ?? []) as { status: string; sent_count: number | null }[];
  const campaignsRun = campaignRows.filter((c) => c.status === "done" || c.status === "running" || c.status === "sending").length;
  const campaignMessagesSent = campaignRows.reduce((s, c) => s + (c.sent_count ?? 0), 0);
  const reactivation = {
    followupsSent,
    campaignsRun,
    campaignMessagesSent,
    hasData: followupRows.length > 0 || campaignRows.length > 0,
  };

  // ── Série diária (conversas / pedidos / receita). ─────────────────────────
  const span = Math.min(periodDays, 30); // limita o gráfico a 30 barras p/ legibilidade
  const days: string[] = [];
  const byDayMap: Record<string, { conversations: number; orders: number; revenueCentavos: number }> = {};
  for (let i = span - 1; i >= 0; i--) {
    const k = dayKey(new Date(Date.now() - i * 86400000));
    days.push(k);
    byDayMap[k] = { conversations: 0, orders: 0, revenueCentavos: 0 };
  }
  for (const c of convRows) {
    const k = dayKey(new Date(c.created_at));
    if (k in byDayMap) byDayMap[k].conversations++;
  }
  for (const o of orderRows) {
    const k = dayKey(new Date(o.created_at));
    if (k in byDayMap) {
      byDayMap[k].orders++;
      byDayMap[k].revenueCentavos += o.total_centavos ?? 0;
    }
  }

  return {
    periodDays,
    volume: {
      conversations: convRows.length,
      contacts: contacts?.length ?? 0,
      orders: orderRows.length,
      revenueCentavos: orderRows.reduce((s, o) => s + (o.total_centavos ?? 0), 0),
    },
    firstResponse,
    responseRate,
    conversion,
    handoff,
    csat,
    reactivation,
    byDay: days.map((date) => ({ date, ...byDayMap[date] })),
  };
}
