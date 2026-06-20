"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, Play, Search, Users, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";
import {
  createCampaign,
  deleteCampaign,
  launchCampaign,
  previewAudienceAction,
} from "./actions";
import type { Campaign, Channel, Automation } from "@/lib/types";

/** Modelos prontos (Guia §11.2) — duplicados no client p/ evitar import server-only. */
const TEMPLATES: { id: string; label: string; message: string }[] = [
  {
    id: "vip",
    label: "Grupo VIP",
    message:
      "Você já conhece o nosso Grupo VIP? 🌷\n" +
      "Lá você encontra: acesso antecipado a lançamentos, condições e descontos exclusivos, conteúdos de bem-estar e aromaterapia e atendimento personalizado.\n" +
      "Entre e viva a experiência completa Essentiale: [link]\n" +
      "Com carinho, Equipe Essentiale 🤍",
  },
  {
    id: "lancamento",
    label: "Lançamento",
    message:
      "Oiiii! Passando pra contar uma novidade cheia de amor: a nova coleção da Essentiale chegou e está lindíssima! 🥰🌷\n" +
      "Feita com muito carinho para tocar o coração. Confira: [link]\n" +
      "Se quiser ajuda para escolher, estou por aqui!",
  },
  {
    id: "promocao",
    label: "Promoção",
    message:
      "✨ PROMOÇÃO ESSENTIALE ✨\n" +
      "Todos os refis estão em promoção 💛 (difusor, home spray e sabonete).\n" +
      "👉 Aproveita enquanto durar o estoque! 🔗 [link]",
  },
];

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Rascunho", cls: "bg-gray-100 text-gray-600" },
  scheduled: { label: "Agendada", cls: "bg-blue-100 text-blue-700" },
  running: { label: "Em execução", cls: "bg-green-100 text-green-700" },
  sending: { label: "Disparando", cls: "bg-green-100 text-green-700" },
  paused: { label: "Pausada", cls: "bg-amber-100 text-amber-700" },
  done: { label: "Concluída", cls: "bg-violet-100 text-violet-700" },
  failed: { label: "Falhou", cls: "bg-red-100 text-red-700" },
};

const STATUS_FILTERS = ["all", "draft", "scheduled", "sending", "done"] as const;

export interface SegmentOptions {
  cities: string[];
  tiposCliente: string[];
  statusFunil: string[];
  interesses: string[];
}

