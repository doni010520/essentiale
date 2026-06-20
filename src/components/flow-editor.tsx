"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge, Handle, Position,
  type Node, type Edge, type Connection, type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useRouter } from "next/navigation";
import {
  MessageSquare, ListChecks, GitBranch, UserCheck, Bot, Clock, Save, X, Trash2,
  Keyboard, Image as ImageIcon, Database, Tag as TagIcon, Plus,
} from "lucide-react";
import { updateAutomationFlow } from "@/app/(app)/automacoes/actions";
import { toast } from "@/components/toast";

type IdName = { id: string; name: string };

interface NodeData {
  kind: string;
  label?: string;
  content?: string;
  mediaUrl?: string;
  mediaKind?: "image" | "audio" | "video" | "document";
  options?: { id: string; label: string }[];
  keywords?: string;
  departmentId?: string;
  agentId?: string;
  mode?: "reply" | "delay";
  seconds?: number;
  variable?: string;
  action?: string;
  tagId?: string;
  [k: string]: unknown;
}

const NODE_KINDS: Record<string, { label: string; color: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  start: { label: "Início", color: "#10b981", icon: Bot },
  message: { label: "Mensagem", color: "#00a8ff", icon: MessageSquare },
  menu: { label: "Menu / Opções", color: "#8b5cf6", icon: ListChecks },
  condition: { label: "Condição", color: "#f59e0b", icon: GitBranch },
  input: { label: "Coletar resposta", color: "#0d9488", icon: Keyboard },
  ai: { label: "Agente de IA", color: "#0ea5e9", icon: Bot },
  sgp: { label: "Ação SGP", color: "#7c3aed", icon: Database },
  media: { label: "Mídia", color: "#db2777", icon: ImageIcon },
  tag: { label: "Aplicar tag", color: "#65a30d", icon: TagIcon },
  transfer: { label: "Transferir p/ humano", color: "#ef4444", icon: UserCheck },
  wait: { label: "Aguardar", color: "#6b7280", icon: Clock },
};

const PALETTE = ["message", "menu", "condition", "input", "ai", "sgp", "media", "tag", "transfer", "wait"];

const SGP_ACTIONS = [
  { value: "segunda_via", label: "2ª via de fatura" },
  { value: "faturas", label: "Faturas em aberto" },
  { value: "pix", label: "Gerar PIX" },
  { value: "status", label: "Status da conexão" },
  { value: "liberacao", label: "Liberação por confiança" },
];

let idc = 1;
const uid = (p: string) => `${p}-${idc++}-${Math.floor(Math.random() * 1e5)}`;

function summary(d: NodeData): string {
  switch (d.kind) {
    case "menu": return `${d.options?.length ?? 0} opção(ões)`;
    case "condition": return d.keywords ? `se contém: ${d.keywords}` : "defina palavras-chave";
    case "ai": return "responde com a IA";
    case "sgp": return SGP_ACTIONS.find((a) => a.value === d.action)?.label ?? "escolha a ação";
    case "input": return d.variable ? `salva em {{${d.variable}}}` : "defina a variável";
    case "transfer": return "encaminha p/ atendente";
    case "wait": return d.mode === "delay" ? `aguarda ${d.seconds ?? 0}s` : "aguarda resposta";
    case "media": return d.mediaUrl ? "mídia configurada" : "defina a URL";
    case "tag": return "aplica tag";
    default: return (d.content ?? "").slice(0, 40) || "sem conteúdo";
  }
}

