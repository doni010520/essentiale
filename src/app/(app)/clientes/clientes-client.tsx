"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search, LayoutList, KanbanSquare, Download, Users, UserPlus,
  Repeat, Cake, MailCheck,
} from "lucide-react";
import { cn, formatPhone } from "@/lib/utils";
import { StatCard, EmptyState } from "@/components/ui";
import { FunnelKanban } from "./funnel-kanban";
import { FUNNEL_STAGES, stageOf, type CrmContact, type FunnelStage } from "./types";
import type { ClientesIndicadores } from "./page";

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function brl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/** Mês (1-12) do aniversário a partir do DATE YYYY-MM-DD (sem fuso). */
function aniversarioMes(d: string | null | undefined): number | null {
  if (!d) return null;
  const parts = d.split("-");
  if (parts.length < 2) return null;
  const m = Number(parts[1]);
  return Number.isFinite(m) ? m : null;
}

function formatAniversario(d: string | null | undefined): string {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length < 3) return "—";
  const dia = Number(parts[2]);
  const mes = Number(parts[1]);
  if (!Number.isFinite(dia) || !Number.isFinite(mes) || mes < 1 || mes > 12) return "—";
  return `${String(dia).padStart(2, "0")} ${MESES[mes - 1]}`;
}

function StageBadge({ stage }: { stage: FunnelStage }) {
  const meta = FUNNEL_STAGES.find((s) => s.key === stage) ?? FUNNEL_STAGES[0];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-ink-soft">
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

function Avatar({ contact }: { contact: CrmContact }) {
  if (contact.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={contact.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-600">
      {(contact.name ?? "?").slice(0, 2).toUpperCase()}
    </div>
  );
}

export function ClientesClient({
  contacts,
  indicadores,
}: {
  contacts: CrmContact[];
  indicadores: ClientesIndicadores;
}) {
  const [view, setView] = useState<"lista" | "funil">("lista");
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("Todos");
  const [cidade, setCidade] = useState("Todas");
  const [etapa, setEtapa] = useState<"todas" | FunnelStage>("todas");
  const [soOptIn, setSoOptIn] = useState(false);
  const [soAniversariantes, setSoAniversariantes] = useState(false);
  const [comPedido, setComPedido] = useState(false);

  const mesAtual = new Date().getMonth() + 1; // 1-12

  // Opções distintas de tipo e cidade.
  const tipos = useMemo(() => {
    const set = new Set<string>();
    for (const c of contacts) if (c.tipo_cliente) set.add(c.tipo_cliente);
    return ["Todos", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [contacts]);

  const cidades = useMemo(() => {
    const set = new Set<string>();
    for (const c of contacts) if (c.city) set.add(c.city);
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (tipo !== "Todos" && c.tipo_cliente !== tipo) return false;
      if (cidade !== "Todas" && c.city !== cidade) return false;
      if (etapa !== "todas" && stageOf(c.status_funil) !== etapa) return false;
      if (soOptIn && !c.consentimento_marketing) return false;
      if (soAniversariantes && aniversarioMes(c.data_aniversario) !== mesAtual) return false;
      if (comPedido && c.pedidos_count <= 0) return false;
      if (q) {
        const hay = `${c.name ?? ""} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [contacts, search, tipo, cidade, etapa, soOptIn, soAniversariantes, comPedido, mesAtual]);

  return (
    <>
      {/* Indicadores */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Clientes" value={indicadores.total} icon={<Users size={18} />} />
        <StatCard
          label="Novos no mês"
          value={indicadores.novosNoMes}
          icon={<UserPlus size={18} />}
          accent="bg-amber-100 text-amber-700"
        />
        <StatCard
          label="Recorrentes"
          value={indicadores.recorrentes}
          icon={<Repeat size={18} />}
          accent="bg-violet-100 text-violet-700"
        />
        <StatCard
          label="Aniversariantes"
          value={indicadores.aniversariantes}
          icon={<Cake size={18} />}
          accent="bg-pink-100 text-pink-700"
        />
        <StatCard
          label="Opt-in marketing"
          value={`${indicadores.optInPct}%`}
          icon={<MailCheck size={18} />}
          accent="bg-sky-100 text-sky-700"
        />
      </div>

      {/* Toggle Lista | Funil + Exportar */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-border bg-white p-1">
          <button
            type="button"
            onClick={() => setView("lista")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition",
              view === "lista" ? "bg-brand text-white" : "text-ink-soft hover:text-ink",
            )}
          >
            <LayoutList size={14} /> Lista
          </button>
          <button
            type="button"
            onClick={() => setView("funil")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition",
              view === "funil" ? "bg-brand text-white" : "text-ink-soft hover:text-ink",
            )}
          >
            <KanbanSquare size={14} /> Funil
          </button>
        </div>

        <Link
          href="/api/export-contacts"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink transition hover:border-brand hover:text-brand"
        >
          <Download size={14} /> Exportar CSV
        </Link>
      </div>

      {/* Filtros */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, telefone ou e-mail..."
              className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-3 text-sm outline-none focus:border-brand"
            />
          </div>

          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          >
            {tipos.map((t) => (
              <option key={t} value={t}>{t === "Todos" ? "Tipo: todos" : t}</option>
            ))}
          </select>

          <select
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          >
            {cidades.map((c) => (
              <option key={c} value={c}>{c === "Todas" ? "Cidade: todas" : c}</option>
            ))}
          </select>

          <select
            value={etapa}
            onChange={(e) => setEtapa(e.target.value as "todas" | FunnelStage)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          >
            <option value="todas">Etapa: todas</option>
            {FUNNEL_STAGES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={soOptIn}
              onChange={(e) => setSoOptIn(e.target.checked)}
              className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
            />
            Só opt-in
          </label>
          <label className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={soAniversariantes}
              onChange={(e) => setSoAniversariantes(e.target.checked)}
              className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
            />
            Aniversariantes do mês
          </label>
          <label className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={comPedido}
              onChange={(e) => setComPedido(e.target.checked)}
              className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
            />
            Com pedido
          </label>
        </div>
      </div>

      {/* Conteúdo */}
      {view === "funil" ? (
        <FunnelKanban contacts={filtered} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum cliente encontrado"
          hint={search ? "Tente outra busca ou ajuste os filtros." : "Ajuste os filtros para ver contatos."}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50 text-left text-xs font-medium text-ink-soft">
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Cidade</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Etapa</th>
                  <th className="px-4 py-3">Opt-in</th>
                  <th className="px-4 py-3 text-right">Pedidos</th>
                  <th className="px-4 py-3 text-right">Total gasto</th>
                  <th className="px-4 py-3">Aniversário</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border transition hover:bg-gray-50/70">
                    <td className="px-4 py-3">
                      <Link href={`/clientes/${c.id}`} className="flex items-center gap-2 group">
                        <Avatar contact={c} />
                        <span className="font-medium text-ink group-hover:text-brand">
                          {c.name ?? "—"}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{formatPhone(c.phone) || "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{c.city ?? "—"}</td>
                    <td className="px-4 py-3">
                      {c.tipo_cliente ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-ink-soft">
                          {c.tipo_cliente}
                        </span>
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><StageBadge stage={stageOf(c.status_funil)} /></td>
                    <td className="px-4 py-3">
                      {c.consentimento_marketing ? (
                        <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-green-700">
                          Sim
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          Não
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tnum text-ink">{c.pedidos_count}</td>
                    <td className="px-4 py-3 text-right tnum font-semibold text-ink">
                      {c.total_centavos > 0 ? brl(c.total_centavos) : "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{formatAniversario(c.data_aniversario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-soft">
            {filtered.length} cliente{filtered.length !== 1 ? "s" : ""} exibido
            {filtered.length !== 1 ? "s" : ""} de {contacts.length}
          </p>
        </>
      )}
    </>
  );
}
