import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClienteDetalhe } from "./cliente-detalhe";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  // Next 16: `params` é uma Promise — precisa de await.
  const { id } = await params;
  const sb = await createClient();

  // Contato (todos os campos de CRM).
  const { data: contato } = await sb
    .from("contacts")
    .select(`
      id, name, phone, email, city, cpf, address, data_aniversario,
      tipo_cliente, status_funil, consentimento_marketing, interesses,
      origem_lead, notes, avatar_url, created_at
    `)
    .eq("id", id)
    .maybeSingle();

  if (!contato) notFound();

  // Pedidos do contato + itens.
  const { data: pedidosRaw } = await sb
    .from("orders")
    .select(`
      id, status, total_centavos, created_at,
      order_items (id, nome, quantidade, subtotal_centavos)
    `)
    .eq("contact_id", id)
    .order("created_at", { ascending: false });

  // Trilha de consentimento (LGPD).
  const { data: consentRaw } = await sb
    .from("consent_log")
    .select("id, tipo, canal, created_at")
    .eq("contact_id", id)
    .order("created_at", { ascending: false });

  return (
    <ClienteDetalhe
      contato={contato}
      pedidos={pedidosRaw ?? []}
      consentLog={consentRaw ?? []}
    />
  );
}
