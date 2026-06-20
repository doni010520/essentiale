import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getProvider } from "@/lib/whatsapp";
import type { Channel } from "@/lib/types";

const DEFAULT_WARN =
  "Você ainda está por aí? 😊 Se não responder, vou encerrar este atendimento em alguns minutos. Quando precisar, é só me chamar de novo.";
const DEFAULT_GOODBYE =
  "Encerrei este atendimento por inatividade. Obrigado por falar com a *MVF NET*! 👋 Sempre que precisar, é só mandar uma mensagem.";

/** Envia uma mensagem do bot numa conversa e registra no banco. NÃO mexe em last_message_at. */
async function sendBotMessage(
  db: ReturnType<typeof createServiceClient>,
  channelsById: Map<string, Channel>,
  conv: { id: string; organization_id: string; channel_id: string; contact_phone: string; is_group: boolean },
  text: string,
) {
  const ch = channelsById.get(conv.channel_id);
  if (!ch) return;
  const to = conv.is_group && ch.type === "uazapi" ? `${conv.contact_phone}@g.us` : conv.contact_phone;
  const res = await getProvider(ch).sendText({ to, text }).catch(() => ({ externalId: undefined }));
  await db.from("messages").insert({
    organization_id: conv.organization_id,
    conversation_id: conv.id,
    direction: "out",
    sender_type: "bot",
    content_type: "text",
    body: text,
    external_id: res.externalId ?? null,
    status: "sent",
  });
}

/**
 * Cron endpoint — roda a cada minuto (ou via external cron).
 * Executa:
 * 1. Encerramento automático (empresa/cliente sem interação por X min)
 * 2. Transferência automática (sem interação → departamento)
 * Protegido por CRON_SECRET (env var).
 */
export async function GET(req: Request) {
  // Rate limit: máximo 10 req/min por IP (cron deve bater no máximo 1x/min).
  const rl = rateLimit(`cron:${getClientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  // Fail-closed: sem CRON_SECRET configurado, o endpoint permanece bloqueado.
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "No service key" }, { status: 500 });
  }

  const db = createServiceClient();
  const now = new Date();
  let closedCount = 0;
  let warnedCount = 0;
  let transferredCount = 0;

  // Carrega todas as orgs com settings de auto-close ou auto-transfer
  const { data: orgs } = await db.from("organizations").select("id, settings");

  for (const org of orgs ?? []) {
    const s = (org.settings ?? {}) as Record<string, unknown>;
    const transferCompanyMin = Number(s.auto_transfer_company_min) || 0;
    const transferDeptId = String(s.auto_transfer_dept_id ?? "");

    // ── Encerramento por inatividade (avisa, depois despede + fecha + reseta) ──
    // Padrão: avisa aos 10min, encerra aos 15min. Configurável por org.
    const inactivityEnabled = s.inactivity_enabled !== false; // default ligado
    const warnMin = s.inactivity_warn_min != null ? Number(s.inactivity_warn_min) : 10;
    const closeMin = s.inactivity_close_min != null ? Number(s.inactivity_close_min) : 15;
    const warnMsg = String(s.inactivity_warn_message || DEFAULT_WARN);
    const goodbyeMsg = String(s.inactivity_goodbye_message || DEFAULT_GOODBYE);

    if (inactivityEnabled && closeMin > 0) {
      // Canais da org (para enviar aviso/despedida).
      const { data: chans } = await db.from("channels").select("*").eq("organization_id", org.id);
      const channelsById = new Map<string, Channel>(((chans ?? []) as Channel[]).map((c) => [c.id, c]));
      const statuses = ["bot", "open", "queued"];
      const closeThreshold = new Date(now.getTime() - closeMin * 60000).toISOString();
      const sel = "id, organization_id, channel_id, status, contacts(phone, is_group)";
      type Row = {
        id: string; organization_id: string; channel_id: string; status: string;
        contacts: { phone: string; is_group: boolean } | { phone: string; is_group: boolean }[] | null;
      };
      const shape = (c: Row) => {
        const ct = Array.isArray(c.contacts) ? c.contacts[0] : c.contacts;
        return { id: c.id, organization_id: c.organization_id, channel_id: c.channel_id, contact_phone: ct?.phone ?? "", is_group: !!ct?.is_group };
      };

      // 1) ENCERRAR: ocioso há >= closeMin → despede, fecha e reseta o fluxo.
      const { data: toClose } = await db
        .from("conversations")
        .select(sel)
        .eq("organization_id", org.id)
        .in("status", statuses)
        .lt("last_message_at", closeThreshold)
        .limit(200);
      for (const c of (toClose ?? []) as Row[]) {
        const conv = shape(c);
        if (conv.contact_phone) await sendBotMessage(db, channelsById, conv, goodbyeMsg);
        await db.from("conversations")
          .update({ status: "closed", closed_at: now.toISOString(), bot_node_id: null, inactivity_warned_at: null })
          .eq("id", c.id);
        closedCount++;
      }

      // 2) AVISAR: ocioso entre warnMin e closeMin e ainda não avisado.
      if (warnMin > 0 && warnMin < closeMin) {
        const warnThreshold = new Date(now.getTime() - warnMin * 60000).toISOString();
        const { data: toWarn } = await db
          .from("conversations")
          .select(sel)
          .eq("organization_id", org.id)
          .in("status", statuses)
          .lt("last_message_at", warnThreshold)
          .gte("last_message_at", closeThreshold)
          .is("inactivity_warned_at", null)
          .limit(200);
        for (const c of (toWarn ?? []) as Row[]) {
          const conv = shape(c);
          if (conv.contact_phone) await sendBotMessage(db, channelsById, conv, warnMsg);
          // Marca o aviso SEM tocar em last_message_at (senão o relógio de ociosidade reinicia).
          await db.from("conversations").update({ inactivity_warned_at: now.toISOString() }).eq("id", c.id);
          warnedCount++;
        }
      }
    }

    // Transferência automática
    if (transferCompanyMin > 0 && transferDeptId) {
      const threshold = new Date(now.getTime() - transferCompanyMin * 60000).toISOString();
      const { data: stale } = await db
        .from("conversations")
        .select("id")
        .eq("organization_id", org.id)
        .eq("status", "open")
        .lt("last_message_at", threshold)
        .limit(200);

      if (stale?.length) {
        const ids = stale.map((c: { id: string }) => c.id);
        await db.from("conversations")
          .update({ department_id: transferDeptId, assigned_user_id: null, status: "queued" })
          .in("id", ids);
        transferredCount += ids.length;
      }
    }
  }

  return NextResponse.json({ ok: true, closed: closedCount, warned: warnedCount, transferred: transferredCount });
}
