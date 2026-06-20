import { notFound } from "next/navigation";
import { Scroll } from "@/components/scroll";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { getChannels } from "@/lib/data/channels";
import { sgpForOrg } from "@/lib/sgp";
import { PREVIEW_MODE } from "@/lib/mock";

export const revalidate = 0;

type Health = "ok" | "warn" | "down" | "na";
interface Item { name: string; status: Health; detail: string; hint?: string }
interface Group { title: string; items: Item[] }

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

function ageLabel(date: Date): string {
  const min = Math.floor((Date.now() - date.getTime()) / 60000);
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `há ${h}h`;
  return `há ${Math.floor(h / 24)} dias`;
}

export default async function SuperadminPage() {
  if (PREVIEW_MODE) notFound();

  const sb = await createClient();
  const session = await getSession();
  if (!session?.userId) notFound();

  // Gate: só superadmin (marcado em profiles.super_admin) enxerga esta rota.
  const { data: me } = await sb.from("profiles").select("super_admin").eq("id", session.userId).maybeSingle();
  if (!me?.super_admin) notFound();

  const orgId = session?.organization?.id ?? "";
  const groups: Group[] = [];

  // ── Infraestrutura ──
  let sbOk = false;
  try { const { error } = await sb.from("organizations").select("id").limit(1); sbOk = !error; } catch { sbOk = false; }
  groups.push({
    title: "Infraestrutura",
    items: [
      { name: "Aplicação (Next.js)", status: "ok", detail: "Online" },
      { name: "Banco de dados (Supabase)", status: sbOk ? "ok" : "down", detail: sbOk ? "Online" : "Indisponível" },
    ],
  });

  // ── Canais ──
  const channels = await getChannels();
  const connected = channels.filter((c) => c.status === "connected");
  groups.push({
    title: "Canais de WhatsApp",
    items: channels.length
      ? channels.map((c) => ({
          name: c.name,
          status: (c.status === "connected" ? "ok" : "down") as Health,
          detail: `${c.type === "meta_cloud" ? "API Oficial" : "UAZAPI"} · ${c.status === "connected" ? "Conectado" : c.status}`,
        }))
      : [{ name: "Nenhum canal cadastrado", status: "warn", detail: "Cadastre um canal em Canais" }],
  });

  // ── Recebimento de mensagens (webhook) ──
  const { data: lastIn } = await sb.from("messages").select("created_at").eq("direction", "in").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const lastInAt = lastIn?.created_at ? new Date(lastIn.created_at) : null;
  const inAgeH = lastInAt ? (Date.now() - lastInAt.getTime()) / 3600000 : Infinity;
  let webhookStatus: Health = "ok";
  let webhookDetail = lastInAt ? `Última mensagem recebida ${ageLabel(lastInAt)}` : "Nenhuma mensagem recebida ainda";
  let webhookHint: string | undefined;
  if (connected.length === 0) { webhookStatus = "na"; webhookDetail = "Sem canal conectado"; }
  else if (!lastInAt) { webhookStatus = "warn"; webhookHint = "Se já deveria ter recebido mensagens, verifique o webhook do canal."; }
  else if (inAgeH > 48) { webhookStatus = "down"; webhookHint = "Faz muito tempo sem receber. Provável webhook desconectado ou token do canal expirado."; }
  else if (inAgeH > 24) { webhookStatus = "warn"; webhookHint = "Sem mensagens recebidas há mais de 24h — confira se o webhook continua ativo."; }
  groups.push({ title: "Recebimento (webhook)", items: [{ name: "Mensagens recebidas", status: webhookStatus, detail: webhookDetail, hint: webhookHint }] });

  // ── Atendimento por IA ──
  const openaiOk = !!process.env.OPENAI_API_KEY;
  const [{ count: agentsActive }, { data: autos }] = await Promise.all([
    sb.from("ai_agents").select("id", { count: "exact", head: true }).eq("active", true),
    sb.from("automations").select("flow").eq("active", true),
  ]);
  const hasAiNode = (autos ?? []).some((a) => {
    const nodes = (a.flow as { nodes?: { data?: { kind?: string } }[] } | null)?.nodes ?? [];
    return nodes.some((n) => n?.data?.kind === "ai");
  });
  groups.push({
    title: "Atendimento por IA",
    items: [
      { name: "Chave da OpenAI", status: openaiOk ? "ok" : "down", detail: openaiOk ? "Configurada" : "Ausente", hint: openaiOk ? undefined : "Defina OPENAI_API_KEY no ambiente do app (Easypanel) — sem ela a IA não responde." },
      { name: "Agente de IA ativo", status: (agentsActive ?? 0) > 0 ? "ok" : "warn", detail: `${agentsActive ?? 0} ativo(s)` },
      { name: "Automação com IA ativa", status: hasAiNode ? "ok" : "warn", detail: hasAiNode ? "Sim" : "Nenhuma automação ativa com nó de IA" },
    ],
  });

  // ── Integração SGP ──
  const { data: sgpInt } = await sb.from("integrations").select("id").eq("type", "sgp").eq("active", true).limit(1).maybeSingle();
  let sgpStatus: Health = "na";
  let sgpDetail = "Não configurada";
  if (sgpInt) {
    try {
      const sgp = await sgpForOrg(sb as unknown as Parameters<typeof sgpForOrg>[0], orgId);
      if (sgp) {
        await withTimeout(sgp.consultarCliente({ cpfcnpj: "00000000000" }), 7000);
        sgpStatus = "ok"; sgpDetail = "Respondendo";
      } else { sgpStatus = "warn"; sgpDetail = "Configurada, sem credenciais válidas"; }
    } catch {
      sgpStatus = "down"; sgpDetail = "Não respondeu (timeout/erro)";
    }
  }
  groups.push({ title: "Integração SGP", items: [{ name: "API do SGP", status: sgpStatus, detail: sgpDetail }] });

  // ── Atividade (24h) ──
  const since = new Date(Date.now() - 24 * 3600000).toISOString();
  const [{ count: msgs24 }, { count: convOpen }] = await Promise.all([
    sb.from("messages").select("id", { count: "exact", head: true }).gte("created_at", since),
    sb.from("conversations").select("id", { count: "exact", head: true }).in("status", ["queued", "open", "bot"]),
  ]);
  groups.push({
    title: "Atividade",
    items: [
      { name: "Mensagens nas últimas 24h", status: "ok", detail: String(msgs24 ?? 0) },
      { name: "Conversas em andamento", status: "ok", detail: String(convOpen ?? 0) },
    ],
  });

  const all = groups.flatMap((g) => g.items);
  const downs = all.filter((i) => i.status === "down").length;
  const warns = all.filter((i) => i.status === "warn").length;
  const overall: Health = downs > 0 ? "down" : warns > 0 ? "warn" : "ok";

  return (
    <Scroll>
      <PageHeader title="Painel do Superadmin" subtitle="Saúde das peças-chave do sistema (acesso restrito)." />

      <div className={`mb-5 flex items-center gap-3 rounded-card border p-4 ${
        overall === "ok" ? "border-green-200 bg-green-50" : overall === "warn" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"
      }`}>
        <Dot status={overall} big />
        <div>
          <p className={`text-sm font-semibold ${overall === "ok" ? "text-green-700" : overall === "warn" ? "text-amber-700" : "text-red-700"}`}>
            {overall === "ok" ? "Tudo operacional" : overall === "warn" ? "Atenção: itens para revisar" : "Há problemas que exigem ação"}
          </p>
          <p className="text-xs text-ink-soft">{downs} crítico(s) · {warns} alerta(s) · {all.length - downs - warns} ok</p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.title} className="rounded-card border border-border bg-surface p-4 shadow-card">
            <h3 className="mb-3 text-sm font-semibold text-ink">{g.title}</h3>
            <div className="space-y-2.5">
              {g.items.map((it) => (
                <div key={it.name} className="flex items-start gap-2.5">
                  <Dot status={it.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-ink">{it.name}</p>
                      <span className={`shrink-0 text-xs font-medium ${labelColor(it.status)}`}>{it.detail}</span>
                    </div>
                    {it.hint && <p className="mt-0.5 text-[11px] text-ink-soft">{it.hint}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Scroll>
  );
}

function labelColor(s: Health): string {
  return s === "ok" ? "text-green-600" : s === "warn" ? "text-amber-600" : s === "down" ? "text-red-600" : "text-ink-soft";
}

function Dot({ status, big }: { status: Health; big?: boolean }) {
  const color = status === "ok" ? "bg-green-500" : status === "warn" ? "bg-amber-500" : status === "down" ? "bg-red-500" : "bg-gray-300";
  return <span className={`mt-1 shrink-0 rounded-full ${big ? "h-3.5 w-3.5" : "h-2.5 w-2.5"} ${color}`} />;
}
