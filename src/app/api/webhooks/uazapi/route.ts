import { NextResponse } from "next/server";
import { parseUazapiWebhook, parseUazapiStatus } from "@/lib/whatsapp/uazapi";
import { persistInbound, persistStatusUpdates } from "@/lib/whatsapp/inbound";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  // Rate limit: 300 req/min por IP (uazapi envia múltiplos eventos em rajadas).
  const rl = rateLimit(`uazapi:${getClientIp(request)}`, 300, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too Many Requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
    });
  }

  // Verifica token compartilhado (configurado no painel uazapi e em UAZAPI_WEBHOOK_TOKEN).
  const webhookToken = process.env.UAZAPI_WEBHOOK_TOKEN;
  if (webhookToken) {
    const incoming =
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      request.headers.get("x-webhook-token") ??
      new URL(request.url).searchParams.get("token");
    if (incoming !== webhookToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const payload = await request.json();
    const messages = parseUazapiWebhook(payload);
    if (messages.length) await persistInbound(messages);
    const updates = parseUazapiStatus(payload);
    if (updates.length) await persistStatusUpdates(updates);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("uazapi webhook error", e);
    return NextResponse.json({ ok: false }, { status: 200 }); // 200 evita reenvio em loop
  }
}
