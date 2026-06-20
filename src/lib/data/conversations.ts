import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MOCK_CONVERSATIONS, MOCK_MESSAGES, PREVIEW_MODE } from "@/lib/mock";
import type { ConversationOverview, Message } from "@/lib/types";

export async function getConversations(): Promise<ConversationOverview[]> {
  if (PREVIEW_MODE) return MOCK_CONVERSATIONS;
  noStore(); // sempre dados frescos (polling da inbox)

  const supabase = await createClient();
  const { data } = await supabase
    .from("conversation_overview")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false });
  return (data as ConversationOverview[]) ?? [];
}

/** Mapa conversa → lista de tag_ids (para filtros do board). */
export async function getConversationTagMap(): Promise<Record<string, string[]>> {
  if (PREVIEW_MODE) return {};
  noStore();
  const supabase = await createClient();
  const { data } = await supabase.from("conversation_tags").select("conversation_id, tag_id");
  const map: Record<string, string[]> = {};
  for (const row of (data as { conversation_id: string; tag_id: string }[]) ?? []) {
    (map[row.conversation_id] ??= []).push(row.tag_id);
  }
  return map;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  if (PREVIEW_MODE) return MOCK_MESSAGES[conversationId] ?? [];
  noStore(); // sempre dados frescos (polling da inbox)

  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data as Message[]) ?? [];
}
