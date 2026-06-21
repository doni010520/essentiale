"use client";

import { useState, useTransition, type TransitionStartFunction } from "react";
import { cn } from "@/lib/utils";
import { Package, Search, ChevronDown, ChevronUp, ExternalLink, Copy } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { updateOrderStatusAction } from "./actions";

interface OrderItem {
  id: string;
  nome: string;
  fragrancia: string | null;
  quantidade: number;
  preco_unitario_centavos: number;
  subtotal_centavos: number;
  personalizacao: string | null;
}

interface Order {
  id: string;
  nome_completo: string | null;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cep: string | null;
  tipo_entrega: string;
  quem_recebe: string | null;
  subtotal_centavos: number;
  frete_centavos: number;
  desconto_centavos: number;
  total_centavos: number;
  payment_method: string;
  payment_status: string;
  checkout_url: string | null;
  pix_code: string | null;
  status: string;
  tracking_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  order_items: OrderItem[];
}

const STATUS_OPTIONS = ["novo", "confirmado", "embalado", "saiu", "entregue", "cancelado"];

const STATUS_COLORS: Record<string, string> = {
  novo: "bg-blue-100 text-blue-700",
  confirmado: "bg-amber-100 text-amber-700",
  embalado: "bg-purple-100 text-purple-700",
  saiu: "bg-orange-100 text-orange-700",
  entregue: "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-700",
};

const PAY_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-500",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-600",
};

function price(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/** Detalhes expandidos compartilhados entre tabela (desktop) e card (mobile). */
function OrderDetails({
  order,
  pending,
  startTransition,
}: {
  order: Order;
  pending: boolean;
  startTransition: TransitionStartFunction;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Itens */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Itens</p>
        <div className="space-y-1">
          {order.order_items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-ink">
                {item.quantidade}× {item.nome}
                {item.fragrancia && <span className="ml-1 text-xs text-ink-soft">({item.fragrancia})</span>}
                {item.personalizacao && <span className="ml-1 text-xs text-purple-600">✦ {item.personalizacao}</span>}
              </span>
              <span className="text-ink-soft">{price(item.subtotal_centavos)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 border-t border-border pt-2 text-xs text-ink-soft space-y-0.5">
          <div className="flex justify-between"><span>Subtotal</span><span>{price(order.subtotal_centavos)}</span></div>
          {order.frete_centavos > 0 && <div className="flex justify-between"><span>Frete</span><span>{price(order.frete_centavos)}</span></div>}
          {order.desconto_centavos > 0 && <div className="flex justify-between text-green-600"><span>Desconto</span><span>−{price(order.desconto_centavos)}</span></div>}
          <div className="flex justify-between font-semibold text-ink"><span>Total</span><span>{price(order.total_centavos)}</span></div>
        </div>
      </div>

      {/* Dados do cliente / entrega */}
      <div className="space-y-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">Entrega</p>
          <p className="text-sm text-ink capitalize">{order.tipo_entrega === "retirada" ? "Retirada" : "Entrega"}</p>
          {order.endereco && <p className="text-xs text-ink-soft">{order.endereco} · CEP {order.cep}</p>}
        </div>

        {/* Pix code */}
        {order.pix_code && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">Pix</p>
            <div className="flex items-center gap-2">
              <code className="truncate rounded bg-gray-100 px-2 py-0.5 text-xs text-ink">{order.pix_code.slice(0, 40)}…</code>
              <button
                onClick={() => navigator.clipboard.writeText(order.pix_code!)}
                className="text-ink-soft hover:text-brand"
              >
                <Copy size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Status update */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">Alterar status</p>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                disabled={pending || s === order.status}
                onClick={(e) => {
                  e.stopPropagation();
                  startTransition(() => updateOrderStatusAction(order.id, s));
                }}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium capitalize transition",
                  s === order.status
                    ? (STATUS_COLORS[s] ?? "bg-gray-200 text-gray-600")
                    : "bg-gray-100 text-ink-soft hover:bg-gray-200",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {order.tracking_code && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">Rastreio</p>
            <p className="text-sm font-mono text-ink">{order.tracking_code}</p>
          </div>
        )}
        {order.notes && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">Obs</p>
            <p className="text-xs text-ink-soft">{order.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Linha da tabela (somente desktop, md+). */
function OrderRow({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <tr
        className="cursor-pointer border-b border-border hover:bg-gray-50/50"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {open ? <ChevronUp size={14} className="text-ink-soft" /> : <ChevronDown size={14} className="text-ink-soft" />}
            <div>
              <p className="font-medium text-ink">{order.nome_completo ?? "—"}</p>
              <p className="text-xs text-ink-soft">{order.telefone ?? ""}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-ink-soft">
          {new Date(order.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </td>
        <td className="px-4 py-3">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-500")}>
            {order.status}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PAY_COLORS[order.payment_status] ?? "bg-gray-100 text-gray-500")}>
            {order.payment_method === "pix" ? "Pix" : "Cartão"} · {order.payment_status === "paid" ? "Pago" : order.payment_status === "pending" ? "Aguardando" : "Falhou"}
          </span>
        </td>
        <td className="px-4 py-3 text-right font-semibold text-ink">{price(order.total_centavos)}</td>
      </tr>
      {open && (
        <tr className="border-b border-border bg-gray-50/40">
          <td colSpan={5} className="px-6 py-4">
            <OrderDetails order={order} pending={pending} startTransition={startTransition} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Card empilhado (somente mobile, <md). */
function OrderCard({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-card border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 px-4 py-3 text-left"
      >
        {open ? <ChevronUp size={16} className="mt-0.5 shrink-0 text-ink-soft" /> : <ChevronDown size={16} className="mt-0.5 shrink-0 text-ink-soft" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{order.nome_completo ?? "—"}</p>
              <p className="truncate text-xs text-ink-soft">{order.telefone ?? ""}</p>
            </div>
            <p className="shrink-0 font-semibold text-ink">{price(order.total_centavos)}</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-500")}>
              {order.status}
            </span>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PAY_COLORS[order.payment_status] ?? "bg-gray-100 text-gray-500")}>
              {order.payment_method === "pix" ? "Pix" : "Cartão"} · {order.payment_status === "paid" ? "Pago" : order.payment_status === "pending" ? "Aguardando" : "Falhou"}
            </span>
            <span className="text-xs text-ink-soft">
              {new Date(order.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-border bg-gray-50/40 px-4 py-3">
          <OrderDetails order={order} pending={pending} startTransition={startTransition} />
        </div>
      )}
    </div>
  );
}

export function PedidosClient({ orders }: { orders: Order[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  const filtered = orders.filter((o) => {
    if (statusFilter !== "todos" && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (o.nome_completo ?? "").toLowerCase().includes(q) ||
        (o.telefone ?? "").includes(q) ||
        (o.email ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <div className="relative w-full md:flex-1 md:min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail..."
            className="w-full rounded-lg border border-border bg-surface pl-8 pr-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
          {["todos", ...STATUS_OPTIONS].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize transition",
                statusFilter === s ? "bg-brand text-white" : "bg-gray-100 text-ink-soft hover:bg-gray-200",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nenhum pedido encontrado" hint="Os pedidos criados pela Caroline aparecerão aqui." />
      ) : (
        <>
          {/* Mobile: cards empilhados */}
          <div className="space-y-3 md:hidden">
            {filtered.map((o) => <OrderCard key={o.id} order={o} />)}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden overflow-x-auto rounded-card border border-border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50 text-left text-xs font-medium text-ink-soft">
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Pagamento</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => <OrderRow key={o.id} order={o} />)}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
