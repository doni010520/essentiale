"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatPhone } from "@/lib/utils";
import { FUNNEL_STAGES, stageOf, type CrmContact, type FunnelStage } from "./types";
import { moveFunnelStage } from "./actions";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const DRAG_KEY = "text/contact-id";
const FROM_KEY = "text/from-stage";

export function FunnelKanban({ contacts }: { contacts: CrmContact[] }) {
  const router = useRouter();
  // Estado otimista: mapa de overrides id -> etapa (move o card na hora).
  const [overrides, setOverrides] = useState<Record<string, FunnelStage>>({});
  const [dragOver, setDragOver] = useState<FunnelStage | null>(null);

  const stageFor = (c: CrmContact): FunnelStage =>
    overrides[c.id] ?? stageOf(c.status_funil);

  const byStage = useMemo(() => {
    const map = {} as Record<FunnelStage, CrmContact[]>;
    for (const s of FUNNEL_STAGES) map[s.key] = [];
    for (const c of contacts) map[stageFor(c)].push(c);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, overrides]);

  async function move(id: string, from: FunnelStage, to: FunnelStage) {
    if (from === to) return;
    setOverrides((o) => ({ ...o, [id]: to }));
    try {
      await moveFunnelStage(id, to);
    } catch {
      // reverte em caso de erro
      setOverrides((o) => ({ ...o, [id]: from }));
    }
    router.refresh();
  }

  return (
    <div className="flex h-full gap-4 overflow-x-auto p-4">
      {FUNNEL_STAGES.map((col) => {
        const items = byStage[col.key];
        return (
          <div
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(col.key);
            }}
            onDragLeave={() => setDragOver((s) => (s === col.key ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const id = e.dataTransfer.getData(DRAG_KEY);
              const from = e.dataTransfer.getData(FROM_KEY) as FunnelStage;
              if (id) void move(id, from, col.key);
            }}
            className={cn(
              "flex w-[280px] shrink-0 flex-col rounded-card bg-canvas/60 transition",
              dragOver === col.key && "ring-2 ring-brand ring-offset-1",
            )}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                <h3 className={cn("text-sm font-semibold", col.head)}>{col.label}</h3>
              </div>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink-soft">
                {items.length}
              </span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {items.length === 0 ? (
                <p className="pt-6 text-center text-xs text-ink-soft">
                  Nenhum cliente nesta etapa
                </p>
              ) : (
                items.map((c) => (
                  <ContactCard key={c.id} contact={c} stage={col.key} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ContactCard({ contact: c, stage }: { contact: CrmContact; stage: FunnelStage }) {
  // Bloqueia a navegação acidental quando o card é arrastado.
  const [dragging, setDragging] = useState(false);

  return (
    <Link
      href={`/clientes/${c.id}`}
      draggable
      onDragStart={(e) => {
        setDragging(true);
        e.dataTransfer.setData(DRAG_KEY, c.id);
        e.dataTransfer.setData(FROM_KEY, stage);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => setDragging(false)}
      onClick={(e) => {
        if (dragging) e.preventDefault();
      }}
      className={cn(
        "block rounded-lg border border-border bg-surface p-3 text-left shadow-card transition",
        "hover:-translate-y-0.5 hover:shadow-pop cursor-grab active:cursor-grabbing",
      )}
    >
      <p className="truncate text-sm font-semibold text-ink">{c.name || "Sem nome"}</p>
      <p className="truncate text-[11px] text-ink-soft">{formatPhone(c.phone)}</p>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-brand">{brl.format((c.total_centavos ?? 0) / 100)}</span>
        <span className="text-ink-soft">
          {c.pedidos_count ?? 0} {c.pedidos_count === 1 ? "pedido" : "pedidos"}
        </span>
      </div>
    </Link>
  );
}
