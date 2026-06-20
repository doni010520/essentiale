"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export async function saveBusinessHours(fd: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Configure o Supabase.");
  const session = await getSession();
  if (!session?.organization) throw new Error("Sessão inválida.");
  const sb = await createClient();
  const orgId = session.organization.id;

  // Deleta e recria todos os horários (simples e sem conflito)
  await sb.from("business_hours").delete().eq("organization_id", orgId).is("department_id", null);

  const rows: { organization_id: string; day_of_week: number; start_time: string; end_time: string; active: boolean }[] = [];
  for (let d = 0; d < 7; d++) {
    const active = fd.get(`day_${d}_active`) === "on";
    const start = String(fd.get(`day_${d}_start`) || "08:00");
    const end = String(fd.get(`day_${d}_end`) || "18:00");
    rows.push({ organization_id: orgId, day_of_week: d, start_time: start, end_time: end, active });
  }

  if (rows.length) {
    await sb.from("business_hours").insert(rows);
  }

  revalidatePath("/ajustes/horario");
}
