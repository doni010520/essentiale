import { Scroll } from "@/components/scroll";
import { PageHeader } from "@/components/ui";
import { AgentsClient } from "@/components/agents-client";
import { getAgents, getDepartments } from "@/lib/data/management";

export default async function AtendentesPage() {
  const [agents, departments] = await Promise.all([getAgents(), getDepartments()]);
  return (
    <Scroll>
      <PageHeader title="Atendentes" subtitle="Gerencie os usuários, seus departamentos e permissões." />
      <AgentsClient agents={agents} departments={departments} />
    </Scroll>
  );
}
