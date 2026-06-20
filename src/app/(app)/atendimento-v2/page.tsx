import { KanbanBoard } from "@/components/kanban-board";
import { getConversations, getConversationTagMap } from "@/lib/data/conversations";
import { getChannels } from "@/lib/data/channels";
import { getAgents, getDepartments, getTags } from "@/lib/data/management";

export default async function AtendimentoV2Page() {
  const [conversations, tagMap, channels, agents, departments, tags] = await Promise.all([
    getConversations(),
    getConversationTagMap(),
    getChannels(),
    getAgents(),
    getDepartments(),
    getTags("conversation"),
  ]);
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-surface px-6 py-4">
        <h1 className="text-xl font-semibold text-ink">Dashboard de atendimento</h1>
        <p className="text-sm text-ink-soft">Visão em board dos seus atendimentos por etapa.</p>
      </div>
      <div className="min-h-0 flex-1">
        <KanbanBoard
          conversations={conversations}
          tagMap={tagMap}
          channels={channels}
          agents={agents}
          departments={departments}
          tags={tags}
        />
      </div>
    </div>
  );
}
