"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Power, Trash2, Plug, Search } from "lucide-react";
import { ChannelCard } from "@/components/channel-card";
import { QrConnectModal } from "@/components/qr-connect-modal";
import { disconnectChannel, deleteChannel, syncChannelStatus } from "@/app/(app)/canais/actions";
import type { Channel } from "@/lib/types";

export function ChannelsList({ channels }: { channels: Channel[] }) {
  const router = useRouter();
  const [connect, setConnect] = useState<{ id: string; phone?: string } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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
  async function onDelete(c: Channel) {
    setMenu(null);
    if (!confirm(`Excluir o canal "${c.name}"? Isso remove a conexão e o histórico vinculado.`)) return;
    setBusy(c.id);
    try { await deleteChannel(c.id); router.refresh(); } finally { setBusy(null); }
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
                  <div className="absolute right-3 top-11 z-20 w-44 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-xl">
                    {clickable && (
                      <button onClick={() => { setMenu(null); setConnect({ id: c.id, phone: c.phone ?? undefined }); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-gray-50">
                        <Plug size={14} /> Conectar
                      </button>
                    )}
                    <button onClick={() => onDisconnect(c.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-gray-50">
                      <Power size={14} /> Desconectar
                    </button>
                    <button onClick={async () => {
                      setMenu(null);
                      const newName = prompt("Novo nome do canal:", c.name);
                      if (newName && newName !== c.name) {
                        const { renameChannel } = await import("@/app/(app)/canais/actions");
                        await renameChannel(c.id, newName);
                        router.refresh();
                      }
                    }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-gray-50">
                      <Plug size={14} /> Editar nome
                    </button>
                    <button onClick={() => onDelete(c)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-red-50">
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
    </>
  );
}
