import { InboxLoader } from "@/components/inbox/inbox-loader";
import { getConversations, getMessages } from "@/lib/data/conversations";
import { getTags, getAgents, getDepartments, getQuickReplies } from "@/lib/data/management";
import { getChannels } from "@/lib/data/channels";
import { getApprovedTemplates } from "@/app/(app)/atendimento/actions";
import { getSession } from "@/lib/auth";
import { PREVIEW_MODE } from "@/lib/mock";

export const revalidate = 0;

export default async function AtendimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const [conversations, tags, agents, departments, quickReplies, channels, templates] = await Promise.all([
    getConversations(),
    getTags("conversation"),
    getAgents(),
    getDepartments(),
    getQuickReplies(),
    getChannels(),
    getApprovedTemplates(),
  ]);
  // Deep-link ?c=<convId> (ex.: clique numa menção do sino) abre essa conversa.
  const requested = (await searchParams)?.c;
  const first =
    (requested && conversations.some((c) => c.id === requested) ? requested : conversations[0]?.id) ?? null;
  const initialMessages = first ? await getMessages(first) : [];

  let userId: string | null = null;
  if (!PREVIEW_MODE) {
    const session = await getSession();
    userId = session?.userId ?? null;
  }

  return (
    <InboxLoader
      initialConversations={conversations}
      initialSelectedId={first}
      initialMessages={initialMessages}
      userId={userId}
      tags={tags}
      agents={agents}
      departments={departments}
      channels={channels}
      quickReplies={quickReplies.map((q) => ({ title: q.title, content: q.content, shortcut: q.shortcut }))}
      templates={templates}
      live={!PREVIEW_MODE}
    />
  );
}
