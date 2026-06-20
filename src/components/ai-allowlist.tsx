"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ShieldCheck, Phone } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { addAllowedNumber, toggleAllowedNumber, removeAllowedNumber } from "@/app/(app)/ajustes/ia/actions";
import type { AiAllowedNumber } from "@/lib/types";

const fmtPhone = (p: string) => {
  const d = p.replace(/\D+/g, "");
  const m = d.match(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+${m[1]} (${m[2]}) ${m[3]}-${m[4]}` : d;
};

export function AiAllowlist({ numbers }: { numbers: AiAllowedNumber[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(fd: FormData) {
    setPending(true);
    setError(null);
    try {
      await addAllowedNumber(fd);
      router.refresh();
      (document.getElementById("allow-form") as HTMLFormElement | null)?.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao adicionar.");
    } finally {
      setPending(false);
    }
  }
  async function toggle(n: AiAllowedNumber) {
    await toggleAllowedNumber(n.id, !n.active);
    router.refresh();
  }
  async function remove(id: string) {
    if (!confirm("Remover este número da lista?")) return;
    await removeAllowedNumber(id);
    router.refresh();
  }

  return (
    <Card className="mt-6">
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck size={18} className="text-brand" />
        <h3 className="text-sm font-semibold text-ink">Números liberados para a IA</h3>
      </div>
      <p className="mb-4 text-xs text-ink-soft">
        Quando o agente está com <strong>“Responder apenas a números liberados”</strong> ativo, somente os números
        abaixo recebem atendimento por IA. Os demais vão direto para a fila humana.
      </p>

      <form id="allow-form" action={add} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-ink-soft">Número (com DDD)</label>
          <input name="phone" required placeholder="73 99999-9999"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand" />
        </div>
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs font-medium text-ink-soft">Identificação (opcional)</label>
          <input name="label" placeholder="Ex.: Meu WhatsApp, Cliente teste"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand" />
        </div>
        <Button type="submit" disabled={pending}><Plus size={16} /> {pending ? "..." : "Liberar"}</Button>
      </form>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <div className="mt-4 space-y-2">
        {numbers.length === 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Nenhum número liberado. Com a restrição ativa, o agente não responderá a ninguém.
          </p>
        )}
        {numbers.map((n) => (
          <div key={n.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light text-brand"><Phone size={15} /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{fmtPhone(n.phone)}</p>
              {n.label && <p className="truncate text-xs text-ink-soft">{n.label}</p>}
            </div>
            <button onClick={() => toggle(n)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${n.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-ink-soft"}`}>
              {n.active ? "Ativo" : "Inativo"}
            </button>
            <button onClick={() => remove(n.id)} className="rounded p-1.5 text-ink-soft hover:bg-red-50 hover:text-danger"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </Card>
  );
}
