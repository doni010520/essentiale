"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { syncMetaTemplates } from "@/app/(app)/mensagens/templates/actions";
import { toast } from "@/components/toast";

export function SyncTemplatesButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function sync() {
    setBusy(true);
    try {
      const r = await syncMetaTemplates();
      if (r.ok) { toast(`${r.count ?? 0} modelo(s) sincronizado(s) da Meta.`); router.refresh(); }
      else toast(r.error ?? "Falha na sincronização.", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={sync}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:border-brand hover:text-brand disabled:opacity-50"
    >
      <RefreshCw size={15} className={busy ? "animate-spin" : ""} /> {busy ? "Sincronizando…" : "Sincronizar da Meta"}
    </button>
  );
}
