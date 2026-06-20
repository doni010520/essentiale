"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Bot, MessageSquare, Settings2, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { saveAiAgent, deleteAiAgent } from "@/app/(app)/ajustes/ia/actions";
import type { Channel } from "@/lib/types";

export interface AiAgentRow {
  id: string;
  name: string;
  prompt: string | null;
  model: string;
  channel_id: string | null;
  active: boolean;
  config: {
    temperature?: number;
    knowledge?: string;
    greeting?: string;
    tone?: string;
    base_prompt?: string;
    use_emojis?: boolean;
    execute_actions?: boolean;
    single_message?: boolean;
    audio_replies?: boolean;
    voice?: string;
    restrict_to_allowlist?: boolean;
  };
}

const MODELS = [
  { id: "gpt-4o-mini", label: "GPT-4o mini (rápido e barato)" },
  { id: "gpt-4o", label: "GPT-4o (mais capaz)" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  { id: "gpt-4.1", label: "GPT-4.1" },
];

const TONES = ["Profissional", "Amigável", "Casual", "Formal", "Empático", "Direto", "Divertido"];
const VOICES = [
  { id: "alloy", label: "Alloy (neutra)" },
  { id: "nova", label: "Nova (feminina)" },
  { id: "shimmer", label: "Shimmer (feminina suave)" },
  { id: "echo", label: "Echo (masculina)" },
  { id: "onyx", label: "Onyx (masculina grave)" },
  { id: "fable", label: "Fable (expressiva)" },
];

const inputCls = "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand";

function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-start gap-3 py-2 cursor-pointer">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 accent-brand" />
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="text-xs text-ink-soft">{hint}</p>}
      </div>
    </label>
  );
}

export function AiAgentList({ agents, channels }: { agents: AiAgentRow[]; channels: Channel[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AiAgentRow | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleDelete(id: string) {
    if (!confirm("Excluir este agente?")) return;
    await deleteAiAgent(id);
    router.refresh();
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => { setCreating(true); setEditing(null); }}>
          <Plus size={16} /> Novo Agente
        </Button>
      </div>

      {agents.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-card border border-dashed border-gray-300 py-16 text-center">
          <Bot size={32} className="mb-2 text-ink-soft" />
          <p className="text-sm font-medium text-ink">Nenhum agente de IA cadastrado</p>
          <p className="mt-1 text-xs text-ink-soft">Crie seu primeiro agente para atendimento automático.</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-card border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50 text-left text-xs font-medium text-ink-soft">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} className="border-b border-border hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-ink">{a.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{a.config.greeting || a.prompt?.slice(0, 60) || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {a.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setEditing(a); setCreating(false); }} className="rounded p-1.5 text-ink-soft hover:bg-gray-100 hover:text-ink" title="Editar">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(a.id)} className="rounded p-1.5 text-ink-soft hover:bg-red-50 hover:text-danger" title="Excluir">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <AgentWizard agent={editing} channels={channels} onClose={() => { setCreating(false); setEditing(null); }} />
      )}
    </>
  );
}

const STEPS = [
  { key: "agent", label: "Agente", icon: Bot },
  { key: "instructions", label: "Instruções", icon: MessageSquare },
  { key: "finish", label: "Finalizar", icon: Settings2 },
] as const;

