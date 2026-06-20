"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUnreadMentions, markMentionsRead } from "@/app/(app)/atendimento/actions";
import type { InternalMention } from "@/lib/types";

/** Sino de notificações de menções internas (entre atendentes), em tempo real. */
export function MentionsBell({ userId }: { userId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InternalMention[]>([]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    getUnreadMentions().then((m) => active && setItems(m));

    const supabase = createClient();
    const ch = supabase
      .channel(`mentions-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "internal_mentions", filter: `mentioned_user_id=eq.${userId}` },
        (payload) => {
          const m = payload.new as InternalMention;
          setItems((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev]));
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [userId]);

  const count = items.length;

  function openMention(m: InternalMention) {
    setOpen(false);
    setItems((prev) => prev.filter((x) => x.id !== m.id));
    markMentionsRead(m.conversation_id);
    router.push(`/atendimento?c=${m.conversation_id}`);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
        title="Menções"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-40 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
            <div className="border-b border-border px-4 py-2.5 text-sm font-semibold text-ink">
              Menções {count > 0 && <span className="text-ink-soft">({count})</span>}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {count === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-ink-soft">Nenhuma menção nova.</p>
              ) : (
                items.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => openMention(m)}
                    className="flex w-full flex-col gap-0.5 border-b border-border px-4 py-2.5 text-left transition hover:bg-amber-50"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                      🔒 {m.author_name ?? "Atendente"} te mencionou
                    </span>
                    {m.contact_name && (
                      <span className="text-[11px] text-ink-soft">na conversa com {m.contact_name}</span>
                    )}
                    {m.excerpt && <span className="line-clamp-2 text-xs text-ink">{m.excerpt}</span>}
                  </button>
                ))
              )}
            </div>
            {count > 0 && (
              <button
                onClick={() => { markMentionsRead(); setItems([]); setOpen(false); }}
                className="w-full border-t border-border px-4 py-2 text-center text-xs text-brand hover:bg-gray-50"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
