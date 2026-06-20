import type { Channel } from "@/lib/types";
import type {
  ChannelProvider,
  ConnectResult,
  SendMediaParams,
  SendTextParams,
  InboundMessage,
} from "./types";

// Cliente UAZAPI. Os caminhos seguem o padrão da uazapi.com; confirme contra a
// sua instância/documentação se a versão divergir (são facilmente ajustáveis aqui).
interface UazapiCreds {
  token?: string; // token da instância
}

export class UazapiProvider implements ChannelProvider {
  private host: string;
  private token?: string;
  private channel: Channel;

  constructor(channel: Channel) {
    this.channel = channel;
    this.host = (process.env.UAZAPI_HOST || "").replace(/\/$/, "");
    this.token = (channel.credentials as UazapiCreds)?.token;
  }

  private async req(path: string, init: RequestInit = {}, useAdmin = false) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string>),
    };
    if (useAdmin) headers["admintoken"] = process.env.UAZAPI_ADMIN_TOKEN || "";
    else if (this.token) headers["token"] = this.token;

    const res = await fetch(`${this.host}${path}`, { ...init, headers });
    if (!res.ok) throw new Error(`UAZAPI ${path} -> ${res.status}`);
    return res.json();
  }

  /** Cria a instância (se necessário) e retorna QR Code ou código de pareamento. */
  async connect(phone?: string): Promise<ConnectResult> {
    if (!this.token) {
      const created = await this.req(
        "/instance/init",
        { method: "POST", body: JSON.stringify({ name: this.channel.name }) },
        true,
      );
      this.token = created?.token ?? created?.instance?.token;
    }
    // Configura o webhook da instância para apontar para o nosso app (best-effort).
    await this.setWebhook().catch((e) => console.warn("uazapi setWebhook", e?.message));

    const digits = (phone || "").replace(/\D/g, "");
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const read = (o: any) => {
      const i = o?.instance ?? o ?? {};
      return {
        connected: !!(i.connected || i.status === "connected" || o?.loggedIn),
        qr: i.qrcode ?? i.qrCode,
        code: i.paircode ?? i.pairCode ?? i.code,
      };
    };
    const body = digits ? JSON.stringify({ phone: digits }) : "{}";
    const statusOf = (o: any) => (o?.instance ?? o ?? {})?.status;
    const dbg: string[] = [`mode=${digits ? "code(" + digits.length + "d)" : "qr"}`];

    // A UAZAPI só emite código/QR a partir de um estado LIMPO. Cada tentativa:
    // desconecta → confirma "disconnected" → aguarda → connect. Repete até obter o código/QR.
    let r = { connected: false, qr: undefined as string | undefined, code: undefined as string | undefined };
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.req("/instance/disconnect", { method: "POST", body: "{}" }).catch(() => {});
      // Confirma que desconectou de fato antes de reconectar (quebra no 1º status limpo).
      for (let j = 0; j < 4; j++) {
        await sleep(500);
        const s = await this.req("/instance/status").catch(() => null);
        const st = statusOf(s) ?? "";
        if (st === "disconnected" || st === "") break;
      }
      await sleep(800); // folga para o socket fechar

      const conn = await this.req("/instance/connect", { method: "POST", body }).catch((e) => {
        dbg.push(`connect#${attempt}:ERR ${e?.message}`);
        return null;
      });
      if (conn) {
        r = read(conn);
        dbg.push(`connect#${attempt}:st=${statusOf(conn)} code=${r.code ? "Y" : "n"} qr=${r.qr ? "Y" : "n"}`);
      }

      // O código/QR pode vir 1-2s depois — consulta o status até aparecer.
      for (let i = 0; i < 4 && !r.connected && !(digits ? r.code : r.qr); i++) {
        await sleep(1200);
        const s = await this.req("/instance/status").catch(() => null);
        if (s) {
          r = read(s);
          dbg.push(`poll#${attempt}.${i}:st=${statusOf(s)} code=${r.code ? "Y" : "n"} qr=${r.qr ? "Y" : "n"}`);
        }
      }

      if (r.connected || (digits ? r.code : r.qr)) break;
    }

    return {
      status: r.connected ? "connected" : "connecting",
      qrCode: r.qr || undefined,
      pairCode: r.code || undefined,
      externalId: this.token,
      debug: dbg.join(" | "),
    };
  }

  /** Desconecta a instância (sem apagá-la). */
  async disconnect(): Promise<void> {
    if (!this.token) return;
    await this.req("/instance/disconnect", { method: "POST", body: "{}" }).catch(() => {});
  }

  /** Apaga a instância na UAZAPI (DELETE /instance, com token). */
  async deleteInstance(): Promise<void> {
    if (!this.token) return;
    await this.req("/instance", { method: "DELETE" }).catch(() => {});
  }

  /** Aponta o webhook da instância para /api/webhooks/uazapi. */
  private async setWebhook() {
    const base = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
    if (!base || !this.token) return;
    await this.req("/webhook", {
      method: "POST",
      body: JSON.stringify({
        enabled: true,
        url: `${base}/api/webhooks/uazapi`,
        events: ["messages", "messages_update", "connection"],
        excludeMessages: ["wasSentByApi"],
      }),
    });
  }

  async status(): Promise<Channel["status"]> {
    const o = await this.req("/instance/status");
    const i = (o?.instance ?? o ?? {}) as { status?: string; connected?: boolean };
    if (o?.connected || i.connected || i.status === "connected") return "connected";
    if (i.status === "connecting") return "connecting";
    return "disconnected";
  }

  async sendText({ to, text, replyId, mentions }: SendTextParams) {
    const r = await this.req("/send/text", {
      method: "POST",
      body: JSON.stringify({
        number: to,
        text,
        ...(replyId ? { replyid: replyId } : {}),
        ...(mentions && mentions.length ? { mentions: mentions.join(",") } : {}),
      }),
    });
    return { externalId: r?.id ?? r?.messageId ?? r?.messageid };
  }

  async sendMedia({ to, url, caption, kind, replyId }: SendMediaParams) {
    const r = await this.req("/send/media", {
      method: "POST",
      body: JSON.stringify({ number: to, type: kind, file: url, text: caption, ...(replyId ? { replyid: replyId } : {}) }),
    });
    return { externalId: r?.id ?? r?.messageId ?? r?.messageid };
  }

  /** Reage a uma mensagem (text vazio remove). POST /message/react {number,id,text}. */
  async reactMessage(to: string, externalId: string, emoji: string): Promise<void> {
    await this.req("/message/react", {
      method: "POST",
      body: JSON.stringify({ number: to, id: externalId, text: emoji }),
    });
  }

  /** Edita o texto de uma mensagem. POST /message/edit {id,text}. */
  async editMessage(externalId: string, text: string): Promise<void> {
    await this.req("/message/edit", { method: "POST", body: JSON.stringify({ id: externalId, text }) });
  }

  /** Apaga uma mensagem para todos. POST /message/delete {id}. */
  async deleteMessage(externalId: string): Promise<void> {
    await this.req("/message/delete", { method: "POST", body: JSON.stringify({ id: externalId }) });
  }

  /** Marca mensagens como lidas. POST /message/markread {id:[...]}. */
  async markRead(externalIds: string[]): Promise<void> {
    if (!externalIds.length) return;
    await this.req("/message/markread", { method: "POST", body: JSON.stringify({ id: externalIds }) });
  }

  /** Envia uma localização. POST /send/location {number,name,address,latitude,longitude}. */
  async sendLocation(to: string, loc: { name?: string; address?: string; latitude: number; longitude: number }): Promise<{ externalId?: string }> {
    const r = await this.req("/send/location", {
      method: "POST",
      body: JSON.stringify({ number: to, name: loc.name ?? "", address: loc.address ?? "", latitude: loc.latitude, longitude: loc.longitude }),
    });
    return { externalId: r?.id ?? r?.messageId ?? r?.messageid };
  }

  /** Envia um contato (vCard). POST /send/contact {number,fullName,phoneNumber}. */
  async sendContact(to: string, contact: { fullName: string; phoneNumber: string }): Promise<{ externalId?: string }> {
    const r = await this.req("/send/contact", {
      method: "POST",
      body: JSON.stringify({ number: to, fullName: contact.fullName, phoneNumber: contact.phoneNumber }),
    });
    return { externalId: r?.id ?? r?.messageId ?? r?.messageid };
  }

  /** Informações completas de um grupo: nome, descrição e participantes. */
  async getGroupInfo(groupJid: string): Promise<{
    name?: string;
    description?: string;
    owner?: string;
    participants: { phone: string; lid: string; isAdmin: boolean }[];
  }> {
    try {
      const r = (await this.req("/group/info", {
        method: "POST",
        body: JSON.stringify({ groupjid: groupJid }),
      })) as Record<string, any>;
      const parts = (r?.Participants ?? r?.participants ?? []) as any[];
      return {
        name: r?.Name ?? r?.name ?? undefined,
        description: r?.Topic ?? r?.topic ?? undefined,
        owner: String(r?.OwnerPN ?? "").replace(/@.*/, "").replace(/\D/g, "") || undefined,
        participants: parts.map((p: any) => ({
          phone: String(p?.PhoneNumber ?? p?.PN ?? "").replace(/@.*/, "").replace(/\D/g, ""),
          lid: String(p?.LID ?? p?.JID ?? "").replace(/@.*/, "").replace(/\D/g, ""),
          isAdmin: !!(p?.IsAdmin || p?.IsSuperAdmin),
        })),
      };
    } catch {
      return { participants: [] };
    }
  }

  /** Participantes de um grupo (LID + telefone real). POST /group/info {groupjid}. */
  async getGroupParticipants(groupJid: string): Promise<{ lid: string; phone: string }[]> {
    try {
      const r = (await this.req("/group/info", {
        method: "POST",
        body: JSON.stringify({ groupjid: groupJid }),
      })) as { Participants?: any[]; participants?: any[] };
      const parts = r?.Participants ?? r?.participants ?? [];
      return parts
        .map((p: any) => ({
          lid: String(p?.LID ?? p?.JID ?? "").replace(/@.*/, "").replace(/\D/g, ""),
          phone: String(p?.PhoneNumber ?? p?.PN ?? "").replace(/@.*/, "").replace(/\D/g, ""),
        }))
        .filter((p) => p.lid && p.phone);
    } catch {
      return [];
    }
  }

  /** Remove um participante do grupo. POST /group/updateParticipants */
  async removeGroupParticipant(groupJid: string, phone: string): Promise<boolean> {
    try {
      await this.req("/group/updateParticipants", {
        method: "POST",
        body: JSON.stringify({
          groupjid: groupJid,
          action: "remove",
          participants: [`${phone.replace(/\D/g, "")}@s.whatsapp.net`],
        }),
      });
      return true;
    } catch (e) {
      console.error("removeGroupParticipant", (e as Error)?.message);
      return false;
    }
  }

  /**
   * Baixa/descriptografa uma mídia recebida e retorna a URL hospedada na UAZAPI
   * (`/files/...`), o mimetype e, para áudio, a transcrição automática.
   * Endpoint: POST /message/download { id }.
   */
  async downloadMedia(externalId: string): Promise<{ url?: string; mimetype?: string; transcription?: string }> {
    try {
      const r = (await this.req("/message/download", {
        method: "POST",
        body: JSON.stringify({ id: externalId }),
      })) as Record<string, unknown>;
      return {
        url: (r.fileURL as string) ?? (r.url as string) ?? undefined,
        mimetype: (r.mimetype as string) ?? undefined,
        transcription: (r.transcription as string) || undefined,
      };
    } catch {
      return {};
    }
  }

  /**
   * Retorna a URL da foto de perfil do contato.
   * Endpoint do uazapiGO: POST /chat/GetNameAndImageURL { number, preview }.
   * Confirme o path/campos no swagger (/docs) da sua instância — variam por versão.
   * Tenta também /chat/getProfileImage como fallback.
   */
  async getProfilePicture(phone: string): Promise<string | null> {
    const tryParse = (r: unknown): string | null => {
      const o = (r ?? {}) as Record<string, unknown>;
      return (
        (o.imgUrl as string) ?? (o.imageUrl as string) ?? (o.image as string) ??
        (o.url as string) ?? (o.profilePicUrl as string) ?? (o.eurl as string) ?? null
      );
    };
    try {
      const r = await this.req("/chat/GetNameAndImageURL", {
        method: "POST",
        body: JSON.stringify({ number: phone, preview: false }),
      });
      const url = tryParse(r);
      if (url) return url;
    } catch { /* tenta fallback */ }
    try {
      const r = await this.req("/chat/getProfileImage", {
        method: "POST",
        body: JSON.stringify({ number: phone }),
      });
      return tryParse(r);
    } catch {
      return null;
    }
  }

  /**
   * Nome + imagem de um chat (contato ou grupo). Para grupos passe o JID
   * completo (`<id>@g.us`). Best-effort: retorna o que conseguir.
   */
  async getChatInfo(jid: string): Promise<{ name?: string; image?: string }> {
    try {
      const r = (await this.req("/chat/GetNameAndImageURL", {
        method: "POST",
        body: JSON.stringify({ number: jid, preview: false }),
      })) as Record<string, unknown>;
      const name =
        (r.name as string) ?? (r.Name as string) ?? (r.subject as string) ??
        (r.verifiedName as string) ?? (r.pushName as string) ?? undefined;
      const image =
        (r.imgUrl as string) ?? (r.imageUrl as string) ?? (r.image as string) ??
        (r.url as string) ?? (r.profilePicUrl as string) ?? (r.eurl as string) ?? undefined;
      return { name: name || undefined, image: image || undefined };
    } catch {
      return {};
    }
  }
}

