"use client";

import { useState } from "react";
import { X, CheckCircle2, ArrowRightLeft, Send } from "lucide-react";
import type { Tag, Profile, Department } from "@/lib/types";

function Overlay({ children, onCancel }: { children: React.ReactNode; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-card bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand";

// ---------------------------------------------------------------------------
// Encerrar atendimento — classificação + motivo + pesquisa opcional
// ---------------------------------------------------------------------------
export function CloseModal({
  tags,
  protocol,
  onConfirm,
  onCancel,
  pending,
}: {
  tags: Tag[];
  protocol: string | null;
  onConfirm: (opts: { reason: string; tagIds: string[]; sendSurvey: boolean }) => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [sendSurvey, setSendSurvey] = useState(false);

  function toggle(id: string) {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  return (
    <Overlay onCancel={onCancel}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <CheckCircle2 size={18} className="text-danger" /> Encerrar atendimento
        </h2>
        <button onClick={onCancel} className="text-ink-soft hover:text-ink">
          <X size={18} />
        </button>
      </div>

      {protocol && <p className="mb-3 text-xs text-ink-soft">Protocolo {protocol}</p>}

      <label className="mb-1.5 block text-xs font-medium text-ink-soft">Classificação</label>
      {tags.length === 0 ? (
        <p className="mb-3 text-xs text-ink-soft">
          Nenhuma classificação cadastrada. Crie em Ajustes › Classificações.
        </p>
      ) : (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {tags.map((t) => {
            const on = tagIds.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  on ? "text-white" : "text-ink hover:bg-gray-100"
                }`}
                style={on ? { backgroundColor: t.color ?? "#00a8ff" } : { backgroundColor: "#f1f3f5" }}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      )}

      <label className="mb-1.5 block text-xs font-medium text-ink-soft">Motivo do encerramento</label>
      <textarea
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Ex.: Dúvida resolvida, cliente satisfeito."
        className={`mb-3 resize-none ${inputCls}`}
      />

      <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={sendSurvey}
          onChange={(e) => setSendSurvey(e.target.checked)}
          className="h-4 w-4 accent-brand"
        />
        Enviar pesquisa de satisfação ao cliente
      </label>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-ink hover:bg-gray-200"
        >
          Cancelar
        </button>
        <button
          onClick={() => onConfirm({ reason, tagIds, sendSurvey })}
          disabled={pending}
          className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          Encerrar
        </button>
      </div>
    </Overlay>
  );
}

// ---------------------------------------------------------------------------
// Transferir atendimento — pessoa/departamento + nota interna + msg ao cliente
// ---------------------------------------------------------------------------
export function TransferModal({
  agents,
  departments,
  currentUserId,
  onConfirm,
  onCancel,
  pending,
}: {
  agents: Profile[];
  departments: Department[];
  currentUserId: string | null;
  onConfirm: (opts: {
    toUserId: string | null;
    toDepartmentId: string | null;
    internalNote: string;
    customerMessage: string;
  }) => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  const [mode, setMode] = useState<"person" | "department">("person");
  const [userId, setUserId] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [internalNote, setInternalNote] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");

  const selectable = agents.filter((a) => a.id !== currentUserId);
  const online = selectable.filter((a) => a.status === "online");
  const offline = selectable.filter((a) => a.status !== "online");

  const canConfirm = mode === "person" ? !!userId : !!departmentId;

  function confirm() {
    onConfirm({
      toUserId: mode === "person" ? userId : null,
      toDepartmentId: mode === "department" ? departmentId : null,
      internalNote,
      customerMessage,
    });
  }

  return (
    <Overlay onCancel={onCancel}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <ArrowRightLeft size={18} className="text-brand" /> Transferir atendimento
        </h2>
        <button onClick={onCancel} className="text-ink-soft hover:text-ink">
          <X size={18} />
        </button>
      </div>

      <div className="mb-4 flex rounded-lg bg-gray-100 p-1 text-sm">
        {(["person", "department"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md py-1.5 font-medium transition ${
              mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-soft"
            }`}
          >
            {m === "person" ? "Pessoa" : "Departamento"}
          </button>
        ))}
      </div>

      {mode === "person" ? (
        <div className="mb-4 max-h-52 overflow-y-auto rounded-lg border border-border">
          {selectable.length === 0 && (
            <p className="p-3 text-xs text-ink-soft">Nenhum outro atendente disponível.</p>
          )}
          {[
            { label: "Online", list: online },
            { label: "Offline", list: offline },
          ].map(
            (g) =>
              g.list.length > 0 && (
                <div key={g.label}>
                  <p className="bg-gray-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                    {g.label}
                  </p>
                  {g.list.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setUserId(a.id)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                        userId === a.id ? "bg-brand-light" : "hover:bg-gray-50"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          a.status === "online" ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                      <span className="text-ink">{a.name || a.email}</span>
                    </button>
                  ))}
                </div>
              ),
          )}
        </div>
      ) : (
        <select
          value={departmentId ?? ""}
          onChange={(e) => setDepartmentId(e.target.value || null)}
          className={`mb-4 ${inputCls}`}
        >
          <option value="">Selecione um departamento…</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      )}

      <label className="mb-1.5 block text-xs font-medium text-ink-soft">
        Mensagem interna (só atendentes)
      </label>
      <textarea
        value={internalNote}
        onChange={(e) => setInternalNote(e.target.value)}
        rows={2}
        placeholder="Contexto do atendimento para quem vai assumir…"
        className={`mb-3 resize-none ${inputCls}`}
      />

      <label className="mb-1.5 block text-xs font-medium text-ink-soft">Mensagem ao cliente</label>
      <textarea
        value={customerMessage}
        onChange={(e) => setCustomerMessage(e.target.value)}
        rows={2}
        placeholder="Ex.: Vou te transferir para o setor responsável, um momento."
        className={`mb-4 resize-none ${inputCls}`}
      />

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-ink hover:bg-gray-200"
        >
          Cancelar
        </button>
        <button
          onClick={confirm}
          disabled={!canConfirm || pending}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-40"
        >
          <Send size={14} /> Transferir
        </button>
      </div>
    </Overlay>
  );
}
