import { Scroll } from "@/components/scroll";
import { PageHeader } from "@/components/ui";
import { CampanhasClient, type SegmentOptions } from "./campanhas-client";
import { createClient } from "@/lib/supabase/server";
import { getChannels } from "@/lib/data/channels";
import { PREVIEW_MODE } from "@/lib/mock";
import type { Campaign, Channel } from "@/lib/types";

async function getCampaigns(): Promise<Campaign[]> {
  if (PREVIEW_MODE)
    return [
      { id: "c1", organization_id: "preview", automation_id: null, channel_id: null, name: "Promoção Refis", message: null, status: "done", audience: [], contact_filter: {}, scheduled_at: null, started_at: null, finished_at: null, progress: 100, total_contacts: 42, sent_count: 40, failed_count: 2, stats: {}, created_at: new Date().toISOString() },
      { id: "c2", organization_id: "preview", automation_id: null, channel_id: null, name: "Lançamento Coleção", message: null, status: "draft", audience: [], contact_filter: {}, scheduled_at: null, started_at: null, finished_at: null, progress: 0, total_contacts: 0, sent_count: 0, failed_count: 0, stats: {}, created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
    ];
  const sb = await createClient();
  const { data } = await sb.from("campaigns").select("*").order("created_at", { ascending: false });
  return (data as Campaign[]) ?? [];
}

/** Valores distintos para os filtros de segmentação (cidade, tipo, funil, interesses). */
async function getSegmentOptions(): Promise<SegmentOptions> {
  if (PREVIEW_MODE) {
    return {
      cities: ["São Paulo", "Rio de Janeiro"],
      tiposCliente: ["consumidor", "lojista"],
      statusFunil: ["lead", "cliente"],
      interesses: ["difusor", "home spray", "sabonete", "aromaterapia"],
    };
  }
  const sb = await createClient();
  const { data } = await sb
    .from("contacts")
    .select("city, tipo_cliente, status_funil, interesses")
    .limit(10000);
  const rows = (data ?? []) as Array<{
    city: string | null;
    tipo_cliente: string | null;
    status_funil: string | null;
    interesses: unknown;
  }>;
  const uniq = (vals: (string | null | undefined)[]) =>
    Array.from(new Set(vals.map((v) => (v ?? "").trim()).filter(Boolean))).sort();

  const interesses = new Set<string>();
  for (const r of rows) {
    if (Array.isArray(r.interesses)) {
      for (const i of r.interesses) {
        const s = String(i).trim();
        if (s) interesses.add(s);
      }
    }
  }
  return {
    cities: uniq(rows.map((r) => r.city)),
    tiposCliente: uniq(rows.map((r) => r.tipo_cliente)),
    statusFunil: uniq(rows.map((r) => r.status_funil)),
    interesses: Array.from(interesses).sort(),
  };
}

export default async function CampanhasPage() {
  const [campaigns, channels, segmentOptions]: [Campaign[], Channel[], SegmentOptions] =
    await Promise.all([getCampaigns(), getChannels(), getSegmentOptions()]);
  return (
    <Scroll>
      <PageHeader title="Campanhas e Disparos" subtitle="Crie campanhas segmentadas e dispare via WhatsApp respeitando o consentimento." />
      <CampanhasClient campaigns={campaigns} channels={channels} segmentOptions={segmentOptions} />
    </Scroll>
  );
}
