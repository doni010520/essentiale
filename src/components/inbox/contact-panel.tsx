"use client";

import { useEffect, useState } from "react";
import { X, Users, Crown, Shield, Loader2, Save, Check, History, Hash, Receipt, QrCode, Unlock, Wrench, Plus, Printer, UserMinus } from "lucide-react";
import { formatPhone } from "@/lib/utils";
import {
  getContactDetails,
  updateContactDetails,
  getGroupInfo,
  getContactHistory,
  removeGroupParticipant,
  sgpAction,
  type ContactDetails,
  type GroupInfoResult,
} from "@/app/(app)/atendimento/actions";
import type { ConversationOverview } from "@/lib/types";

// Campos de CRM úteis para um provedor de internet (MVF NET).
const CRM_FIELDS: { key: string; label: string; type?: "text" | "select"; options?: string[] }[] = [
  { key: "cpfcnpj", label: "CPF / CNPJ" },
  { key: "contrato", label: "Nº do contrato (SGP)" },
  { key: "plano", label: "Plano contratado" },
  { key: "status_cliente", label: "Status do cliente", type: "select", options: ["", "Ativo", "Suspenso", "Bloqueado", "Cancelado", "Prospecto"] },
  { key: "email", label: "E-mail" },
  { key: "endereco", label: "Endereço" },
  { key: "cidade", label: "Cidade / UF" },
];

