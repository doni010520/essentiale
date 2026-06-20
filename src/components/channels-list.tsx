"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Power, Trash2, Plug, Search, Pencil, X, Loader2, AlertTriangle } from "lucide-react";
import { ChannelCard } from "@/components/channel-card";
import { QrConnectModal } from "@/components/qr-connect-modal";
import { disconnectChannel, deleteChannel, syncChannelStatus, updateChannel } from "@/app/(app)/canais/actions";
import type { Channel } from "@/lib/types";

const inputCls =
  "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-gray-400 focus:border-brand focus:ring-1 focus:ring-brand/20";

export function ChannelsList({ channels }: { channels: Channel[] }) {
  const router = useRouter();
  const [connect, setConnect] = useState<{ id: string; phone?: string } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Channel | null>(null);
  const [editTarget, setEditTarget] = useState<Channel | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q));
  }, [channels, query]);

  // Ao abrir, sincroniza o status real de cada canal não-Meta (a UAZAPI é a fonte
  // da verdade). Se algo mudou no banco, atualiza a tela.
  useEffect(() => {
    let cancel = false;
    (async () => {
      const targets = channels.filter((c) => c.type !== "meta_cloud");
      const results = await Promise.all(
        targets.map((c) =>
          syncChannelStatus(c.id)
            .then((r) => r.status !== c.status)
            .catch(() => false),
        ),
      );
      if (!cancel && results.some(Boolean)) router.refresh();
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels.map((c) => `${c.id}:${c.status}`).join(",")]);

  async function onDisconnect(id: string) {
    setMenu(null);
    setBusy(id);
    try { await disconnectChannel(id); router.refresh(); } finally { setBusy(null); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const c = deleteTarget;
    setBusy(c.id);
    try { await deleteChannel(c.id); setDeleteTarget(null); router.refresh(); } finally { setBusy(null); }
  }

  return (
    <>
      {channels.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar canal por nome ou telefone..."
            className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm outline-none focus:border-brand"
          />
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.length === 0 && (
          <p className="col-span-full py-6 text-center text-sm text-ink-soft">Nenhum canal encontrado.</p>
        )}
        {filtered.map((c) => {
          const clickable = c.type !== "meta_cloud"; // UAZAPI: clicar reabre conexão (QR/código)
          const menuBtn = (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenu(menu === c.id ? null : c.id); }}
              className="rounded-lg p-1.5 text-ink-soft transition hover:bg-gray-100 hover:text-ink"
              title="Ações"
            >
              <MoreVertical size={18} />
            </button>
          );
          return (
            <div key={c.id} className="relative">
              <div
                role={clickable ? "button" : undefined}
                onClick={() => clickable && busy !== c.id && setConnect({ id: c.id, phone: c.phone ?? undefined })}
                className={clickable ? "cursor-pointer transition hover:opacity-90" : ""}
                title={clickable ? (c.status === "connected" ? "Ver conexão" : "Conectar / ler QR ou código") : undefined}
              >
                <ChannelCard channel={c} action={menuBtn} />
              </div>

              {menu === c.id && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                  <div className="absolute right-3 top-11 z-20 w-48 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-xl">
                    {clickable && (
                      <button onClick={() => { setMenu(null); setConnect({ id: c.id, phone: c.phone ?? undefined }); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-gray-50">
                        <Plug size={14} /> Conectar
                      </button>
                    )}
                    <button onClick={() => onDisconnect(c.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-gray-50">
                      <Power size={14} /> Desconectar
                    </button>
                    <button onClick={() => { setMenu(null); setEditTarget(c); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-gray-50">
                      <Pencil size={14} /> {c.type === "meta_cloud" ? "Editar / atualizar token" : "Editar canal"}
                    </button>
                    <button onClick={() => { setMenu(null); setDeleteTarget(c); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-red-50">
                      <Trash2 size={14} /> Excluir canal
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {connect && (
        <QrConnectModal
          channelId={connect.id}
          initialPhone={connect.phone}
          onClose={() => { setConnect(null); router.refresh(); }}
          onConnected={() => { setConnect(null); router.refresh(); }}
        />
      )}

      {deleteTarget && (
        <DeleteChannelModal
          channel={deleteTarget}
          busy={busy === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {editTarget && (
        <EditChannelModal
          channel={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); router.refresh(); }}
        />
      )}
    </>
  );
}

// ── Modal: confirmar exclusão (centralizado) ──────────────────────────────────

function DeleteChannelModal({
  channel, busy, onCancel, onConfirm,
}: {
  channel: Channel;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-card border border-border bg-surface p-6 shadow-2xl">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle size={20} />
          </div>
          <h2 className="text-base font-semibold text-ink">Excluir canal</h2>
        </div>
        <p className="text-sm text-ink-soft">
          Tem certeza que deseja excluir o canal <strong className="text-ink">“{channel.name}”</strong>?
          Isso remove a conexão e o histórico vinculado. Esta ação não pode ser desfeita.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm text-ink-soft transition hover:border-gray-400 hover:text-ink"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Excluir canal
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: editar canal / atualizar token (centralizado) ──────────────────────

function EditChannelModal({
  channel, onClose, onSaved,
}: {
  channel: Channel;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isMeta = channel.type === "meta_cloud";
  const cred = ((channel as unknown as { credentials?: Record<string, string> }).credentials ?? {}) as Record<string, string>;
  const [name, setName] = useState(channel.name);
  const [phone, setPhone] = useState(channel.phone ?? "");
  const [phoneNumberId, setPhoneNumberId] = useState(cred.phone_number_id ?? "");
  const [wabaId, setWabaId] = useState(cred.waba_id ?? "");
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await updateChannel(channel.id, {
        name,
        phone,
        ...(isMeta
          ? { phone_number_id: phoneNumberId, waba_id: wabaId, access_token: token || undefined }
          : {}),
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={save} className="relative w-full max-w-md overflow-hidden rounded-card border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-ink">Editar canal</h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-gray-100 hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <Field label="Nome do canal">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required />
          </Field>
          <Field label="Número (com DDI)">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="5514982124670" />
          </Field>

          {isMeta && (
            <>
              <Field label="Phone Number ID">
                <input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} className={inputCls} />
              </Field>
              <Field label="WhatsApp Business Account ID (WABA)">
                <input value={wabaId} onChange={(e) => setWabaId(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Token permanente" hint="Cole um token novo para atualizar. Deixe em branco para manter o atual.">
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className={inputCls}
                  type="password"
                  placeholder="EAA… (vazio = mantém o atual)"
                  autoComplete="off"
                />
              </Field>
            </>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-ink-soft transition hover:border-gray-400 hover:text-ink">
            Cancelar
          </button>
          <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-60">
            {pending && <Loader2 size={14} className="animate-spin" />} Salvar
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-ink-soft">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}