/** Detecta se a mensagem veio de um GRUPO (chatid @g.us ou flag isGroup). */
function isGroupMessage(m: any): boolean {
  if (m?.isGroup === true) return true;
  const jid = String(
    m?.chatid ?? m?.chat ?? m?.remoteJid ?? m?.key?.remoteJid ?? m?.content?.key?.remoteJID ?? m?.from ?? "",
  );
  return /@g\.us/i.test(jid);
}

// Tipos que não devem virar conversa/mensagem de atendimento.
const SKIP_TYPES = new Set([
  "reactionmessage", "reaction", "protocolmessage", "senderkeydistributionmessage",
  "pollupdatemessage", "ephemeralmessage",
]);

/**
 * Número real do CONTATO numa conversa 1:1.
 * No WhatsApp novo o `sender` costuma ser um @lid (id privado), mas o `chatid`
 * traz o número real (`557181937254@s.whatsapp.net`). Então priorizamos o chatid.
 */
function contactNumber(m: any): string {
  const jid = String(
    m?.chatid ?? m?.chat ?? m?.key?.remoteJid ?? m?.content?.key?.remoteJID ?? m?.from ?? m?.sender ?? "",
  );
  // Ignora @lid (não disca) — se só houver lid, devolve vazio e a msg é descartada.
  if (/@lid/i.test(jid) && !/@s\.whatsapp\.net/i.test(jid)) {
    const alt = String(m?.sender ?? m?.from ?? "");
    if (/@s\.whatsapp\.net/i.test(alt)) return alt.replace(/@.*/, "").replace(/\D/g, "");
    return "";
  }
  return jid.replace(/@.*/, "").replace(/\D/g, "");
}