export function CampanhasClient({
  campaigns,
  channels,
  segmentOptions,
}: {
  campaigns: Campaign[];
  channels: Channel[];
  segmentOptions: SegmentOptions;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // ── estado do formulário de criação ──
  const [message, setMessage] = useState("");
  const [city, setCity] = useState("");
  const [tipoCliente, setTipoCliente] = useState("");
  const [statusFunil, setStatusFunil] = useState("");
  const [interesses, setInteresses] = useState<string[]>([]);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [previewing, startPreview] = useTransition();

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (query.trim() && !c.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [campaigns, statusFilter, query]);

  function resetForm() {
    setMessage("");
    setCity("");
    setTipoCliente("");
    setStatusFunil("");
    setInteresses([]);
    setAudienceCount(null);
  }

  function currentFilter() {
    return { city, tipo_cliente: tipoCliente, status_funil: statusFunil, interesses };
  }

  function preview() {
    startPreview(async () => {
      try {
        const n = await previewAudienceAction(currentFilter());
        setAudienceCount(n);
      } catch {
        setAudienceCount(null);
      }
    });
  }

  function toggleInteresse(i: string) {
    setInteresses((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
    setAudienceCount(null);
  }

  async function submit(fd: FormData) {
    setPending(true);
    try {
      // injeta o estado controlado no FormData
      fd.set("message", message);
      fd.set("city", city);
      fd.set("tipo_cliente", tipoCliente);
      fd.set("status_funil", statusFunil);
      fd.set("interesses", interesses.join(","));
      await createCampaign(fd);
      setOpen(false);
      resetForm();
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
    if (!confirm(`Disparar a campanha "${c.name}" para o público segmentado? Esta ação não pode ser desfeita.`)) return;
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

  return (
    <>
      {/* Aviso institucional: disparos proativos dependem de templates HSM aprovados. */}
      <div className="mt-2 flex items-start gap-2 rounded-card border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <p>
          Disparos em massa proativos (para quem não falou nas últimas 24h) dependem de
          <strong> templates HSM aprovados pela Meta</strong>, ainda não disponíveis. Contatos fora da janela de
          24h são marcados como <strong>&quot;aguardando template&quot;</strong> e não recebem a mensagem livre.
          Quem interagiu nas últimas 24h recebe normalmente. Só contatos com <strong>consentimento de marketing</strong> entram no público.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
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
        </div>
        <Button onClick={() => { resetForm(); setOpen(true); }}><Plus size={16} /> Criar Nova Campanha</Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-card border border-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-ink-soft">
              <th className="px-4 py-3 font-medium">Nome da Campanha</th>
              <th className="px-4 py-3 font-medium">Público</th>
              <th className="px-4 py-3 font-medium">Enviados</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Criada em</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-soft">Nenhuma campanha encontrada.</td></tr>
            )}
            {filtered.map((c) => {
              const s = STATUS[c.status] ?? STATUS.draft;
              const canLaunch = c.status === "draft" || c.status === "scheduled" || c.status === "failed";
              return (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{c.total_contacts || "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {c.sent_count || 0}
                    {c.failed_count ? <span className="text-danger"> · {c.failed_count} falhas</span> : null}
                  </td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>{s.label}</span></td>
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
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Nova campanha</h2>
              <button onClick={() => setOpen(false)} className="text-ink-soft hover:text-ink"><X size={18} /></button>
            </div>
            <form action={submit} className="space-y-4">
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

              {/* Modelos prontos */}
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Modelos prontos</label>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setMessage(t.message)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:border-brand hover:bg-brand-light"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Mensagem de disparo</label>
                <textarea
                  name="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  required
                  placeholder="Use {nome} para personalizar com o nome do contato."
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand"
                />
                <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-soft">
                  <Info size={12} /> Use <code className="rounded bg-gray-100 px-1">{"{nome}"}</code> para inserir o nome do contato. Troque <code className="rounded bg-gray-100 px-1">[link]</code> pelo seu link.
                </p>
              </div>

              {/* Segmentação */}
              <div className="rounded-lg border border-border p-3">
                <p className="mb-2 text-xs font-semibold text-ink">Segmentação do público</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-ink-soft">Cidade</label>
                    <select value={city} onChange={(e) => { setCity(e.target.value); setAudienceCount(null); }}
                      className="w-full rounded-lg border border-border px-2 py-1.5 text-sm outline-none focus:border-brand">
                      <option value="">Todas</option>
                      {segmentOptions.cities.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-ink-soft">Tipo de cliente</label>
                    <select value={tipoCliente} onChange={(e) => { setTipoCliente(e.target.value); setAudienceCount(null); }}
                      className="w-full rounded-lg border border-border px-2 py-1.5 text-sm outline-none focus:border-brand">
                      <option value="">Todos</option>
                      {segmentOptions.tiposCliente.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-ink-soft">Status do funil</label>
                    <select value={statusFunil} onChange={(e) => { setStatusFunil(e.target.value); setAudienceCount(null); }}
                      className="w-full rounded-lg border border-border px-2 py-1.5 text-sm outline-none focus:border-brand">
                      <option value="">Todos</option>
                      {segmentOptions.statusFunil.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {segmentOptions.interesses.length > 0 && (
                  <div className="mt-3">
                    <label className="mb-1 block text-[11px] font-medium text-ink-soft">Interesses (pelo menos um)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {segmentOptions.interesses.map((i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleInteresse(i)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                            interesses.includes(i)
                              ? "border-brand bg-brand text-white"
                              : "border-border text-ink-soft hover:border-brand"
                          }`}
                        >
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <Button type="button" variant="ghost" onClick={preview} disabled={previewing}>
                    <Users size={14} /> {previewing ? "Calculando..." : "Ver público"}
                  </Button>
                  {audienceCount !== null && (
                    <span className="text-xs text-ink-soft">
                      <strong className="text-ink">{audienceCount}</strong> contato(s) com consentimento atingido(s)
                    </span>
                  )}
                </div>
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
