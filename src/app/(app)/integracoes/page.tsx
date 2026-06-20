import { Scroll } from "@/components/scroll";
import { PageHeader } from "@/components/ui";
import { IntegrationsClient } from "@/components/integrations-client";
import { createClient } from "@/lib/supabase/server";
import { PREVIEW_MODE } from "@/lib/mock";
import type { Integration } from "@/lib/types";

async function getIntegrations(): Promise<Integration[]> {
  if (PREVIEW_MODE)
    return [{ id: "i1", organization_id: "preview", type: "sgp", config: { url: "https://sgp.mvfnet.com.br" }, active: true, created_at: "" }];
  const sb = await createClient();
  const { data } = await sb.from("integrations").select("*").order("created_at");
  return (data as Integration[]) ?? [];
}

export default async function IntegracoesPage() {
  const integrations = await getIntegrations();
  return (
    <Scroll>
      <PageHeader title="Integrações" subtitle="Conecte sistemas externos (ex.: SGP de provedores)." />
      <IntegrationsClient integrations={integrations} />
    </Scroll>
  );
}