/** ID do grupo (dígitos do JID @g.us). */
function groupId(m: any): string {
  const jid = String(
    m?.chatid ?? m?.chat ?? m?.key?.remoteJid ?? m?.content?.key?.remoteJID ?? "",
  );
  return jid.replace(/@.*/, "").replace(/\D/g, "");
}

/** Nome do grupo, se vier no payload. */
function groupName(m: any): string | undefined {
  return m?.chatName ?? m?.groupName ?? m?.groupSubject ?? m?.subject ?? m?.group?.subject ?? undefined;
}

/** Nome de quem enviou (participante do grupo ou remetente 1:1). */
function authorName(m: any): string | undefined {
  return m?.senderName ?? m?.pushName ?? m?.notifyName ?? undefined;
}

/** Telefone real do autor (participante do grupo) — vem em sender_pn. @lid não serve. */
function authorPhone(m: any): string | undefined {
  for (const f of [m?.sender_pn, m?.senderPn, m?.sender, m?.participant_pn]) {
    const s = String(f ?? "");
    if (/@s\.whatsapp\.net/i.test(s)) return s.replace(/@.*/, "").replace(/\D/g, "");
  }
  return undefined;
}

const isReaction = (m: any) => /reaction/i.test(String(m?.type ?? m?.messageType ?? ""));