/** Nó visual (card). Coloca handles conforme o tipo (menu = 1 por opção; condição = sim/não). */
function FlowCard({ id, data, selected }: NodeProps) {
  const d = data as NodeData;
  const meta = NODE_KINDS[d.kind] ?? NODE_KINDS.message;
  const Icon = meta.icon;
  const isMenu = d.kind === "menu";
  const isCond = d.kind === "condition";
  return (
    <div
      className="rounded-xl border-2 bg-surface shadow-card"
      style={{ borderColor: meta.color, width: 200, outline: selected ? `2px solid ${meta.color}55` : undefined }}
    >
      {d.kind !== "start" && <Handle type="target" position={Position.Left} style={{ background: meta.color }} />}
      <div className="flex items-center gap-1.5 rounded-t-lg px-2.5 py-1.5 text-xs font-semibold text-white" style={{ background: meta.color }}>
        <Icon size={13} /> {d.label || meta.label}
      </div>
      <div className="px-2.5 py-2 text-[11px] text-ink-soft">{summary(d)}</div>

      {isMenu ? (
        <div className="border-t border-border">
          {(d.options ?? []).map((o, i) => (
            <div key={o.id} className="relative border-b border-border px-2.5 py-1.5 text-[11px] text-ink last:border-0">
              {i + 1}. {o.label || "opção"}
              <Handle type="source" id={o.id} position={Position.Right} style={{ background: meta.color, top: "50%" }} />
            </div>
          ))}
          {(d.options?.length ?? 0) === 0 && <p className="px-2.5 py-1.5 text-[10px] text-ink-soft">sem opções</p>}
        </div>
      ) : isCond ? (
        <div className="relative border-t border-border">
          <div className="relative px-2.5 py-1.5 text-[11px] text-green-700">Sim
            <Handle type="source" id="true" position={Position.Right} style={{ background: "#22c55e", top: "50%" }} />
          </div>
          <div className="relative border-t border-border px-2.5 py-1.5 text-[11px] text-red-600">Não
            <Handle type="source" id="false" position={Position.Right} style={{ background: "#ef4444", top: "50%" }} />
          </div>
        </div>
      ) : (
        <Handle type="source" position={Position.Right} style={{ background: meta.color }} />
      )}
    </div>
  );
}

type FlowData = { nodes: Node[]; edges: Edge[] };

