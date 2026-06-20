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
