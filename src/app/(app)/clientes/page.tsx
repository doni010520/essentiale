import { Scroll } from "@/components/scroll";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { PREVIEW_MODE } from "@/lib/mock";
import { ClientesClient } from "./clientes-client";
import { stageOf, type CrmContact } from "./types";

const CONTACT_FIELDS =
  "id, name, phone, email, city, cpf, address, data_aniversario, tipo_cliente, status_funil, consentimento_marketing, interesses, origem_lead, notes, avatar_url, created_at, is_group";

export interface ClientesIndicadores {
  total: number;
  novosNoMes: number;
  recorrentes: number;
  aniversariantes: number;
  optInPct: number;
}

type ContactRow = Omit<CrmContact, "pedidos_count" | "total_centavos" | "ultima_compra"> & {
  is_group?: boolean | null;
};

interface OrderRow {
  contact_id: string | null;
  total_centavos: number | null;
  status: string | null;
  created_at: string | null;
}

async function getData(): Promise<{ contacts: CrmContact[]; indicadores: ClientesIndicadores }> {
  if (PREVIEW_MODE) {
    return {
      contacts: [],
      indicadores: { total: 0, novosNoMes: 0, recorrentes: 0, aniversariantes: 0, optInPct: 0 },
    };
  }

  const sb = await createClient();

  const [{ data: contactRows }, { data: orderRows }] = await Promise.all([
    sb
      .from("contacts")
      .select(CONTACT_FIELDS)
      .neq("is_group", true)
      .order("name")
      .limit(500),
    sb
      .from("orders")
      .select("contact_id, total_centavos, status, created_at"),
  ]);

  const contactsData = (contactRows ?? []) as ContactRow[];
  const orders = (orderRows ?? []) as OrderRow[];

  // Agrega pedidos por contato em memória.
  const agg = new Map<string, { count: number; total: number; last: string | null }>();
  for (const o of orders) {
    if (!o.contact_id) continue;
    const cur = agg.get(o.contact_id) ?? { count: 0, total: 0, last: null };
    cur.count += 1;
    cur.total += o.total_centavos ?? 0;
    if (o.created_at && (!cur.last || o.created_at > cur.last)) cur.last = o.created_at;
    agg.set(o.contact_id, cur);
  }

  const contacts: CrmContact[] = contactsData.map((c) => {
    const a = agg.get(c.id);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      city: c.city,
      cpf: c.cpf,
      address: c.address,
      data_aniversario: c.data_aniversario,
      tipo_cliente: c.tipo_cliente,
      status_funil: c.status_funil,
      consentimento_marketing: c.consentimento_marketing,
      interesses: c.interesses,
      origem_lead: c.origem_lead,
      notes: c.notes,
      avatar_url: c.avatar_url,
      created_at: c.created_at,
      pedidos_count: a?.count ?? 0,
      total_centavos: a?.total ?? 0,
      ultima_compra: a?.last ?? null,
    };
  });

  // Indicadores.
  const now = new Date();
  const mesAtual = now.getMonth(); // 0-11
  const anoAtual = now.getFullYear();

  let novosNoMes = 0;
  let recorrentes = 0;
  let aniversariantes = 0;
  let optIn = 0;

  for (const c of contacts) {
    const created = c.created_at ? new Date(c.created_at) : null;
    if (created && created.getMonth() === mesAtual && created.getFullYear() === anoAtual) {
      novosNoMes += 1;
    }
    if (stageOf(c.status_funil) === "recorrente") recorrentes += 1;
    if (c.data_aniversario) {
      // data_aniversario é DATE (YYYY-MM-DD); mês é o segundo segmento (1-12).
      const parts = c.data_aniversario.split("-");
      const mes = parts.length >= 2 ? Number(parts[1]) : NaN;
      if (mes === mesAtual + 1) aniversariantes += 1;
    }
    if (c.consentimento_marketing) optIn += 1;
  }

  const total = contacts.length;
  const optInPct = total > 0 ? Math.round((optIn / total) * 100) : 0;

  return {
    contacts,
    indicadores: { total, novosNoMes, recorrentes, aniversariantes, optInPct },
  };
}

export default async function ClientesPage() {
  const { contacts, indicadores } = await getData();

  return (
    <Scroll>
      <PageHeader
        title="Clientes"
        subtitle="CRM: contatos, funil de vendas e indicadores."
      />
      <ClientesClient contacts={contacts} indicadores={indicadores} />
    </Scroll>
  );
}