/** Extrai a citação (reply) do contextInfo, se houver. */
function extractReply(m: any): InboundMessage["replyTo"] | undefined {
  const ci = m?.content?.contextInfo ?? m?.contextInfo ?? m?.quoted?.contextInfo;
  const id = ci?.stanzaID ?? ci?.stanzaId ?? ci?.quotedMessageId ?? ci?.id;
  if (!id && !ci?.quotedMessage) return undefined;
  const q = ci?.quotedMessage ?? {};
  const excerpt = q.conversation ?? q.text ?? q.caption ?? q?.extendedTextMessage?.text ?? undefined;
  // Só usa o nome do autor citado se for um NOME (não um @lid/número, que vira lixo).
  const rawAuthor = ci?.pushName ?? ci?.participantName ?? "";
  const author = rawAuthor && !/^\d+$/.test(String(rawAuthor).replace(/@.*/, "")) ? String(rawAuthor) : undefined;
  return { externalId: id ? String(id) : undefined, excerpt, author };
}

// Há sinal de reação? (campo dedicado m.reaction OU messageType "ReactionMessage")
const hasReaction = (m: any) =>
  isReaction(m) || (typeof m?.reaction === "string" && m.reaction.trim() !== "") || (!!m?.reaction && typeof m.reaction === "object");

