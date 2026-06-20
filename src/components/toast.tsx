"use client";

import { useEffect, useState } from "react";
import { Check, AlertCircle } from "lucide-react";

type Toast = { id: number; msg: string; kind: "success" | "error" };

let emit: (msg: string, kind?: "success" | "error") => void = () => {};

/** Dispara um toast de qualquer lugar do client. */
export function toast(msg: string, kind: "success" | "error" = "success") {
  emit(msg, kind);
}

/** Renderiza a pilha de toasts (montar uma vez no layout). */
export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    emit = (msg, kind = "success") => {
      const id = Date.now() + Math.random();
      setItems((s) => [...s, { id, msg, kind }]);
      setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3200);
    };
    return () => { emit = () => {}; };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`animate-in pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-pop ${
            t.kind === "error" ? "bg-danger" : "bg-ink"
          }`}
        >
          {t.kind === "error" ? <AlertCircle size={16} /> : <Check size={16} />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}
