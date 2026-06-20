"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOrderStatusMessage } from "@/lib/postsale";

export async function updateOrderStatusAction(id: string, status: string) {
  const db = createServiceClient();
  await db.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  // Pós-venda: dispara a mensagem de status ao cliente (embalado/saiu/entregue).
  // Respeita a janela de 24h da Meta internamente e nunca lança.
  await sendOrderStatusMessage(db, id, status);
  revalidatePath("/pedidos");
}

export async function updateTrackingAction(id: string, tracking_code: string) {
  const db = createServiceClient();
  await db.from("orders").update({ tracking_code, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/pedidos");
}
