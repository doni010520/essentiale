import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session?.organization) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const sb = await createClient();
  const { data } = await sb
    .from("contacts")
    .select("name, phone, email, city, address, notes, is_group, created_at")
    .eq("organization_id", session.organization.id)
    .neq("is_group", true)
    .order("name")
    .limit(50000);

  const rows = (data ?? []) as Record<string, unknown>[];
  const header = "Nome,Telefone,Email,Cidade,Endereço,Observações,Criado em";
  const csv = [header, ...rows.map((r) =>
    [r.name, r.phone, r.email, r.city, r.address, String(r.notes ?? "").replace(/[\n,]/g, " "), r.created_at]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(","),
  )].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contatos_${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
