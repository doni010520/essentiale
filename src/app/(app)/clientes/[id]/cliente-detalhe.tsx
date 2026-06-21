"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, ChevronDown, MessageSquare,
  Wallet, ShoppingBag, Receipt, CalendarDays, ShieldCheck,
} from "lucide-react";
import { cn, formatPhone } from "@/lib/utils";
import { PageHeader, Card, StatCard, Button } from "@/components/ui";
import { FUNNEL_STAGES, stageOf, type CrmContact } from "../types";
import { updateContact } from "../actions";

// ── Tipos locais (subset vindo do server component) ───────────────────────────

type Contato = Pick<
  CrmContact,
  | "id" | "name" | "phone" | "email" | "city" | "cpf" | "address"
  | "data_aniversario" | "tipo_cliente" | "status_funil"
  | "consentimento_marketing" | "interesses" | "origem_lead"
  | "notes" | "avatar_url" | "created_at"
>;

interface PedidoItem {
  id: string;
  nome: string | null;
  quantidade: number | null;
  subtotal_centavos: number | null;
}

interface Pedido {
  id: string;
  status: string | null;
  total_centavos: number | null;
  created_at: string;
  order_items: PedidoItem[] | null;
}

interface ConsentEntry {
  id: string;
  tipo: string | null;
  canal: string | null;
  created_at: string;
}

interface Props {
  contato: Contato;
  pedidos: Pedido[];
  consentLog: ConsentEntry[];
}

// ── Helpers de formatação ─────────────────────────────────────────────────────

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const money = (centavos: number | null | undefined) => brl.format((centavos ?? 0) / 100);

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR") : "—";

/** Converte o campo `interesses` (jsonb/array/texto) em string editável. */
function interessesToText(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "string") return v;
  return String(v);
}

// ── Campos de formulário (espelho do produto-modal) ───────────────────────────

const inputCls = "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-gray-400 focus:border-brand focus:ring-1 focus:ring-brand/20";
const textareaCls = `${inputCls} resize-none`;

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-ink-soft">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-gray-100 text-gray-600" },
  aguardando_pagamento: { label: "Aguardando pgto", cls: "bg-amber-100 text-amber-700" },
  pago: { label: "Pago", cls: "bg-success-bg text-green-700" },
  enviado: { label: "Enviado", cls: "bg-blue-100 text-blue-700" },
  entregue: { label: "Entregue", cls: "bg-success-bg text-green-700" },
  cancelado: { label: "Cancelado", cls: "bg-red-100 text-red-700" },
};

