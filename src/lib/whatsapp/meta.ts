import type { Channel } from "@/lib/types";
import type {
  ChannelProvider,
  ConnectResult,
  SendMediaParams,
  SendTextParams,
  InboundMessage,
} from "./types";

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v23.0"}`;

interface MetaCreds {
  phone_number_id?: string;
  access_token?: string;
  waba_id?: string;
}

export class MetaProvider implements ChannelProvider {
  private phoneNumberId?: string;
  private accessToken?: string;

  constructor(channel: Channel) {
    const c = channel.credentials as MetaCreds;
    this.phoneNumberId = c?.phone_number_id ?? channel.external_id ?? undefined;
    this.accessToken = c?.access_token || process.env.META_ACCESS_TOKEN;
  }

  private async graph(path: string, body: unknown) {
    const res = await fetch(`${GRAPH}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Meta ${path} -> ${res.status} ${await res.text()}`);
    return res.json();
  }

  // Meta não usa QR/código: a "conexão" é a validação das credenciais.
  async connect(_phone?: string): Promise<ConnectResult> {
    if (!this.phoneNumberId || !this.accessToken) {
      return { status: "error" };
    }
    return { status: "connected", externalId: this.phoneNumberId };
  }

  async status(): Promise<Channel["status"]> {
    return this.phoneNumberId && this.accessToken ? "connected" : "disconnected";
  }

  async sendText({ to, text }: SendTextParams) {
    const r = await this.graph(`${this.phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    });
    return { externalId: r?.messages?.[0]?.id };
  }

  async sendMedia({ to, url, caption, kind }: SendMediaParams) {
    const r = await this.graph(`${this.phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: kind,
      [kind]: { link: url, caption },
    });
    return { externalId: r?.messages?.[0]?.id };
  }

  /**
   * Envia uma mensagem de MODELO (template) — único tipo permitido fora da
   * janela de 24h em canais Meta oficiais. `components` no formato da Graph API.
   */
  async sendTemplate({ to, name, language, components }: {
    to: string;
    name: string;
    language: string;
    components?: unknown[];
  }) {
    const r = await this.graph(`${this.phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name,
        language: { code: language || "pt_BR" },
        ...(components && components.length ? { components } : {}),
      },
    });
    return { externalId: r?.messages?.[0]?.id };
  }
}

/** Lista os modelos (templates) de uma WABA na Meta. */
export async function listMetaTemplates(wabaId: string, token: string) {
  const res = await fetch(
    `${GRAPH}/${wabaId}/message_templates?fields=name,status,language,category,components&limit=200`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`listMetaTemplates: ${JSON.stringify(json)}`);
  return (json?.data ?? []) as Array<{
    name: string;
    status: string;
    language: string;
    category?: string;
    components?: unknown[];
  }>;
}

// ===================== Coexistência / Onboarding (Embedded Signup) =====================

const APP_ID = () => process.env.META_APP_ID || "";
const APP_SECRET = () => process.env.META_APP_SECRET || "";

/** Troca o `code` do Embedded Signup por um token de System User do cliente. */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const url =
    `${GRAPH}/oauth/access_token?client_id=${APP_ID()}` +
    `&client_secret=${APP_SECRET()}&code=${encodeURIComponent(code)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || !json?.access_token) {
    throw new Error(`exchangeCodeForToken: ${JSON.stringify(json)}`);
  }
  return json.access_token as string;
}

/** Inscreve nosso app na WABA do cliente (ativa os webhooks da conta). */
export async function subscribeApp(wabaId: string, token: string) {
  const res = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`subscribeApp: ${JSON.stringify(json)}`);
  return json;
}

/**
 * Define o webhook no nível do número (override) — necessário para receber
 * `smb_message_echoes` (mensagens enviadas pelo app WhatsApp Business).
 * Confirme o shape exato na doc da Meta no momento da implantação.
 */
export async function setPhoneWebhook(phoneNumberId: string, token: string) {
  const base = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
  const res = await fetch(`${GRAPH}/${phoneNumberId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      webhook_configuration: {
        override_callback_uri: `${base}/api/webhooks/meta`,
        verify_token: process.env.META_VERIFY_TOKEN || "",
      },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`setPhoneWebhook: ${JSON.stringify(json)}`);
  return json;
}

/** Busca os números (e seus IDs) de uma WABA. */
export async function getPhoneNumbers(wabaId: string, token: string) {
  const res = await fetch(`${GRAPH}/${wabaId}/phone_numbers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`getPhoneNumbers: ${JSON.stringify(json)}`);
  return (json?.data ?? []) as Array<{ id: string; display_phone_number: string; verified_name?: string }>;
}

/** Eco de mensagem enviada pelo atendente no app WhatsApp Business (saída). */
export interface OutboundEcho {
  channelExternalId: string;
  to: string;
  contentType: InboundMessage["contentType"];
  body?: string;
  externalId?: string;
  timestamp?: string;
}

/** Mudança no catálogo de contatos do app Business. */
export interface ContactStateSync {
  channelExternalId: string;
  phone: string;
  name?: string;
  action: "add" | "update" | "remove" | string;
}

/** smb_message_echoes → mensagens de saída enviadas pelo celular. */
export function parseMetaEchoes(payload: any): OutboundEcho[] {
  const out: OutboundEcho[] = [];
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      if (change?.field !== "smb_message_echoes") continue;
      const value = change?.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      for (const m of value?.message_echoes ?? []) {
        out.push({
          channelExternalId: phoneNumberId,
          to: String(m?.to ?? "").replace(/\D/g, ""),
          contentType: (m?.type ?? "text") as InboundMessage["contentType"],
          body: m?.text?.body ?? m?.[m?.type]?.caption,
          externalId: m?.id,
          timestamp: m?.timestamp,
        });
      }
    }
  }
  return out;
}

/** smb_app_state_sync → contatos adicionados/alterados/removidos. */
export function parseMetaStateSync(payload: any): ContactStateSync[] {
  const out: ContactStateSync[] = [];
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      if (change?.field !== "smb_app_state_sync") continue;
      const value = change?.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      for (const s of value?.state_sync ?? []) {
        if (s?.type !== "contact") continue;
        out.push({
          channelExternalId: phoneNumberId,
          phone: String(s?.contact?.phone_number ?? "").replace(/\D/g, ""),
          name: s?.contact?.full_name ?? s?.contact?.first_name,
          action: s?.action ?? "add",
        });
      }
    }
  }
  return out;
}

/** Normaliza o webhook da Meta Cloud API em mensagens internas. */
export function parseMetaWebhook(payload: any): InboundMessage[] {
  const out: InboundMessage[] = [];
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      const contactName = value?.contacts?.[0]?.profile?.name;
      for (const m of value?.messages ?? []) {
        out.push({
          channelExternalId: phoneNumberId,
          from: String(m?.from ?? "").replace(/\D/g, ""),
          contactName,
          contentType: (m?.type ?? "text") as InboundMessage["contentType"],
          body: m?.text?.body ?? m?.[m?.type]?.caption,
          mediaUrl: undefined, // mídia da Meta requer download via /media (etapa posterior)
          externalId: m?.id,
          timestamp: m?.timestamp,
          // Citação/resposta: a Cloud API só envia o id da mensagem citada (sem o conteúdo).
          // O inbound resolve o trecho (excerpt) buscando essa mensagem no nosso banco.
          replyTo: m?.context?.id ? { externalId: String(m.context.id) } : undefined,
        });
      }
    }
  }
  return out;
}
