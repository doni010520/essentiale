"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, Plug, CheckCircle2, AlertCircle } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { createIntegration, deleteIntegration, testIntegration } from "@/app/(app)/integracoes/actions";
import type { Integration } from "@/lib/types";

export function IntegrationsClient({ integrations }: { integrations: Integration[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(fd: FormData) {
    setPending(true);
    try { await createIntegration(fd); setOpen(false); router.refresh(); }
    finally { setPending(false); }
  }
  async function remove(id: string) { if (!confirm("Excluir integração?")) return; await deleteIntegration(id); router.refresh(); }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Cadastrar</Button>
      </div>

      <div className="mt-4 space-y-2">
        {integrations.length === 0 && <p className="py-10 text-center text-sm text-ink-soft">Nenhuma integração de telefonia encontrada.</p>}
        {integrations.map((it) => (
          <Card key={it.id} className="flex items-center gap-3 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light text-brand"><Plug size={18} /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium uppercase text-ink">{it.type}</p>
              <p className="truncate text-xs text-ink-soft">{String((it.config as { url?: string })?.url ?? "")}</p>
            </div>
            <button onClick={async () => {
              const r = await testIntegration(it.id);
              alert(r.message);
            }} className="rounded p-1.5 text-ink-soft hover:bg-green-50 hover:text-green-600" title="Testar conexão">
              <CheckCircle2 size={15} />
            </button>
            <button onClick={() => remove(it.id)} className="rounded p-1.5 text-ink-soft hover:bg-red-50 hover:text-danger"><Trash2 size={15} /></button>
          </Card>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-card bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Nova integração</h2>
              <button onClick={() => setOpen(false)} className="text-ink-soft hover:text-ink"><X size={18} /></button>
            </div>
            <form action={submit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Tipo</label>
                <select name="type" className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand">
                  <option value="sgp">SGP (provedor)</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">URL</label>
                <input name="url" required placeholder="https://seudominio.sgp.net.br" className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Aplicação (app)</label>
                <input name="app" placeholder="nome da aplicação de integração" className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Token</label>
                <input name="token" className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-soft">Usuário <span className="text-ink-soft/60">(opcional)</span></label>
                  <input name="username" autoComplete="off" className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-soft">Senha <span className="text-ink-soft/60">(opcional)</span></label>
                  <input name="password" type="password" autoComplete="new-password" className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Cadastrar"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
