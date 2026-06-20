import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Scroll } from "@/components/scroll";
import { PageHeader, Card } from "@/components/ui";
import { AiAgentList, type AiAgentRow } from "@/components/ai-agent-form";
import { AiAllowlist } from "@/components/ai-allowlist";
import { getChannels } from "@/lib/data/channels";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PREVIEW_MODE } from "@/lib/mock";
import type { AiAllowedNumber } from "@/lib/types";

export default async function AiAgentPage() {
  const channels = await getChannels();
  let agents: AiAgentRow[] = [];
  let allowed: AiAllowedNumber[] = [];
  if (!PREVIEW_MODE) {
    const session = await getSession();
    if (session?.organization) {
      const sb = await createClient();
      const { data } = await sb
        .from("ai_agents")
        .select("id, name, prompt, model, channel_id, active, config")
        .eq("organization_id", session.organization.id)
        .order("created_at", { ascending: true });
      agents = (data as AiAgentRow[]) ?? [];
      const { data: nums } = await sb
        .from("ai_allowed_numbers")
        .select("id, organization_id, phone, label, active, created_at")
        .eq("organization_id", session.organization.id)
        .order("created_at", { ascending: true });
      allowed = (nums as AiAllowedNumber[]) ?? [];
    }
  }

  return (
    <Scroll>
      <Link href="/ajustes" className="mt-4 inline-flex items-center gap-1 text-sm text-brand hover:underline">
        <ArrowLeft size={15} /> Ajustes
      </Link>
      <PageHeader
        title="Agentes de IA"
        subtitle="Gerencie os agentes de IA da sua empresa."
      />

      <Card className="mb-4 flex items-start gap-3 border border-brand/20 bg-brand-light/30">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-brand" />
        <div className="text-xs text-ink-soft">
          Os agentes são acionados pelos nós <strong>IA</strong> dos fluxos de automação. Usam ferramentas do
          SGP (consultar cliente, faturas, 2ª via/PIX, liberação, chamados) e podem transferir para um atendente.
          Requer <code className="font-mono">OPENAI_API_KEY</code> no ambiente.
        </div>
      </Card>

      <AiAgentList agents={agents} channels={channels} />
      {!PREVIEW_MODE && <AiAllowlist numbers={allowed} />}
    </Scroll>
  );
}