// Body é só um ID de mensagem (lixo de reação/citação mal interpretada)?
const isBareId = (s?: string) => !!s && /^[0-9A-Fa-f]{15,}$/.test(s.trim());

/** Normaliza o payload de webhook da UAZAPI em mensagens internas. */
export function parseUazapiWebhook(payload: any): InboundMessage[] {
  const msgs = payload?.messages ?? (payload?.message ? [payload.message] : []);
  const token = payload?.token ?? payload?.instance ?? payload?.owner ?? "";
  const chat = payload?.chat ?? {};
  const chatPhoto = chat?.image || chat?.imagePreview || undefined;
  const chatName = chat?.name || chat?.wa_name || undefined;
  return (Array.isArray(msgs) ? msgs : [])
    .filter((m: any) => hasReaction(m) || !SKIP_TYPES.has(String(m?.messageType ?? m?.mediaType ?? m?.type ?? "").toLowerCase()))
    .map((m: any): InboundMessage => {
      const group = isGroupMessage(m);
      const base = {
        channelExternalId: token,
        from: group ? groupId(m) : contactNumber(m),
        isGroup: group,
        fromMe: !!m?.fromMe,
        authorName: group ? authorName(m) : undefined,
        authorPhone: group ? authorPhone(m) : undefined,
        authorLid: group ? String(m?.sender ?? "").replace(/@.*/, "") || undefined : undefined,
        chatJid: group ? String(m?.chatid ?? m?.chat ?? "") || undefined : undefined,
        chatPhoto,
        chatName,
        timestamp: m?.timestamp
          ? String(m.timestamp)
          : m?.messageTimestamp
            ? String(m.messageTimestamp)
            : undefined,
      };
      // Evento de reação: NUNCA vira balão — anexa o emoji à msg-alvo (ou é descartado).
      // Formato UAZAPI: { type:"reaction", text:"🙏" (emoji), reaction:"<ID alvo>", content:{key:{ID:"<ID alvo>"},text:"🙏"} }
      if (hasReaction(m)) {
        const r = m?.reaction;
        const emoji =
          m?.content?.text ?? m?.text ?? (typeof r === "string" && !isBareId(r) ? r : "") ?? (typeof r === "object" ? r?.text ?? r?.emoji : "") ?? "";
        const targetId =
          m?.content?.key?.ID ?? m?.content?.key?.id ??
          (typeof r === "string" && isBareId(r) ? r : "") ??
          (typeof r === "object" ? r?.key?.ID ?? r?.key?.id ?? r?.id : "") ??
          m?.reactionMessage?.key?.ID ?? "";
        return { ...base, contentType: "text", reaction: { targetExternalId: String(targetId || ""), emoji: String(emoji || "") } };
      }
      // IMPORTANTE: o tipo real está em mediaType/messageType (type costuma ser só "media"/"text").
      return {
        ...base,
        contactName: group ? chatName ?? groupName(m) : authorName(m),
        contentType: mapType(m?.mediaType ?? m?.messageType ?? m?.type),
        body: m?.text ?? m?.body ?? m?.caption ?? m?.content?.text ?? m?.content?.caption,
        mediaUrl: m?.file ?? m?.mediaUrl ?? m?.fileURL,
        externalId: m?.id ?? m?.messageId ?? m?.messageid,
        replyTo: extractReply(m),
      };
    })
    .filter((m: InboundMessage) => !!m.from) // precisa de número/id de contato válido
    // Descarta "texto" que seja só um ID de mensagem (lixo de reação/citação) — mantém mídia e reações.
    .filter((m: InboundMessage) => !!m.reaction || m.contentType !== "text" || (!!m.body && m.body.trim() !== "" && !isBareId(m.body)));
}

