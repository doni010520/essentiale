"use client";

import { useEffect, useState } from "react";
import type { ConversationOverview, Message, Tag, Profile, Department, Channel } from "@/lib/types";

// Lazy import evita SSR do Inbox (que usa toLocaleTimeString etc.)
// mas sem next/dynamic que pode ter problemas de serialização de props.
let InboxComponent: typeof import("./inbox").Inbox | null = null;

export function InboxLoader(props: {
  initialConversations: ConversationOverview[];
  initialSelectedId: string | null;
  initialMessages: Message[];
  userId: string | null;
  tags: Tag[];
  agents: Profile[];
  departments: Department[];
  channels?: Channel[];
  quickReplies?: { title: string; content: string; shortcut: string | null }[];
  templates?: { name: string; language: string; bodyText: string; varCount: number }[];
  live: boolean;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (InboxComponent) {
      setReady(true);
      return;
    }
    import("./inbox").then((m) => {
      InboxComponent = m.Inbox;
      setReady(true);
    });
  }, []);

  if (!ready || !InboxComponent) {
    return (
      <div className="flex h-full animate-pulse">
        {/* Coluna de conversas */}
        <div className="hidden w-80 shrink-0 flex-col gap-3 border-r border-border bg-surface p-3 md:flex">
          <div className="h-9 rounded-lg bg-canvas" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-canvas" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-2/3 rounded bg-canvas" />
                <div className="h-2.5 w-1/2 rounded bg-canvas" />
              </div>
            </div>
          ))}
        </div>
        {/* Área do chat */}
        <div className="flex flex-1 flex-col">
          <div className="h-16 border-b border-border bg-surface" />
          <div className="flex-1 bg-canvas" />
          <div className="h-16 border-t border-border bg-surface" />
        </div>
      </div>
    );
  }

  return <InboxComponent {...props} />;
}
