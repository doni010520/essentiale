"use client";

import { Fragment, useMemo, useState } from "react";
import { Search } from "lucide-react";

export interface AuditLogRow {
  id: string;
  action: string;
  entity: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

const PAGE_SIZE = 50;

export function AuditClient({ logs }: { logs: AuditLogRow[] }) {
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const entities = useMemo(
    () => [...new Set(logs.map((l) => l.entity).filter(Boolean))] as string[],
    [logs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (entity !== "all" && l.entity !== entity) return false;
      if (q && !l.action.toLowerCase().includes(q) && !(l.entity ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, query, entity]);

  const shown = filtered.slice(0, limit);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setLimit(PAGE_SIZE); }}
            placeholder="Buscar ação..."
            className="w-56 rounded-lg border border-border py-1.5 pl-8 pr-3 text-sm outline-none focus:border-brand"
          />
        </div>
        <select value={entity} onChange={(e) => { setEntity(e.target.value); setLimit(PAGE_SIZE); }}
          className="rounded-lg border border-border px-2 py-1.5 text-sm outline-none focus:border-brand">
          <option value="all">Todas as entidades</option>
          {entities.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <span className="text-xs text-ink-soft">{filtered.length} registro(s)</span>
      </div>

      <div className="overflow-hidden rounded-card bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-ink-soft">
              <th className="px-4 py-3 font-medium">Ação</th>
              <th className="px-4 py-3 font-medium">Entidade</th>
              <th className="px-4 py-3 font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-10 text-center text-ink-soft">Nenhum registro de auditoria.</td></tr>
            )}
            {shown.map((l) => {
              const hasMeta = l.metadata && Object.keys(l.metadata).length > 0;
              return (
                <Fragment key={l.id}>
                  <tr
                    onClick={() => hasMeta && setExpanded(expanded === l.id ? null : l.id)}
                    className={`border-b border-border last:border-0 ${hasMeta ? "cursor-pointer hover:bg-gray-50" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-ink">{l.action}</td>
                    <td className="px-4 py-3 text-ink-soft">{l.entity ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                  </tr>
                  {expanded === l.id && hasMeta && (
                    <tr className="border-b border-border bg-gray-50/50">
                      <td colSpan={3} className="px-4 py-3">
                        <pre className="overflow-x-auto whitespace-pre-wrap text-[11px] text-ink-soft">
                          {JSON.stringify(l.metadata, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > limit && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setLimit((n) => n + PAGE_SIZE)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-soft hover:bg-gray-50"
          >
            Carregar mais
          </button>
        </div>
      )}
    </>
  );
}