/**
 * Extrai atualizações de status (entregue/lido) de eventos messages_update.
 * Só roda quando o evento indica atualização/ack, para não confundir com mensagens novas.
 */
export function parseUazapiStatus(payload: any): { externalId: string; status: "sent" | "delivered" | "read" }[] {
  const rank = (raw: string): "sent" | "delivered" | "read" | undefined => {
    const s = raw.toLowerCase();
    if (/read|played/.test(s)) return "read";
    if (/deliv/.test(s)) return "delivered";
    if (/sent|server/.test(s)) return "sent";
    return undefined;
  };

  // Formato real do webhook: { EventType:"messages_update", type:"ReadReceipt",
  // state:"Read"|"Delivered", event:{ MessageIDs:[...], Type:"read"|"delivered" } }
  const ev = payload?.event;
  if (ev && Array.isArray(ev.MessageIDs)) {
    const status = rank(String(payload?.state ?? ev.Type ?? payload?.type ?? ""));
    if (!status) return [];
    return ev.MessageIDs.filter(Boolean).map((id: any) => ({ externalId: String(id), status }));
  }

  // Fallback: array de mensagens com campo status/ack.
  const evt = String(payload?.EventType ?? payload?.type ?? "").toLowerCase();
  const isUpdate = /update|ack|status|receipt/.test(evt);
  const items = payload?.messages ?? (payload?.message ? [payload.message] : []);
  const arr = Array.isArray(items) ? items : [];
  const out: { externalId: string; status: "sent" | "delivered" | "read" }[] = [];
  for (const m of arr) {
    if (!isUpdate && !(m?.fromMe && (m?.status != null || m?.ack != null))) continue;
    const id = m?.id ?? m?.messageid ?? m?.messageId ?? m?.key?.id;
    const status = rank(String(m?.status ?? m?.ack ?? m?.messageStatus ?? m?.Status ?? ""));
    if (id && status) out.push({ externalId: String(id), status });
  }
  return out;
}

function mapType(t?: string): InboundMessage["contentType"] {
  const s = (t || "").toLowerCase();
  if (s.includes("image")) return "image";
  if (s.includes("audio") || s.includes("ptt")) return "audio";
  if (s.includes("video")) return "video";
  if (s.includes("document")) return "document";
  if (s.includes("sticker")) return "sticker";
  if (s.includes("location")) return "location";
  if (s.includes("contact") || s.includes("vcard")) return "contact";
  return "text";
}