function OrderStatusBadge({ status }: { status: string | null }) {
  const s = ORDER_STATUS[(status ?? "").toLowerCase()] ?? { label: status ?? "—", cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", s.cls)}>
      {s.label}
    </span>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function ClienteDetalhe({ contato, pedidos, consentLog }: Props) {
  const stage = FUNNEL_STAGES.find((s) => s.key === stageOf(contato.status_funil)) ?? FUNNEL_STAGES[0];

  // Resumo / LTV.
  const ltv = pedidos.reduce((acc, p) => acc + (p.total_centavos ?? 0), 0);
  const numPedidos = pedidos.length;
  const ticketMedio = numPedidos > 0 ? ltv / numPedidos : 0;
  // `pedidos` vem ordenado por created_at desc → primeiro=mais recente, último=mais antigo.
  const ultimaCompra = numPedidos > 0 ? pedidos[0].created_at : null;
  const primeiraCompra = numPedidos > 0 ? pedidos[numPedidos - 1].created_at : null;

  // Formulário "Dados do cliente".
  const [form, setForm] = useState({
    email: contato.email ?? "",
    cpf: contato.cpf ?? "",
    address: contato.address ?? "",
    city: contato.city ?? "",
    data_aniversario: contato.data_aniversario ?? "",
    origem_lead: contato.origem_lead ?? "",
    interesses: interessesToText(contato.interesses),
    tipo_cliente: contato.tipo_cliente ?? "consumidor",
    status_funil: stageOf(contato.status_funil) as string,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [saving, startSave] = useTransition();
  const [savedMsg, setSavedMsg] = useState("");
  const [savedErr, setSavedErr] = useState("");

  const salvarDados = () => {
    setSavedMsg("");
    setSavedErr("");
    startSave(async () => {
      const r = await updateContact(contato.id, {
        email: form.email,
        cpf: form.cpf,
        address: form.address,
        city: form.city,
        data_aniversario: form.data_aniversario,
        origem_lead: form.origem_lead,
        interesses: form.interesses,
        tipo_cliente: form.tipo_cliente,
        status_funil: form.status_funil,
      });
      if (r.ok) setSavedMsg("Dados salvos.");
      else setSavedErr(r.error ?? "Erro ao salvar.");
    });
  };

  // LGPD / consentimento (estado otimista).
  const [consent, setConsent] = useState<boolean>(!!contato.consentimento_marketing);
  const [consentPending, startConsent] = useTransition();
  const toggleConsent = () => {
    const next = !consent;
    startConsent(async () => {
      const r = await updateContact(contato.id, { consentimento_marketing: next });
      if (r.ok) setConsent(next);
    });
  };

  // Notas internas.
  const [notes, setNotes] = useState(contato.notes ?? "");
  const [notesSaving, startNotes] = useTransition();
  const [notesMsg, setNotesMsg] = useState("");
  const salvarNotas = () => {
    setNotesMsg("");
    startNotes(async () => {
      const r = await updateContact(contato.id, { notes });
      setNotesMsg(r.ok ? "Notas salvas." : (r.error ?? "Erro ao salvar."));
    });
  };

  const avatarInitials = (contato.name ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="h-full overflow-y-auto px-4 pb-12 sm:px-6">
      {/* Cabeçalho */}
      <div className="pt-5">
        <Link
          href="/clientes"
          className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition hover:text-brand"
        >
          <ArrowLeft size={15} /> Voltar para clientes
        </Link>
      </div>

      <PageHeader
        title={contato.name ?? "Sem nome"}
        subtitle={formatPhone(contato.phone) || "Sem telefone"}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", `${stage.head} bg-gray-50 border border-border`)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", stage.dot)} />
              {stage.label}
            </span>
            <span className="inline-flex items-center rounded-full bg-brand-light px-3 py-1 text-xs font-medium text-brand">
              {contato.tipo_cliente === "lojista" ? "Lojista" : "Consumidor"}
            </span>
          </div>
        }
      />

      {/* Resumo (cards) */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total gasto (LTV)" value={money(ltv)} icon={<Wallet size={18} />} />
        <StatCard label="Pedidos" value={numPedidos} icon={<ShoppingBag size={18} />} accent="bg-violet-100 text-violet-700" />
        <StatCard label="Ticket médio" value={money(ticketMedio)} icon={<Receipt size={18} />} accent="bg-amber-100 text-amber-700" />
        <StatCard
          label="1ª / última compra"
          value={<span className="text-base">{fmtDate(primeiraCompra)} · {fmtDate(ultimaCompra)}</span>}
          icon={<CalendarDays size={18} />}
          accent="bg-blue-100 text-blue-700"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Coluna principal */}
        <div className="space-y-6 lg:col-span-2">
          {/* Dados do cliente (editável) */}
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Dados do cliente</h2>
              <div className="flex items-center gap-3">
                {savedMsg && <span className="text-xs text-brand">{savedMsg}</span>}
                {savedErr && <span className="text-xs text-red-600">{savedErr}</span>}
                <Button onClick={salvarDados} disabled={saving}>
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Salvar
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="E-mail">
                <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} placeholder="cliente@email.com" />
              </Field>
              <Field label="CPF">
                <input value={form.cpf} onChange={(e) => set("cpf", e.target.value)} className={inputCls} placeholder="000.000.000-00" />
              </Field>
              <Field label="Endereço">
                <input value={form.address} onChange={(e) => set("address", e.target.value)} className={inputCls} placeholder="Rua, número, bairro" />
              </Field>
              <Field label="Cidade">
                <input value={form.city} onChange={(e) => set("city", e.target.value)} className={inputCls} placeholder="Cidade / UF" />
              </Field>
              <Field label="Data de aniversário">
                <input type="date" value={form.data_aniversario ?? ""} onChange={(e) => set("data_aniversario", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Origem do lead">
                <input value={form.origem_lead} onChange={(e) => set("origem_lead", e.target.value)} className={inputCls} placeholder="Instagram, indicação..." />
              </Field>

              <Field label="Tipo de cliente">
                <div className="relative">
                  <select value={form.tipo_cliente} onChange={(e) => set("tipo_cliente", e.target.value)} className={cn(inputCls, "appearance-none pr-8")}>
                    <option value="consumidor">Consumidor</option>
                    <option value="lojista">Lojista</option>
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                </div>
              </Field>
              <Field label="Etapa do funil">
                <div className="relative">
                  <select value={form.status_funil} onChange={(e) => set("status_funil", e.target.value)} className={cn(inputCls, "appearance-none pr-8")}>
                    {FUNNEL_STAGES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                </div>
              </Field>

              <div className="sm:col-span-2">
                <Field label="Interesses" hint="Texto livre — perfumes, fragrâncias e produtos preferidos">
                  <textarea value={form.interesses} onChange={(e) => set("interesses", e.target.value)} rows={2} className={textareaCls} placeholder="Ex: Felicità, difusores, velas aromáticas..." />
                </Field>
              </div>
            </div>
          </Card>

          {/* Histórico de pedidos */}
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-ink">Histórico de pedidos</h2>
            {pedidos.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-soft">Nenhum pedido registrado.</p>
            ) : (
              <ul className="space-y-3">
                {pedidos.map((p) => (
                  <li key={p.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-ink-soft">{fmtDateTime(p.created_at)}</p>
                        <ul className="mt-1.5 space-y-0.5 text-sm text-ink">
                          {(p.order_items ?? []).map((it) => (
                            <li key={it.id}>
                              <span className="font-medium">{it.nome ?? "Item"}</span>
                              <span className="text-ink-soft"> × {it.quantidade ?? 1}</span>
                              <span className="text-ink-soft"> — {money(it.subtotal_centavos)}</span>
                            </li>
                          ))}
                          {(p.order_items ?? []).length === 0 && (
                            <li className="text-ink-soft">Sem itens registrados.</li>
                          )}
                        </ul>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="tnum text-sm font-semibold text-ink">{money(p.total_centavos)}</span>
                        <OrderStatusBadge status={p.status} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-6">
          {/* LGPD / Consentimento */}
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={16} className="text-brand" />
              <h2 className="text-sm font-semibold text-ink">LGPD / Consentimento</h2>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-gray-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink">Marketing</p>
                <p className="text-xs text-ink-soft">{consent ? "Sim — autorizado" : "Não — sem consentimento"}</p>
              </div>
              <button
                type="button"
                onClick={toggleConsent}
                disabled={consentPending}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
                  consent ? "bg-brand" : "bg-gray-300",
                )}
                aria-label="Alternar consentimento de marketing"
              >
                <span className={cn("inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform", consent ? "translate-x-4" : "translate-x-0.5")} />
              </button>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-ink-soft">Histórico de consentimento</p>
              {consentLog.length === 0 ? (
                <p className="text-xs text-gray-400">Nenhum registro.</p>
              ) : (
                <ul className="space-y-2">
                  {consentLog.map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink">
                        {c.tipo === "opt_in" ? "Opt-in" : c.tipo === "opt_out" ? "Opt-out" : (c.tipo ?? "—")}
                        {c.canal && <span className="text-ink-soft"> · {c.canal}</span>}
                      </span>
                      <span className="text-ink-soft">{fmtDateTime(c.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {/* Notas internas */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Notas internas</h2>
              {notesMsg && <span className="text-xs text-brand">{notesMsg}</span>}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              className={textareaCls}
              placeholder="Anotações sobre o cliente (visível só para a equipe)..."
            />
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" onClick={salvarNotas} disabled={notesSaving}>
                {notesSaving && <Loader2 size={14} className="animate-spin" />}
                Salvar notas
              </Button>
            </div>
          </Card>

          {/* Ver conversas */}
          <Link
            href="/atendimento"
            className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition hover:text-brand"
          >
            <MessageSquare size={14} /> Ver conversas
          </Link>
        </div>
      </div>
    </div>
  );
}
