import { Scroll } from "@/components/scroll";
import { PageHeader } from "@/components/ui";
import { CampaignsClient } from "@/components/campaigns-client";
import { createClient } from "@/lib/supabase/server";
import { getChannels } from "@/lib/data/channels";
import { PREVIEW_MODE } from "@/lib/mock";
import type { Campaign, Channel, Automation } from "@/lib/types";

async function getCampaigns(): Promise<Campaign[]> {
  if (PREVIEW_MODE)
    return [
      { id: "c1", organization_id: "preview", automation_id: null, channel_id: null, name: "Promoção Fibra 500MB", message: null, status: "running", audience: [], contact_filter: {}, scheduled_at: null, started_at: null, finished_at: null, progress: 64, total_contacts: 100, sent_count: 64, failed_count: 0, stats: {}, created_at: new Date().toISOString() },
      { id: "c2", organization_id: "preview", automation_id: null, channel_id: null, name: "Aviso de manutenção", message: null, status: "done", audience: [], contact_filter: {}, scheduled_at: null, started_at: null, finished_at: null, progress: 100, total_contacts: 50, sent_count: 50, failed_count: 0, stats: {}, created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
    ];
  const sb = await createClient();
  const { data } = await sb.from("campaigns").select("*").order("created_at", { ascending: false });
  return (data as Campaign[]) ?? [];
}

async function getAutomationsList(): Promise<Pick<Automation, "id" | "name">[]> {
  if (PREVIEW_MODE) return [];
  const sb = await createClient();
  const { data } = await sb.from("automations").select("id, name").order("name");
  return (data as Pick<Automation, "id" | "name">[]) ?? [];
}

export default async function CampanhasPage() {
  const [campaigns, channels, automations]: [Campaign[], Channel[], Pick<Automation, "id" | "name">[]] =
    await Promise.all([getCampaigns(), getChannels(), getAutomationsList()]);
  return (
    <Scroll>
      <PageHeader title="Gerenciar Campanhas" subtitle="Campanhas de disparo via fluxos de automação." />
      <CampaignsClient campaigns={campaigns} channels={channels} automations={automations} />
    </Scroll>
  );
}
