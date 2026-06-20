import Link from "next/link";
import { Send, FileEdit, Copy, Zap } from "lucide-react";
import { Scroll } from "@/components/scroll";
import { PageHeader } from "@/components/ui";

const CARDS = [
  { icon: Send, title: "Mensagens Automáticas", desc: "Configure mensagens enviadas em momentos específicos do atendimento.", href: "/mensagens/automaticas" },
  { icon: FileEdit, title: "Mensagens Modelo", desc: "Crie modelos reutilizáveis para agilizar o atendimento.", href: "/mensagens/modelo" },
  { icon: Copy, title: "Mensagens Templates", desc: "Gerencie templates aprovados (Meta) e ações rápidas.", href: "/mensagens/templates" },
  { icon: Zap, title: "Macros", desc: "Sequências de ações automatizadas executadas com um clique.", href: "/mensagens/macros" },
];

export default function MensagensPage() {
  return (
    <Scroll>
      <PageHeader title="Mensagens" subtitle="Monitore e gerencie as mensagens de todo o sistema para a sua empresa!" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {CARDS.map(({ icon: Icon, title, desc, href }) => (
          <Link key={title} href={href} className="flex flex-col items-center gap-2 rounded-card bg-surface p-8 text-center shadow-sm transition hover:shadow-md">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-ink-soft">
              <Icon size={24} />
            </div>
            <h3 className="mt-1 font-semibold text-ink">{title}</h3>
            <p className="text-xs text-ink-soft">{desc}</p>
            <span className="mt-1 text-sm font-medium text-brand">Acessar →</span>
          </Link>
        ))}
      </div>
    </Scroll>
  );
}