export function ContactPanel({
  conversation,
  onClose,
  onOpenContact,
}: {
  conversation: ConversationOverview;
  onClose: () => void;
  onOpenContact: (phone: string, name?: string) => void;
}) {
  const isGroup = !!conversation.is_group;
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<GroupInfoResult | null>(null);
  const [contact, setContact] = useState<ContactDetails | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<{ id: string; protocol: string | null; status: string; opened_at: string | null; closed_at: string | null }[]>([]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setSaved(false);
    (async () => {
      if (isGroup) {
        const g = await getGroupInfo(conversation.id);
        if (!cancel) setGroup(g);
      } else {
        const [c, h] = await Promise.all([
          getContactDetails(conversation.id),
          getContactHistory(conversation.id),
        ]);
        if (!cancel && c) {
          setContact(c);
          setName(c.name ?? "");
          setNotes(c.notes ?? "");
          const cf = (c.custom_fields ?? {}) as Record<string, unknown>;
          setFields(Object.fromEntries(CRM_FIELDS.map((f) => [f.key, String(cf[f.key] ?? "")])));
        }
        if (!cancel) setHistory(h ?? []);
      }
      if (!cancel) setLoading(false);
    })();
    return () => { cancel = true; };
  }, [conversation.id, isGroup]);

  async function save() {
    setSaving(true);
    try {
      await updateContactDetails(conversation.id, { name, notes, custom_fields: fields });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const title = conversation.contact_name ?? (isGroup ? "Grupo" : conversation.contact_phone);

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">{isGroup ? "Dados do grupo" : "Dados do contato"}</h2>
        <button onClick={onClose} className="text-ink-soft hover:text-ink"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Cabeçalho com avatar */}
        <div className="flex flex-col items-center gap-2 border-b border-border p-5 text-center">
          {conversation.contact_avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={conversation.contact_avatar} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className={`flex h-20 w-20 items-center justify-center rounded-full text-xl font-semibold ${isGroup ? "bg-brand-light text-brand" : "bg-gray-200 text-gray-600"}`}>
              {isGroup ? <Users size={28} /> : title.slice(0, 2).toUpperCase()}
            </div>
          )}
          <p className="text-base font-semibold text-ink">{title}</p>
          {!isGroup && <p className="text-xs text-ink-soft">{formatPhone(conversation.contact_phone)}</p>}
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-soft">
            <Loader2 size={16} className="animate-spin" /> Carregando...
          </div>
        )}

        {/* GRUPO: descrição + membros */}
        {!loading && isGroup && group && (
          <div className="p-4">
            {group.description && (
              <>
                <p className="mb-1 text-[11px] font-semibold uppercase text-ink-soft">Descrição</p>
                <p className="mb-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-ink-soft">{group.description}</p>
              </>
            )}
            <p className="mb-2 text-[11px] font-semibold uppercase text-ink-soft">{group.participants.length} participantes</p>
            <div className="space-y-1">
              {group.participants.map((p) => (
                <button
                  key={p.phone}
                  onClick={() => onOpenContact(p.phone, p.name ?? undefined)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-50"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
                    {(p.name ?? p.phone).slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{p.name ?? formatPhone(p.phone)}</span>
                    {p.name && <span className="block truncate text-xs text-ink-soft">{formatPhone(p.phone)}</span>}
                  </span>
                  {p.isOwner ? (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600"><Crown size={12} /> Dono</span>
                  ) : p.isAdmin ? (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-brand"><Shield size={12} /> Admin</span>
                  ) : (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Remover ${p.name ?? p.phone} do grupo?`)) return;
                        const r = await removeGroupParticipant(conversation.id, p.phone);
                        if (r.ok) {
                          setGroup((g) => g ? { ...g, participants: g.participants.filter((x) => x.phone !== p.phone) } : g);
                        } else {
                          alert(r.error ?? "Falha ao remover.");
                        }
                      }}
                      className="rounded p-1 text-ink-soft hover:bg-red-50 hover:text-danger"
                      title="Remover do grupo"
                    >
                      <UserMinus size={13} />
                    </button>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CONTATO: formulário CRM */}
        {!loading && !isGroup && contact && (
          <div className="space-y-3 p-4">
            <Field label="Nome">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </Field>
            {CRM_FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                {f.type === "select" ? (
                  <select value={fields[f.key] ?? ""} onChange={(e) => setFields((s) => ({ ...s, [f.key]: e.target.value }))} className={inputCls}>
                    {f.options!.map((o) => (
                      <option key={o} value={o}>{o || "—"}</option>
                    ))}
                  </select>
                ) : (
                  <input value={fields[f.key] ?? ""} onChange={(e) => setFields((s) => ({ ...s, [f.key]: e.target.value }))} className={inputCls} />
                )}
              </Field>
            ))}
            <Field label="Observações">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} />
            </Field>
            <button
              onClick={save}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
              {saved ? "Salvo!" : "Salvar"}
            </button>

            {/* Ações rápidas */}
            <div className="mt-3 flex gap-1.5">
              <button type="button" onClick={() => window.print()}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gray-50 py-2 text-xs font-medium text-ink transition hover:bg-gray-100">
                <Printer size={13} /> Imprimir
              </button>
              <button type="button" onClick={() => onOpenContact(contact.phone, contact.name ?? undefined)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gray-50 py-2 text-xs font-medium text-ink transition hover:bg-gray-100">
                <Plus size={13} /> Novo atendimento
              </button>
            </div>

            {/* Ações SGP (se contrato preenchido) */}
            {fields.contrato && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-2 text-[11px] font-semibold uppercase text-ink-soft">Ações SGP</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { action: "segunda_via", label: "2ª Via", icon: Receipt },
                    { action: "pix", label: "PIX", icon: QrCode },
                    { action: "liberacao", label: "Liberar", icon: Unlock },
                    { action: "status", label: "Status", icon: Wrench },
                  ] as const).map(({ action, label, icon: Icon }) => (
                    <button key={action} type="button"
                      onClick={async () => {
                        const r = await sgpAction(conversation.id, action, parseInt(fields.contrato, 10));
                        alert(typeof r === "string" ? r : JSON.stringify(r, null, 2));
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-gray-50 px-2 py-2 text-xs font-medium text-ink transition hover:bg-gray-100">
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Histórico de atendimentos anteriores */}
            {history.length > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase text-ink-soft">
                  <History size={12} /> Atendimentos anteriores
                </p>
                <div className="space-y-1.5">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs">
                      {h.protocol && (
                        <span className="inline-flex items-center gap-0.5 font-mono text-ink-soft">
                          <Hash size={9} />{h.protocol}
                        </span>
                      )}
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        h.status === "closed" ? "bg-gray-100 text-ink-soft" : "bg-green-100 text-green-700"
                      }`}>
                        {h.status === "closed" ? "Encerrado" : "Aberto"}
                      </span>
                      <span className="ml-auto text-ink-soft">
                        {h.opened_at ? (() => { const d = new Date(h.opened_at); return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; })() : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

const inputCls =
  "w-full rounded-lg border border-border px-2.5 py-1.5 text-sm outline-none focus:border-brand";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
