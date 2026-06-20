"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, Copy, KeyRound } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { createApiKey, deleteApiKey } from "@/app/(app)/api/actions";
import type { Channel } from "@/lib/types";

interface ApiKey { id: string; name: string; channel_id: string | null; created_at: string; last_used_at: string | null }

export function ApiKeysClient({ keys, channels }: { keys: ApiKey[]; channels: Channel[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const chName = new Map(channels.map((c) => [c.id, c.name]));

  async function submit(fd: FormData) {
    setPending(true);
    try {
      const res = await createApiKey(fd);
      setNewKey(res.key);
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }
  async function remove(id: string) {
    if (!confirm("Revogar esta chave?")) return;
    await deleteApiKey(id);
    router.refresh();
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Gerar chave</Button>
      </div>

      {newKey && (
        <Card className="mt-4 border border-green-200 bg-green-50">
          <p className="text-sm font-medium text-green-800">Chave gerada! Copie agora — ela não será exibida novamente.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-white px-3 py-2 text-xs">{newKey}</code>
            <button onClick={() => navigator.clipboard.writeText(newKey)} className="rounded-lg bg-brand px-3 py-2 text-white hover:bg-brand-dark" title="Copiar"><Copy size={15} /></button>
          </div>
        </Card>
      )}

      <div className="mt-4 space-y-2">
        {keys.length === 0 && <p className="py-10 text-center text-sm text-ink-soft">Nenhuma chave de acesso ainda.</p>}
        {keys.map((k) => (
          <Card key={k.id} className="flex items-center gap-3 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light text-brand"><KeyRound size={18} /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{k.name}</p>
              <p className="text-xs text-ink-soft">
                {k.channel_id ? `Canal: ${chName.get(k.channel_id) ?? k.channel_id} · ` : ""}
                Criada {new Date(k.created_at).toLocaleDateString("pt-BR")}
                {k.last_used_at ? ` · usada ${new Date(k.last_used_at).toLocaleDateString("pt-BR")}` : " · nunca usada"}
              </p>
            </div>
            <button onClick={() => remove(k.id)} className="rounded p-1.5 text-ink-soft hover:bg-red-50 hover:text-danger"><Trash2 size={15} /></button>
          </Card>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-card bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Gerar chave de API</h2>
              <button onClick={() => setOpen(false)} className="text-ink-soft hover:text-ink"><X size={18} /></button>
            </div>
            <form action={submit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Nome da chave</label>
                <input name="name" required placeholder="Ex.: Integração n8n" className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Canal (opcional — limita a chave a um canal)</label>
                <select name="channel_id" className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand">
                  <option value="">Todos os canais</option>
                  {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={pending}>{pending ? "Gerando..." : "Gerar"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
