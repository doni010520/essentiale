import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Scroll } from "@/components/scroll";
import { PageHeader } from "@/components/ui";
import { CrudManager, type CrudField } from "@/components/crud-manager";
import { createClient } from "@/lib/supabase/server";
import { PREVIEW_MODE } from "@/lib/mock";
import type { Plan } from "@/lib/types";
import { createPlan, updatePlan, deletePlan } from "./actions";

const FIELDS: CrudField[] = [
  { name: "name", label: "Nome do plano", placeholder: "Ex.: Fibra 500MB", required: true, inList: true },
  { name: "price", label: "Preço (R$)", placeholder: "99.90", inList: true },
  { name: "description", label: "Descrição", type: "textarea", placeholder: "Detalhes do plano" },
];

async function getPlans(): Promise<Plan[]> {
  if (PREVIEW_MODE)
    return [
      { id: "p1", organization_id: "preview", name: "Fibra 300MB", price: 79.9, description: "300 Mega", created_at: "" },
      { id: "p2", organization_id: "preview", name: "Fibra 500MB", price: 99.9, description: "500 Mega", created_at: "" },
    ];
  const sb = await createClient();
  const { data } = await sb.from("plans").select("*").order("price");
  return (data as Plan[]) ?? [];
}

export default async function PlanosPage() {
  const plans = await getPlans();
  return (
    <Scroll>
      <Link href="/ajustes" className="mt-4 inline-flex items-center gap-1 text-sm text-brand hover:underline">
        <ArrowLeft size={15} /> Ajustes
      </Link>
      <PageHeader title="Planos de Serviço" subtitle="Gerencie os planos do seu provedor." />
      <CrudManager
        items={plans.map((p) => ({ ...p, price: p.price != null ? String(p.price) : "" }))}
        fields={FIELDS}
        createAction={createPlan}
        updateAction={updatePlan}
        deleteAction={deletePlan}
        addLabel="Novo plano"
        emptyTitle="Nenhum plano cadastrado"
      />
    </Scroll>
  );
}
