"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";

export async function updateOrderStatusAction(id: string, status: string) {
  const db = createServiceClient();
  await db.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/pedidos");
}

export async function updateTrackingAction(id: string, tracking_code: string) {
  const db = createServiceClient();
  await db.from("orders").update({ tracking_code, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/pedidos");
}
