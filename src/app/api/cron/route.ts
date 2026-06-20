import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

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
  let transferredCount = 0;

  // Carrega todas as orgs com settings de auto-close ou auto-transfer
  const { data: orgs } = await db.from("organizations").select("id, settings");

  for (const org of orgs ?? []) {
    const s = (org.settings ?? {}) as Record<string, unknown>;
    const closeCompanyMin = Number(s.auto_close_company_min) || 0;
    const closeClientMin = Number(s.auto_close_client_min) || 0;
    const closeQueue = !!s.auto_close_queue;
    const transferCompanyMin = Number(s.auto_transfer_company_min) || 0;
    const transferDeptId = String(s.auto_transfer_dept_id ?? "");

    // Encerramento automático
    if (closeCompanyMin > 0 || closeClientMin > 0) {
      const statuses = ["open"];
      if (closeQueue) statuses.push("queued");
      const cutoff = closeCompanyMin || closeClientMin;
      const threshold = new Date(now.getTime() - cutoff * 60000).toISOString();

      const { data: stale } = await db
        .from("conversations")
        .select("id")
        .eq("organization_id", org.id)
        .in("status", statuses)
        .lt("last_message_at", threshold)
        .limit(200);

      if (stale?.length) {
        const ids = stale.map((c: { id: string }) => c.id);
        await db.from("conversations")
          .update({ status: "closed", closed_at: now.toISOString() })
          .in("id", ids);
        closedCount += ids.length;
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

  return NextResponse.json({ ok: true, closed: closedCount, transferred: transferredCount });
}
