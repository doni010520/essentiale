"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const expanded = pinned || hovered;

  useEffect(() => {
    setPinned(localStorage.getItem("sb-pinned") === "1");
  }, []);

  function togglePin() {
    setPinned((p) => {
      localStorage.setItem("sb-pinned", p ? "0" : "1");
      return !p;
    });
  }

  return (
    // Espaçador: reserva a largura da barra fininha no layout (a barra real é overlay fixo).
    <div className="w-[72px] shrink-0">
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col bg-surface py-3 transition-all duration-200",
          expanded ? "w-60 px-3 shadow-2xl" : "w-[72px] items-center px-2 shadow-[2px_0_12px_rgba(0,0,0,0.04)]",
        )}
      >
        {/* Logo */}
        <Link
          href="/dashboard"
          title="MVF"
          className={cn("mb-2 flex items-center gap-2", expanded ? "px-1" : "justify-center")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mvf.png" alt="MVF" className="h-10 w-10 shrink-0 object-contain" />
          {expanded && <span className="whitespace-nowrap text-lg font-bold tracking-tight text-ink">MVF Chat</span>}
        </Link>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
          {NAV.map((group) => (
            <div key={group.title} className="flex flex-col gap-0.5 py-1">
              {expanded ? (
                <span className="whitespace-nowrap px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-soft/70">
                  {group.title}
                </span>
              ) : (
                <span className="mx-auto my-1 h-px w-6 bg-border" aria-hidden />
              )}
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={expanded ? undefined : item.label}
                    className={cn(
                      "flex items-center rounded-xl transition",
                      expanded ? "gap-3 px-3 py-2" : "h-11 w-11 justify-center",
                      active ? "bg-brand-light text-brand" : "text-ink-soft hover:bg-black/5 dark:hover:bg-white/5 hover:text-ink",
                    )}
                  >
                    <Icon size={20} className="shrink-0" />
                    {expanded && <span className="truncate whitespace-nowrap text-sm font-medium">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Rodapé: fixar/soltar + sair */}
        <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
          <button
            onClick={togglePin}
            title={pinned ? "Soltar (recolher ao tirar o mouse)" : "Fixar aberta"}
            className={cn(
              "flex items-center rounded-xl text-ink-soft transition hover:bg-black/5 dark:hover:bg-white/5 hover:text-ink",
              expanded ? "gap-3 px-3 py-2" : "h-11 w-11 justify-center",
            )}
          >
            {pinned ? <PanelLeftClose size={20} className="shrink-0" /> : <PanelLeftOpen size={20} className="shrink-0" />}
            {expanded && <span className="whitespace-nowrap text-sm font-medium">{pinned ? "Soltar menu" : "Fixar menu"}</span>}
          </button>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              title="Sair"
              className={cn(
                "flex w-full items-center rounded-xl text-danger transition hover:bg-red-50",
                expanded ? "gap-3 px-3 py-2" : "h-11 w-11 justify-center",
              )}
            >
              <LogOut size={20} className="shrink-0" />
              {expanded && <span className="whitespace-nowrap text-sm font-medium">Sair</span>}
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
