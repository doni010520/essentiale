import { Scroll } from "@/components/scroll";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { PREVIEW_MODE } from "@/lib/mock";
import { AuditClient, type AuditLogRow } from "@/components/audit-client";

async function getLogs(): Promise<AuditLogRow[]> {
  if (PREVIEW_MODE)
    return [
      { id: "l1", action: "Atendimento encerrado", entity: "conversation", created_at: new Date().toISOString(), metadata: {} },
      { id: "l2", action: "Canal conectado", entity: "channel", created_at: new Date(Date.now() - 3600000).toISOString(), metadata: {} },
      { id: "l3", action: "Atendente criado", entity: "profile", created_at: new Date(Date.now() - 7200000).toISOString(), metadata: {} },
    ];
  const sb = await createClient();
  const { data } = await sb.from("audit_logs").select("id, action, entity, created_at, metadata").order("created_at", { ascending: false }).limit(1000);
  return (data as AuditLogRow[]) ?? [];
}

export default async function AuditoriaPage() {
  const logs = await getLogs();
  return (
    <Scroll>
      <PageHeader title="Auditoria" subtitle="Histórico de ações e atendimentos do sistema." />
      <AuditClient logs={logs} />
    </Scroll>
  );
}
