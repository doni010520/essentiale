"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, Play, Search } from "lucide-react";
import { Button } from "@/components/ui";
import { createCampaign, deleteCampaign, launchCampaign } from "@/app/(app)/campanhas/actions";
import type { Campaign, Channel, Automation } from "@/lib/types";

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Rascunho", cls: "bg-gray-100 text-gray-600" },
  scheduled: { label: "Agendada", cls: "bg-blue-100 text-blue-700" },
  running: { label: "Em execução", cls: "bg-green-100 text-green-700" },
  paused: { label: "Pausada", cls: "bg-amber-100 text-amber-700" },
  done: { label: "Concluída", cls: "bg-violet-100 text-violet-700" },
  failed: { label: "Falhou", cls: "bg-red-100 text-red-700" },
};

const STATUS_FILTERS = ["all", "draft", "scheduled", "running", "done"] as const;

export function CampaignsClient({
  campaigns,
  channels,
  automations,
}: {
  campaigns: Campaign[];
  channels: Channel[];
  automations: Pick<Automation, "id" | "name">[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [autoFilter, setAutoFilter] = useState<string>("all");

  const autoName = (id: string | null) => automations.find((a) => a.id === id)?.name ?? null;

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (autoFilter !== "all" && c.automation_id !== autoFilter) return false;
      if (query.trim() && !c.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [campaigns, statusFilter, autoFilter, query]);

  async function submit(fd: FormData) {
    setPending(true);
    try {
      await createCampaign(fd);
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }
  async function remove(id: string) {
    if (!confirm("Excluir campanha?")) return;
    await deleteCampaign(id);
    router.refresh();
  }
  async function launch(c: Campaign) {
    if (!c.channel_id) {
      alert("Defina um canal na campanha antes de disparar.");
      return;
    }
    if (!confirm(`Disparar a campanha "${c.name}" para todos os contatos? Esta ação não pode ser desfeita.`)) return;
    setLaunchingId(c.id);
    try {
      await launchCampaign(c.id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao disparar.");
    } finally {
      setLaunchingId(null);
    }
  }

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setAutoFilter("all");
  }
  const hasFilters = query.trim() !== "" || statusFilter !== "all" || autoFilter !== "all";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar campanha..."
              className="w-48 rounded-lg border border-border py-1.5 pl-8 pr-3 text-sm outline-none focus:border-brand"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border px-2 py-1.5 text-sm outline-none focus:border-brand">
            <option value="all">Todos os status</option>
            {STATUS_FILTERS.filter((s) => s !== "all").map((s) => (
              <option key={s} value={s}>{STATUS[s].label}</option>
            ))}
          </select>
          <select value={autoFilter} onChange={(e) => setAutoFilter(e.target.value)}
            className="rounded-lg border border-border px-2 py-1.5 text-sm outline-none focus:border-brand">
            <option value="all">Todas as automações</option>
            {automations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-ink-soft hover:text-ink">Limpar filtros</button>
          )}
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Criar Nova Campanha</Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-card bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-ink-soft">
              <th className="px-4 py-3 font-medium">Nome da Campanha</th>
              <th className="px-4 py-3 font-medium">Fluxo de Automação</th>
              <th className="px-4 py-3 font-medium">Clientes</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Progresso</th>
              <th className="px-4 py-3 font-medium">Criada em</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-soft">Nenhuma campanha encontrada.</td></tr>
            )}
            {filtered.map((c) => {
              const s = STATUS[c.status] ?? STATUS.draft;
              const canLaunch = c.status === "draft" || c.status === "scheduled";
              return (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{autoName(c.automation_id) ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{c.total_contacts || "—"}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>{s.label}</span></td>
                  <td className="px-4 py-3">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full bg-brand" style={{ width: `${c.progress}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canLaunch && (
                        <button
                          onClick={() => launch(c)}
                          disabled={launchingId === c.id}
                          title="Disparar campanha"
                          className="rounded p-1.5 text-ink-soft hover:bg-green-50 hover:text-green-600 disabled:opacity-40"
                        >
                          <Play size={15} />
                        </button>
                      )}
                      <button onClick={() => remove(c.id)} className="rounded p-1.5 text-ink-soft hover:bg-red-50 hover:text-danger"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-card bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Nova campanha</h2>
              <button onClick={() => setOpen(false)} className="text-ink-soft hover:text-ink"><X size={18} /></button>
            </div>
            <form action={submit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Nome da campanha</label>
                <input name="name" required className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Canal</label>
                <select name="channel_id" required className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand">
                  <option value="">Selecione um canal</option>
                  {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Fluxo de automação (opcional)</label>
                <select name="automation_id" className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand">
                  <option value="">Sem fluxo (só dispara a mensagem)</option>
                  {automations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <p className="mt-1 text-[11px] text-ink-soft">Com fluxo, a conversa continua na automação quando o cliente responder.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Mensagem de disparo</label>
                <textarea name="message" rows={3} placeholder="Deixe em branco para usar a 1ª mensagem do fluxo."
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Agendar para (opcional)</label>
                <input type="datetime-local" name="scheduled_at" className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Criar"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