export function FlowEditor({
  automationId, initialFlow, departments = [], aiAgents = [], tags = [],
}: {
  automationId: string;
  initialFlow: FlowData;
  departments?: IdName[];
  aiAgents?: IdName[];
  tags?: IdName[];
}) {
  const router = useRouter();
  const nodeTypes = useMemo(() => ({ flowCard: FlowCard }), []);

  // Normaliza nós salvos (legado) p/ o tipo custom e garante data.kind.
  const normalize = (ns: Node[]): Node[] =>
    (ns?.length ? ns : [{ id: "start", position: { x: 80, y: 200 }, data: { kind: "start", label: "▶ Início" } } as Node])
      .map((n, i) => ({
        ...n,
        type: "flowCard",
        position: n.position ?? { x: 80 + i * 260, y: 160 },
        data: { kind: (n.data as NodeData)?.kind ?? (n.id === "start" ? "start" : "message"), ...(n.data as object) },
      }));

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(normalize(initialFlow.nodes as Node[]));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>((initialFlow.edges as Edge[]) ?? []);
  const [selId, setSelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const selected = nodes.find((n) => n.id === selId) ?? null;
  const sd = selected ? (selected.data as NodeData) : null;

  const onConnect = useCallback((c: Connection) => setEdges((eds) => addEdge({
    ...c,
    animated: true,
    style: c.sourceHandle === "true" ? { stroke: "#22c55e" } : c.sourceHandle === "false" ? { stroke: "#ef4444" } : undefined,
  }, eds)), [setEdges]);

  function addNode(kind: string) {
    const id = uid(kind);
    const base: NodeData = { kind, label: NODE_KINDS[kind].label, content: "" };
    if (kind === "menu") base.options = [{ id: uid("opt"), label: "Opção 1" }];
    if (kind === "wait") base.mode = "reply";
    setNodes((nds) => [...nds, { id, type: "flowCard", position: { x: 320 + Math.random() * 120, y: 120 + nds.length * 24 }, data: base }]);
    setSelId(id);
  }

  function patch(p: Partial<NodeData>) {
    if (!selId) return;
    setNodes((nds) => nds.map((n) => (n.id === selId ? { ...n, data: { ...(n.data as NodeData), ...p } } : n)));
  }

  function setOption(optId: string, label: string) {
    if (!sd) return;
    patch({ options: (sd.options ?? []).map((o) => (o.id === optId ? { ...o, label } : o)) });
  }
  function addOption() {
    if (!sd) return;
    patch({ options: [...(sd.options ?? []), { id: uid("opt"), label: `Opção ${(sd.options?.length ?? 0) + 1}` }] });
  }
  function removeOption(optId: string) {
    if (!sd) return;
    patch({ options: (sd.options ?? []).filter((o) => o.id !== optId) });
    setEdges((eds) => eds.filter((e) => e.sourceHandle !== optId));
  }

  function removeSelected() {
    if (!selId || selId === "start") return;
    setNodes((nds) => nds.filter((n) => n.id !== selId));
    setEdges((eds) => eds.filter((e) => e.source !== selId && e.target !== selId));
    setSelId(null);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await updateAutomationFlow(automationId, JSON.stringify({ nodes, edges }));
      setSaved(true);
      toast("Fluxo salvo!");
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-border px-2.5 py-1.5 text-sm outline-none focus:border-brand";
  const labelCls = "mb-1 block text-xs font-medium text-ink-soft";

  return (
    <div className="flex h-full">
      {/* Paleta */}
      <div className="w-48 shrink-0 overflow-y-auto border-r border-border bg-surface p-3">
        <p className="mb-2 text-xs font-semibold text-ink-soft">Adicionar nó</p>
        <div className="space-y-1.5">
          {PALETTE.map((kind) => {
            const Icon = NODE_KINDS[kind].icon;
            return (
              <button key={kind} onClick={() => addNode(kind)}
                className="flex w-full items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-left text-xs font-medium text-ink hover:border-brand hover:bg-brand-light">
                <Icon size={14} style={{ color: NODE_KINDS[kind].color }} /> {NODE_KINDS[kind].label}
              </button>
            );
          })}
        </div>
        <button onClick={save} disabled={saving}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
          <Save size={15} /> {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar fluxo"}
        </button>
        <p className="mt-3 text-[10px] leading-relaxed text-ink-soft">
          Variáveis: <code>{"{{nome}}"}</code>, <code>{"{{telefone}}"}</code> e as coletadas (ex.: <code>{"{{contrato}}"}</code>).
        </p>
      </div>

      {/* Canvas */}
      <div className="relative min-w-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, n) => setSelId(n.id)}
          onPaneClick={() => setSelId(null)}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#dde3ea" gap={18} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>

        {/* Painel de edição por tipo */}
        {selected && sd && (
          <div className="absolute right-3 top-3 max-h-[calc(100%-24px)] w-80 overflow-y-auto rounded-card bg-surface p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">{NODE_KINDS[sd.kind]?.label ?? "Nó"}</h3>
              <button onClick={() => setSelId(null)} className="text-ink-soft hover:text-ink"><X size={16} /></button>
            </div>

            <label className={labelCls}>Título</label>
            <input value={sd.label ?? ""} onChange={(e) => patch({ label: e.target.value })} className={`mb-3 ${inputCls}`} />

            {/* MENSAGEM / MÍDIA / coletar / transfer / ai: textarea de conteúdo */}
            {["message", "menu", "input", "transfer", "ai", "media"].includes(sd.kind) && (
              <>
                <label className={labelCls}>
                  {sd.kind === "ai" ? "Instrução para a IA (opcional)"
                    : sd.kind === "input" ? "Pergunta ao cliente"
                    : sd.kind === "media" ? "Legenda (opcional)"
                    : sd.kind === "menu" ? "Mensagem do menu"
                    : "Mensagem"}
                </label>
                <textarea value={sd.content ?? ""} onChange={(e) => patch({ content: e.target.value })} rows={3} className={`mb-3 ${inputCls}`} />
              </>
            )}

            {/* MENU: opções */}
            {sd.kind === "menu" && (
              <div className="mb-3">
                <label className={labelCls}>Opções (cada uma vira um ramo)</label>
                <div className="space-y-1.5">
                  {(sd.options ?? []).map((o, i) => (
                    <div key={o.id} className="flex items-center gap-1.5">
                      <span className="text-[11px] text-ink-soft">{i + 1}.</span>
                      <input value={o.label} onChange={(e) => setOption(o.id, e.target.value)} className={inputCls} />
                      <button onClick={() => removeOption(o.id)} className="shrink-0 rounded p-1 text-ink-soft hover:bg-red-50 hover:text-danger"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
                <button onClick={addOption} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"><Plus size={12} /> Adicionar opção</button>
              </div>
            )}

            {/* CONDIÇÃO */}
            {sd.kind === "condition" && (
              <>
                <label className={labelCls}>Palavras-chave (separadas por vírgula)</label>
                <input value={sd.keywords ?? ""} onChange={(e) => patch({ keywords: e.target.value })} placeholder="ex.: sim, quero, ok" className={`mb-2 ${inputCls}`} />
                <p className="mb-3 text-[11px] text-ink-soft">Se a mensagem contiver alguma → ramo <b className="text-green-700">Sim</b>; senão → <b className="text-red-600">Não</b>.</p>
              </>
            )}

            {/* COLETAR RESPOSTA */}
            {sd.kind === "input" && (
              <>
                <label className={labelCls}>Salvar resposta na variável</label>
                <input value={sd.variable ?? ""} onChange={(e) => patch({ variable: e.target.value.replace(/[^\w]/g, "") })} placeholder="ex.: contrato, cpfcnpj" className={`mb-3 ${inputCls}`} />
              </>
            )}

            {/* AGENTE DE IA */}
            {sd.kind === "ai" && (
              <>
                <label className={labelCls}>Agente</label>
                <select value={sd.agentId ?? ""} onChange={(e) => patch({ agentId: e.target.value || undefined })} className={`mb-3 ${inputCls}`}>
                  <option value="">Agente ativo padrão</option>
                  {aiAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </>
            )}

            {/* AÇÃO SGP */}
            {sd.kind === "sgp" && (
              <>
                <label className={labelCls}>Ação</label>
                <select value={sd.action ?? ""} onChange={(e) => patch({ action: e.target.value || undefined })} className={`mb-2 ${inputCls}`}>
                  <option value="">Selecione…</option>
                  {SGP_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
                <p className="mb-3 text-[11px] text-ink-soft">Usa as variáveis <code>{"{{contrato}}"}</code> ou <code>{"{{cpfcnpj}}"}</code> coletadas antes.</p>
              </>
            )}

            {/* MÍDIA */}
            {sd.kind === "media" && (
              <>
                <label className={labelCls}>URL da mídia</label>
                <input value={sd.mediaUrl ?? ""} onChange={(e) => patch({ mediaUrl: e.target.value })} placeholder="https://…" className={`mb-2 ${inputCls}`} />
                <label className={labelCls}>Tipo</label>
                <select value={sd.mediaKind ?? "image"} onChange={(e) => patch({ mediaKind: e.target.value as NodeData["mediaKind"] })} className={`mb-3 ${inputCls}`}>
                  <option value="image">Imagem</option>
                  <option value="video">Vídeo</option>
                  <option value="audio">Áudio</option>
                  <option value="document">Documento</option>
                </select>
              </>
            )}

            {/* TRANSFERIR */}
            {sd.kind === "transfer" && (
              <>
                <label className={labelCls}>Departamento de destino</label>
                <select value={sd.departmentId ?? ""} onChange={(e) => patch({ departmentId: e.target.value || undefined })} className={`mb-3 ${inputCls}`}>
                  <option value="">Fila geral</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </>
            )}

            {/* TAG */}
            {sd.kind === "tag" && (
              <>
                <label className={labelCls}>Tag a aplicar</label>
                <select value={sd.tagId ?? ""} onChange={(e) => patch({ tagId: e.target.value || undefined })} className={`mb-3 ${inputCls}`}>
                  <option value="">Selecione…</option>
                  {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </>
            )}

            {/* AGUARDAR */}
            {sd.kind === "wait" && (
              <>
                <label className={labelCls}>Modo</label>
                <select value={sd.mode ?? "reply"} onChange={(e) => patch({ mode: e.target.value as NodeData["mode"] })} className={`mb-2 ${inputCls}`}>
                  <option value="reply">Aguardar resposta do cliente</option>
                  <option value="delay">Atraso (segundos)</option>
                </select>
                {sd.mode === "delay" && (
                  <input type="number" value={sd.seconds ?? 0} onChange={(e) => patch({ seconds: Number(e.target.value) })} className={`mb-3 ${inputCls}`} />
                )}
              </>
            )}

            {selId !== "start" && (
              <button onClick={removeSelected} className="mt-3 flex items-center gap-1 text-xs font-medium text-danger hover:underline">
                <Trash2 size={13} /> Excluir nó
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
