import { Scroll } from "@/components/scroll";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { PedidosClient } from "./pedidos-client";

async function getOrders() {
  const sb = await createClient();
  const { data } = await sb
    .from("orders")
    .select(`
      id, nome_completo, cpf, email, telefone, endereco, cep,
      tipo_entrega, quem_recebe,
      subtotal_centavos, frete_centavos, desconto_centavos, total_centavos,
      payment_method, payment_status, checkout_url, pix_code,
      status, tracking_code, notes, created_at, updated_at,
      order_items (id, nome, fragrancia, quantidade, preco_unitario_centavos, subtotal_centavos, personalizacao)
    `)
    .order("created_at", { ascending: false })
    .limit(200);
  return data ?? [];
}

export default async function PedidosPage() {
  const orders = await getOrders();

  return (
    <Scroll>
      <PageHeader
        title="Pedidos"
        subtitle={`${orders.length} pedidos`}
      />
      <PedidosClient orders={orders} />
    </Scroll>
  );
}
