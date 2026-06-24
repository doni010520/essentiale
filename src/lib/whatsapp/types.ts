import type { Channel } from "@/lib/types";

export interface SendTextParams {
  to: string; // número no formato internacional, só dígitos
  text: string;
  replyId?: string; // id externo da mensagem citada (quote)
  mentions?: string[]; // números (dígitos) a mencionar em grupo, ou ["all"]
}

export interface SendMediaParams {
  to: string;
  url: string;
  caption?: string;
  kind: "image" | "audio" | "video" | "document" | "sticker";
  replyId?: string;
}

export interface SendButtonsParams {
  to: string;
  body: string; // texto do card (legenda do produto)
  imageUrl?: string; // imagem no topo do card (header)
  buttons: { id: string; title: string }[]; // botões de resposta (máx 3; título ≤ 20 chars)
  replyId?: string;
}

export interface ConnectResult {
  status: Channel["status"];
  qrCode?: string; // base64/data-url quando aplicável (UAZAPI)
  pairCode?: string; // código de 8 dígitos para parear por número (UAZAPI)
  externalId?: string;
  debug?: string;
}

/** Contrato único para qualquer provedor de WhatsApp (Adapter). */
export interface ChannelProvider {
  /** Inicia/garante a conexão. Se `phone` vier, pede código de pareamento (UAZAPI). */
  connect(phone?: string): Promise<ConnectResult>;
  /** Consulta o status atual da conexão. */
  status(): Promise<Channel["status"]>;
  sendText(params: SendTextParams): Promise<{ externalId?: string }>;
  sendMedia(params: SendMediaParams): Promise<{ externalId?: string }>;
  /** Mensagem interativa: imagem (opcional) + botões de resposta. Opcional — canais sem
   *  suporte (ex.: UAZAPI por ora) caem no fallback de imagem simples no chatbot. */
  sendButtons?(params: SendButtonsParams): Promise<{ externalId?: string }>;
  /** URL da foto de perfil do contato (UAZAPI). Meta não expõe → null. */
  getProfilePicture?(phone: string): Promise<string | null>;
  /** Nome + imagem de um chat/grupo (UAZAPI). Para grupos, passe o JID `<id>@g.us`. */
  getChatInfo?(jid: string): Promise<{ name?: string; image?: string }>;
  /** Baixa/descriptografa uma mídia recebida pelo id da mensagem (UAZAPI). */
  downloadMedia?(externalId: string): Promise<{ url?: string; mimetype?: string; transcription?: string }>;
  /** Reage a uma mensagem com um emoji (string vazia remove a reação). */
  reactMessage?(to: string, externalId: string, emoji: string): Promise<void>;
  /** Edita o texto de uma mensagem enviada. */
  editMessage?(externalId: string, text: string): Promise<void>;
  /** Apaga uma mensagem (para todos). */
  deleteMessage?(externalId: string): Promise<void>;
  /** Marca mensagens como lidas. */
  markRead?(externalIds: string[]): Promise<void>;
  /** Mostra "digitando…" para o contato (e, na Meta oficial, marca a msg como lida).
   *  `externalId` = id da mensagem recebida (exigido pela Meta). Best-effort. */
  sendTyping?(to: string, externalId?: string): Promise<void>;
  /** Envia uma localização. */
  sendLocation?(to: string, loc: { name?: string; address?: string; latitude: number; longitude: number }): Promise<{ externalId?: string }>;
  /** Envia um contato (vCard). */
  sendContact?(to: string, contact: { fullName: string; phoneNumber: string }): Promise<{ externalId?: string }>;
  /** Envia uma mensagem de modelo (template) — Meta oficial, fora da janela de 24h. */
  sendTemplate?(params: { to: string; name: string; language: string; components?: unknown[] }): Promise<{ externalId?: string }>;
  /** Lista participantes de um grupo (LID + telefone real). Para resolver autor → 1:1. */
  getGroupParticipants?(groupJid: string): Promise<{ lid: string; phone: string }[]>;
  /** Informações do grupo: nome, descrição, participantes. */
  getGroupInfo?(groupJid: string): Promise<{
    name?: string;
    description?: string;
    owner?: string;
    participants: { phone: string; lid: string; isAdmin: boolean }[];
  }>;
  /** Remove um participante de um grupo. */
  removeGroupParticipant?(groupJid: string, phone: string): Promise<boolean>;
  /** Desconecta a sessão sem apagar (UAZAPI). */
  disconnect?(): Promise<void>;
  /** Apaga a instância no provedor (UAZAPI). */
  deleteInstance?(): Promise<void>;
}

/** Mensagem normalizada vinda de um webhook, independente do provedor. */
export interface InboundMessage {
  channelExternalId: string; // identifica o canal (instance/phone_number_id)
  from: string; // número do contato (dígitos) OU id do grupo quando isGroup
  contactName?: string; // nome do contato, ou nome do grupo quando isGroup
  contentType: "text" | "image" | "audio" | "video" | "document" | "location" | "contact" | "sticker";
  body?: string;
  mediaUrl?: string;
  externalId?: string; // id da mensagem no provedor
  timestamp?: string;
  isGroup?: boolean; // conversa de grupo
  authorName?: string; // quem enviou dentro do grupo (participante)
  authorPhone?: string; // telefone real do participante (para abrir 1:1)
  authorLid?: string; // LID do participante (resolvível via /group/info)
  chatJid?: string; // JID completo do chat/grupo (preserva traço de jids antigos)
  reaction?: { targetExternalId: string; emoji: string }; // evento de reação
  replyTo?: { externalId?: string; excerpt?: string; author?: string }; // msg citada
  buttonId?: string; // id do botão interativo clicado (ex.: "menu:humano", "quero:<slug>")
  fromMe?: boolean; // mensagem enviada pelo próprio número (eco do celular) → direção "out"
  chatPhoto?: string; // foto do contato/grupo (vem no objeto chat do webhook)
  chatName?: string; // nome do contato/grupo (vem no objeto chat do webhook)
}
