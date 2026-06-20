import { Scroll } from "@/components/scroll";
import { PageHeader } from "@/components/ui";
import { AutomationsClient } from "@/components/automations-client";
import { getChannels } from "@/lib/data/channels";
import { createClient } from "@/lib/supabase/server";
import { PREVIEW_MODE } from "@/lib/mock";
import type { Automation, Integration } from "@/lib/types";

async function getAutomations(): Promise<Automation[]> {
  if (PREVIEW_MODE)
    return [
      { id: "a1", organization_id: "preview", channel_id: null, integration_id: null, name: "Horário comercial", trigger: "menu", flow: { nodes: [], edges: [] }, schedule: null, active: true, updated_at: "", created_at: "" },
      { id: "a2", organization_id: "preview", channel_id: null, integration_id: null, name: "Agente de IA - Suporte", trigger: null, flow: { nodes: [], edges: [] }, schedule: null, active: false, updated_at: "", created_at: "" },
    ];
  const sb = await createClient();
  const { data } = await sb.from("automations").select("*").order("updated_at", { ascending: false });
  return (data as Automation[]) ?? [];
}

async function getIntegrations(): Promise<Integration[]> {
  if (PREVIEW_MODE) return [];
  const sb = await createClient();
  const { data } = await sb.from("integrations").select("*").eq("active", true).order("created_at");
  return (data as Integration[]) ?? [];
}

export default async function AutomacoesPage() {
  const [automations, channels, integrations] = await Promise.all([
    getAutomations(),
    getChannels(),
    getIntegrations(),
  ]);
  return (
    <Scroll>
      <PageHeader title="Automações" subtitle="Fluxos de chatbot vinculados aos seus canais." />
      <AutomationsClient automations={automations} channels={channels} integrations={integrations} />
    </Scroll>
  );
}