function AgentWizard({ agent, channels, onClose }: { agent: AiAgentRow | null; channels: Channel[]; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const cfg0 = agent?.config ?? {};
  const [temp, setTemp] = useState<number>(typeof cfg0.temperature === "number" ? cfg0.temperature : 0.4);
  const [audio, setAudio] = useState<boolean>(!!cfg0.audio_replies);
  const [advanced, setAdvanced] = useState(false);

  async function submit(fd: FormData) {
    setPending(true);
    try {
      await saveAiAgent(fd);
      onClose();
      router.refresh();
    } catch {
      alert("Erro ao salvar o agente.");
    } finally {
      setPending(false);
    }
  }

  const c = agent?.config ?? {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-card bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">{agent ? "Editar Agente" : "Cadastrar Agente"}</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink"><X size={18} /></button>
        </div>

        {/* Stepper */}
        <div className="mb-6 flex items-center justify-center gap-0">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <button type="button" onClick={() => setStep(i)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition ${
                  step === i ? "bg-brand text-white" : step > i ? "bg-green-100 text-green-700" : "bg-gray-100 text-ink-soft"
                }`}>
                <s.icon size={14} />
                {i + 1}. {s.label}
              </button>
              {i < STEPS.length - 1 && <div className="mx-1 h-px w-10 bg-gray-200" />}
            </div>
          ))}
        </div>

        <form action={submit}>
          {agent && <input type="hidden" name="id" value={agent.id} />}

          {/* Step 1: Agente */}
          <div className={step === 0 ? "" : "hidden"}>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Nome do Agente de IA *</label>
                <input name="name" defaultValue={agent?.name ?? ""} required placeholder="Ex.: Chatmixo, Ana Assistente" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Mensagem de apresentação inicial *</label>
                <textarea name="greeting" rows={3} defaultValue={c.greeting ?? ""} required
                  placeholder="Ex.: Olá! Eu sou o Chatmixo, seu assistente virtual especializado em suporte técnico. Como posso ajudar você hoje?"
                  className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Canal (opcional)</label>
                <select name="channel_id" defaultValue={agent?.channel_id ?? ""} className={inputCls}>
                  <option value="">Todos os canais</option>
                  {channels.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Step 2: Instruções */}
          <div className={step === 1 ? "" : "hidden"}>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Instruções personalizadas *</label>
                <textarea name="prompt" rows={6} defaultValue={agent?.prompt ?? ""}
                  placeholder="Ex.: Atue como um especialista em suporte técnico, mantendo um tom profissional e empático."
                  className={`${inputCls} resize-none font-mono`} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-soft">Modelo</label>
                  <select name="model" defaultValue={agent?.model ?? "gpt-4o-mini"} className={inputCls}>
                    {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-soft">Tom de voz</label>
                  <select name="tone" defaultValue={c.tone ?? ""} className={inputCls}>
                    <option value="">Padrão (cordial e objetivo)</option>
                    {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">
                  Criatividade das respostas <span className="font-normal">({temp.toFixed(1)})</span>
                </label>
                <input type="range" name="temperature" min={0} max={1} step={0.1} value={temp}
                  onChange={(e) => setTemp(Number(e.target.value))}
                  className="w-full accent-brand" />
                <p className="mt-0.5 text-[11px] text-ink-soft">Mais baixo = respostas previsíveis e consistentes. Mais alto = mais criativas e variadas.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Base de conhecimento</label>
                <textarea name="knowledge" rows={4} defaultValue={c.knowledge ?? ""}
                  placeholder="Informações que o agente deve conhecer: horários, planos, políticas, FAQ…"
                  className={`${inputCls} resize-none`} />
              </div>
              <div className="space-y-2 pt-2">
                <Toggle name="use_emojis" label="Utilizar emojis nas respostas"
                  hint="Torne as respostas mais expressivas e envolventes." defaultChecked={c.use_emojis} />
                <Toggle name="execute_actions" label="Executar ações da automação"
                  hint="Permitir que ações automatizadas (SGP) sejam executadas." defaultChecked={c.execute_actions ?? true} />
                <Toggle name="single_message" label="Responder apenas uma mensagem"
                  hint="O agente responde com apenas 1 mensagem por turno." defaultChecked={c.single_message} />
                <label className="flex items-start gap-3 py-2 cursor-pointer">
                  <input type="checkbox" name="audio_replies" checked={audio} onChange={(e) => setAudio(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
                  <div>
                    <p className="text-sm font-medium text-ink">Responder clientes com áudios</p>
                    <p className="text-xs text-ink-soft">Converte a resposta em áudio (voz) e envia ao cliente. Tem custo de TTS por mensagem.</p>
                  </div>
                </label>
                {audio && (
                  <div className="ml-7">
                    <label className="mb-1 block text-xs font-medium text-ink-soft">Voz do áudio</label>
                    <select name="voice" defaultValue={c.voice ?? "alloy"} className={inputCls}>
                      {VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-border">
                <button type="button" onClick={() => setAdvanced((v) => !v)}
                  className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-ink-soft hover:text-ink">
                  <span>Avançado — substituir prompt base</span>
                  {advanced ? <ChevronLeft size={14} className="rotate-90" /> : <ChevronRight size={14} className="rotate-90" />}
                </button>
                {advanced && (
                  <div className="border-t border-border p-3">
                    <p className="mb-2 text-[11px] text-ink-soft">
                      Deixe em branco para usar o comportamento padrão da MVF (fluxo + segurança). Preenchendo, você
                      <strong> substitui toda a espinha dorsal</strong> do agente — controle total, mas você assume o fluxo e as regras.
                    </p>
                    <textarea name="base_prompt" rows={6} defaultValue={c.base_prompt ?? ""}
                      placeholder="Prompt base completo do agente (substitui o padrão)…"
                      className={`${inputCls} resize-none font-mono`} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Finalizar */}
          <div className={step === 2 ? "" : "hidden"}>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">Agente ativo</p>
                  <p className="text-xs text-ink-soft">Quando ativo, o agente atende automaticamente.</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" name="active" defaultChecked={agent?.active ?? false} className="peer sr-only" />
                  <div className="h-6 w-11 rounded-full bg-gray-300 transition peer-checked:bg-brand" />
                  <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
                </label>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">Responder apenas a números liberados</p>
                  <p className="text-xs text-ink-soft">Recomendado. A IA só atende os números da allowlist (abaixo da lista de agentes); os demais vão para a fila humana.</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" name="restrict_to_allowlist" defaultChecked={c.restrict_to_allowlist ?? true} className="peer sr-only" />
                  <div className="h-6 w-11 rounded-full bg-gray-300 transition peer-checked:bg-brand" />
                  <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
                </label>
              </div>
              <div className="rounded-lg border border-border p-4 text-sm text-ink-soft">
                <p className="font-medium text-ink mb-2">Resumo</p>
                <p>O agente será {agent ? "atualizado" : "criado"} com as configurações definidas nos passos anteriores.</p>
                <p className="mt-2">Clique em <strong>Salvar</strong> para confirmar.</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <div>
              {step > 0 && (
                <button type="button" onClick={() => setStep(step - 1)}
                  className="flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
                  <ChevronLeft size={14} /> Voltar
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              {step < STEPS.length - 1 ? (
                <button type="button" onClick={() => setStep(step + 1)}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
                  Avançar <ChevronRight size={14} />
                </button>
              ) : (
                <Button type="submit" disabled={pending}>
                  <Check size={14} /> {pending ? "Salvando..." : "Salvar"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
