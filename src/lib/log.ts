import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

type LogLevel = "info" | "warn" | "error";

/**
 * Grava um evento na tabela `app_logs` (acessível no /superadmin e via REST),
 * pra acompanhar o sistema sem depender dos logs do Easypanel.
 *
 * Nunca lança: se o log falhar, o fluxo principal segue. Use sem await (fire-and-forget)
 * quando não quiser adicionar latência: `void logEvent(...)`.
 */
export async function logEvent(
  level: LogLevel,
  source: string,
  message: string,
  meta?: Record<string, unknown>,
  organizationId?: string | null,
): Promise<void> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
    const db = createServiceClient();
    await db.from("app_logs").insert({
      level,
      source,
      message: message.slice(0, 2000),
      meta: meta ?? null,
      organization_id: organizationId ?? null,
    });
  } catch {
    /* logging nunca derruba o fluxo */
  }
}
