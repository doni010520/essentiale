"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, Trash2, Pencil, Settings } from "lucide-react";
import { Button, Card } from "@/components/ui";
import {
  createAutomation,
  toggleAutomation,
  deleteAutomation,
  updateAutomationConfig,
} from "@/app/(app)/automacoes/actions";
import type { Automation, AutomationSchedule, Channel, Integration } from "@/lib/types";

const DAYS: { key: keyof AutomationSchedule; label: string }[] = [
  { key: "sun", label: "Dom" },
  { key: "mon", label: "Seg" },
  { key: "tue", label: "Ter" },
  { key: "wed", label: "Qua" },
  { key: "thu", label: "Qui" },
  { key: "fri", label: "Sex" },
  { key: "sat", label: "Sáb" },
];

function ScheduleEditor({
  value,
  onChange,
}: {
  value: AutomationSchedule | null;
  onChange: (v: AutomationSchedule | null) => void;
}) {
  const schedule: AutomationSchedule = value ?? {};

  function toggleDay(key: keyof AutomationSchedule) {
    if (schedule[key]) {
      const next = { ...schedule };
      delete next[key];
      onChange(Object.keys(next).length ? next : null);
    } else {
      onChange({ ...schedule, [key]: [["08:00", "18:00"]] });
    }
  }

  function setRange(key: keyof AutomationSchedule, idx: number, field: 0 | 1, val: string) {
    const ranges = [...(schedule[key] ?? [["08:00", "18:00"]])];
    const range: [string, string] = [...(ranges[idx] as [string, string])] as [string, string];
    range[field] = val;
    ranges[idx] = range;
    onChange({ ...schedule, [key]: ranges });
  }

  return (
    <div className="space-y-2">
      {DAYS.map(({ key, label }) => {
        const active = !!schedule[key];
        const ranges = schedule[key] ?? [];
        return (
          <div key={key}>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={() => toggleDay(key)}
                className="accent-brand"
              />
              <span className="w-8 font-medium text-ink">{label}</span>
              {active && ranges.map((r, i) => (
                <span key={i} className="flex items-center gap-1">
                  <input
                    type="time"
                    value={r[0]}
                    onChange={(e) => setRange(key, i, 0, e.target.value)}
                    className="rounded border border-border px-1.5 py-0.5 text-xs outline-none focus:border-brand"
                  />
                  <span className="text-ink-soft">–</span>
                  <input
                    type="time"
                    value={r[1]}
                    onChange={(e) => setRange(key, i, 1, e.target.value)}
                    className="rounded border border-border px-1.5 py-0.5 text-xs outline-none focus:border-brand"
                  />
                </span>
              ))}
              {!active && <span className="text-xs text-ink-soft">Inativo</span>}
            </label>
          </div>
        );
      })}
    </div>
  );
}

function ConfigModal({
  automation,
  integrations,
  onClose,
}: {
  automation: Automation;
  integrations: Integration[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [integrationId, setIntegrationId] = useState<string>(automation.integration_id ?? "");
  const [schedule, setSchedule] = useState<AutomationSchedule | null>(automation.schedule ?? null);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      await updateAutomationConfig(automation.id, {
        integration_id: integrationId || null,
        schedule,
      });
      onClose();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-card bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Configurar: {automation.name}</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          {integrations.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">Integração SGP</label>
              <select
                value={integrationId}
                onChange={(e) => setIntegrationId(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand"
              >
                <option value="">Padrão da organização</option>
                {integrations.filter((i) => i.type === "sgp").map((i) => (
                  <option key={i.id} value={i.id}>
                    {(i.config as Record<string, unknown>).app as string ?? i.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs font-medium text-ink-soft">
              Horário de execução{" "}
              <span className="font-normal">(deixe em branco para rodar 24h)</span>
            </label>
            <ScheduleEditor value={schedule} onChange={setSchedule} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}

export function AutomationsClient({
  automations,
  channels,
  integrations,
}: {
  automations: Automation[];
  channels: Channel[];
  integrations: Integration[];
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [configTarget, setConfigTarget] = useState<Automation | null>(null);
  const [pending, setPending] = useState(false);

  const sgpIntegrations = integrations.filter((i) => i.type === "sgp");

  const chName = (id: string | null) => channels.find((c) => c.id === id)?.name ?? "Todos os canais";
  const intName = (id: string | null) => {
    if (!id) return null;
    const int = integrations.find((i) => i.id === id);
    return int ? ((int.config as Record<string, unknown>).app as string) ?? "SGP" : null;
  };

  async function submit(fd: FormData) {
    setPending(true);
    try { await createAutomation(fd); setCreateOpen(false); router.refresh(); }
    finally { setPending(false); }
  }
  async function toggle(a: Automation) { await toggleAutomation(a.id, !a.active); router.refresh(); }
  async function remove(id: string) {
    if (!confirm("Excluir automação?")) return;
    await deleteAutomation(id);
    router.refresh();
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}><Plus size={16} /> Nova automação</Button>
      </div>

      <div className="mt-4 space-y-2">
        {automations.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-soft">Nenhuma automação ainda.</p>
        )}
        {automations.map((a) => {
          const iName = intName(a.integration_id);
          const hasSchedule = !!a.schedule && Object.keys(a.schedule).length > 0;
          return (
            <Card key={a.id} className="flex items-center gap-3 py-3">
              <button
                onClick={() => toggle(a)}
                title={a.active ? "Desativar" : "Ativar"}
                className={`relative h-5 w-9 shrink-0 rounded-full transition ${a.active ? "bg-green-500" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${a.active ? "left-4" : "left-0.5"}`} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{a.name}</p>
                <p className="truncate text-xs text-ink-soft">
                  {chName(a.channel_id)}
                  {iName ? ` · ${iName}` : ""}
                  {a.trigger ? ` · ${a.trigger}` : ""}
                  {hasSchedule ? " · horário configurado" : ""}
                </p>
              </div>
              <button
                onClick={() => setConfigTarget(a)}
                className="rounded p-1.5 text-ink-soft hover:bg-gray-100 hover:text-ink"
                title="Configurar integração e horário"
              >
                <Settings size={15} />
              </button>
              <Link
                href={`/automacoes/${a.id}`}
                className="rounded p-1.5 text-ink-soft hover:bg-gray-100 hover:text-ink"
                title="Editar fluxo"
              >
                <Pencil size={15} />
              </Link>
              <button
                onClick={() => remove(a.id)}
                className="rounded p-1.5 text-ink-soft hover:bg-red-50 hover:text-danger"
              >
                <Trash2 size={15} />
              </button>
            </Card>
          );
        })}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-card bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Nova automação</h2>
              <button onClick={() => setCreateOpen(false)} className="text-ink-soft hover:text-ink"><X size={18} /></button>
            </div>
            <form action={submit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Nome</label>
                <input
                  name="name"
                  required
                  placeholder="Ex.: Horário comercial"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Canal</label>
                <select name="channel_id" className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand">
                  <option value="">Todos os canais</option>
                  {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {sgpIntegrations.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-soft">Integração SGP</label>
                  <select name="integration_id" className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand">
                    <option value="">Padrão da organização</option>
                    {sgpIntegrations.map((i) => (
                      <option key={i.id} value={i.id}>
                        {(i.config as Record<string, unknown>).app as string ?? i.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Gatilho (palavra-chave)</label>
                <input
                  name="trigger"
                  placeholder="Ex.: menu, oi, suporte"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Criar"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {configTarget && (
        <ConfigModal
          automation={configTarget}
          integrations={integrations}
          onClose={() => setConfigTarget(null)}
        />
      )}
    </>
  );
}
