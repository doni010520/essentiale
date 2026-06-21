// Contrato compartilhado do CRM (lista, ficha e Kanban de funil).

export const FUNNEL_STAGES = [
  { key: "lead", label: "Lead", dot: "bg-gray-400", head: "text-gray-600" },
  { key: "negociacao", label: "Em negociação", dot: "bg-amber-500", head: "text-amber-700" },
  { key: "cliente", label: "Cliente", dot: "bg-brand", head: "text-brand" },
  { key: "recorrente", label: "Recorrente", dot: "bg-violet-500", head: "text-violet-700" },
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number]["key"];

/** Normaliza o status_funil (pode vir null/legado) para uma etapa canônica. */
export function stageOf(status: string | null | undefined): FunnelStage {
  const s = (status ?? "").toLowerCase();
  if (s.includes("recorr")) return "recorrente";
  if (s.includes("client")) return "cliente";
  if (s.includes("negoc")) return "negociacao";
  return "lead";
}

export interface CrmContact {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  cpf: string | null;
  address: string | null;
  data_aniversario: string | null;
  tipo_cliente: string | null;
  status_funil: string | null;
  consentimento_marketing: boolean | null;
  interesses: unknown;
  origem_lead: string | null;
  notes: string | null;
  avatar_url: string | null;
  created_at: string;
  // Agregados de pedidos (calculados no servidor).
  pedidos_count: number;
  total_centavos: number;
  ultima_compra: string | null;
}
