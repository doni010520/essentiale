import Link from "next/link";
import { Plus, Radio, MessageSquare, Clock, Headphones, ArrowRight } from "lucide-react";
import { getChannels } from "@/lib/data/channels";
import { getReportData } from "@/lib/data/reports";
import { ChannelsList } from "@/components/channels-list";
import { Scroll } from "@/components/scroll";
import { StatCard, EmptyState } from "@/components/ui";

export default async function DashboardPage() {
  const [channels, report] = await Promise.all([getChannels(), getReportData()]);
  const connected = channels.filter((c) => c.status === "connected").length;

  return (
    <Scroll>
      <div className="mx-auto max-w-6xl px-4 sm:px-0">
        <header className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink">Olá! Bem-vindo 👋</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Acompanhe seus atendimentos e canais em um só lugar.
            </p>
          </div>
          <Link
            href="/atendimento"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
          >
            Acessar atendimento <ArrowRight size={16} />
          </Link>
        </header>

        {/* Indicadores */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Conversas totais", value: report.totals.all, icon: <MessageSquare size={20} />, accent: "bg-brand-light text-brand" },
            { label: "Em espera", value: report.totals.queued, icon: <Clock size={20} />, accent: "bg-amber-100 text-amber-600" },
            { label: "Em andamento", value: report.totals.open, icon: <Headphones size={20} />, accent: "bg-blue-100 text-blue-600" },
            { label: "Canais conectados", value: `${connected}/${channels.length}`, icon: <Radio size={20} />, accent: "bg-green-100 text-green-600" },
          ].map((s, i) => (
            <div key={s.label} className="animate-in" style={{ animationDelay: `${i * 70}ms` }}>
              <StatCard label={s.label} value={s.value} icon={s.icon} accent={s.accent} />
            </div>
          ))}
        </section>

        {/* CTA API Oficial Meta */}
        {!channels.some((c) => c.type === "meta_cloud") && (
          <section className="mt-6">
            <Link href="/canais" className="flex items-center gap-4 rounded-card border border-blue-200 bg-blue-50 p-4 transition hover:bg-blue-100">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Radio size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-800">Conecte a API Oficial da Meta</p>
                <p className="text-xs text-blue-600">Atenda com número verificado, selo verde e sem risco de banimento. Configure em Canais.</p>
              </div>
              <ArrowRight size={18} className="text-blue-400" />
            </Link>
          </section>
        )}

        {/* Canais */}
        <section className="mt-8 pb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Seus canais</h2>
            <Link
              href="/canais"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink transition hover:border-brand hover:text-brand"
            >
              <Plus size={15} /> Conectar canal
            </Link>
          </div>

          {channels.length === 0 ? (
            <Link href="/canais" className="block">
              <EmptyState
                title="Nenhum canal conectado ainda"
                hint="Conecte um número de WhatsApp (QR Code via UAZAPI ou API Oficial da Meta) para começar a atender."
              />
            </Link>
          ) : (
            <ChannelsList channels={channels} />
          )}
        </section>
      </div>
    </Scroll>
  );
}
