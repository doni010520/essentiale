"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Fecha o drawer ao navegar (mudança de rota).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Trava o scroll do body enquanto o drawer está aberto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      {/* Botão hambúrguer — só no mobile */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition hover:bg-black/5 dark:hover:bg-white/5 hover:text-ink"
      >
        <Menu size={20} />
      </button>

      {/* Backdrop — clicar fora fecha */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Drawer lateral deslizante */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-64 max-w-[80vw] flex-col bg-surface py-3 shadow-2xl transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Cabeçalho: logo + fechar */}
        <div className="mb-2 flex items-center justify-between px-3">
          <Link href="/dashboard" title="Essentiale" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-essentiale.png" alt="Essentiale" className="h-10 w-10 shrink-0 object-contain" />
            <span className="whitespace-nowrap text-lg font-bold tracking-tight text-ink">Essentiale</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition hover:bg-black/5 dark:hover:bg-white/5 hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-3">
          {NAV.map((group) => (
            <div key={group.title} className="flex flex-col gap-0.5 py-1">
              <span className="whitespace-nowrap px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-soft/70">
                {group.title}
              </span>
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 transition",
                      active
                        ? "bg-brand-light text-brand"
                        : "text-ink-soft hover:bg-black/5 dark:hover:bg-white/5 hover:text-ink",
                    )}
                  >
                    <Icon size={20} className="shrink-0" />
                    <span className="truncate whitespace-nowrap text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Rodapé: sair */}
        <div className="mt-2 flex flex-col gap-1 border-t border-border px-3 pt-2">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              title="Sair"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-danger transition hover:bg-red-50"
            >
              <LogOut size={20} className="shrink-0" />
              <span className="whitespace-nowrap text-sm font-medium">Sair</span>
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
