import { Scroll } from "@/components/scroll";
import { PageHeader, Card, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { PREVIEW_MODE } from "@/lib/mock";
import { formatPhone } from "@/lib/utils";
import Link from "next/link";
import { Download } from "lucide-react";

async function getContacts() {
  if (PREVIEW_MODE) return [];
  const sb = await createClient();
  const { data } = await sb
    .from("contacts")
    .select("id, name, phone, email, city, avatar_url, is_group, notes, created_at")
    .neq("is_group", true)
    .order("name")
    .limit(500);
  return data ?? [];
}

export default async function ClientesPage() {
  const contacts = await getContacts();

  return (
    <Scroll>
      <PageHeader title="Clientes" subtitle="Gerencie os contatos da sua empresa." />
      <div className="mb-4 flex justify-end">
        <Link href="/api/export-contacts" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink transition hover:border-brand hover:text-brand">
          <Download size={14} /> Exportar CSV
        </Link>
      </div>
      {contacts.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-sm text-ink-soft">Nenhum contato encontrado.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50 text-left text-xs font-medium text-ink-soft">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3 text-right">Desde</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {c.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-600">
                          {(c.name ?? "?").slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-ink">{c.name ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{formatPhone(c.phone)}</td>
                  <td className="px-4 py-3 text-ink-soft">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{c.city ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-ink-soft">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Scroll>
  );
}
