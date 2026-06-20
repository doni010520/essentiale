"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart,
} from "recharts";
import {
  Clock, MessageSquareReply, ShoppingBag, UserCheck, Star, Send,
} from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { KpiReport, PeriodDays } from "@/lib/data/reports";

const BRAND = "#7d9b6a"; // --color-brand (recharts SVG não lê var() de forma confiável)
const BRAND_SOFT = "#cdd9c2"; // tom claro do verde para barras secundárias
const INK_SOFT = "#7a8699";
const GRID = "#eef0f3";

const PERIODS: { value: PeriodDays; label: string }[] = [
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
];

function brl(centavos: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);
}

function fmtDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s ? `${m}min ${s}s` : `${m}min`;
}

export function RelatoriosClient({ report }: { report: KpiReport }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setPeriod(p: PeriodDays) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("periodo", String(p));
    router.push(`?${params.toString()}`);
  }

  const { volume, firstResponse, responseRate, conversion, handoff, csat, reactivation } = report;

  return (
    <div className="space-y-5 pb-4">
      {/* Filtro de período */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-soft">
          Indicadores de sucesso · últimos {report.periodDays} dias
        </p>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 text-sm">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition",
                report.periodDays === p.value ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resumo de volume */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <VolumeCard label="Conversas" value={volume.conversations.toLocaleString("pt-BR")} />
        <VolumeCard label="Contatos novos" value={volume.contacts.toLocaleString("pt-BR")} />
        <VolumeCard label="Pedidos" value={volume.orders.toLocaleString("pt-BR")} />
        <VolumeCard label="Receita" value={brl(volume.revenueCentavos)} accent="text-brand" />
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* 1) Tempo de 1ª resposta */}
        <KpiCard
          icon={<Clock size={18} />}
          title="Tempo de 1ª resposta"
          meta="meta < 1 min"
          metaOk={firstResponse.medianSeconds != null && firstResponse.medianSeconds < 60}
        >
          {firstResponse.sample === 0 ? (
            <NoData />
          ) : (
            <>
              <Big value={fmtDuration(firstResponse.medianSeconds)} suffix="mediana" />
              <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
                <li>Média: <span className="font-medium text-ink">{fmtDuration(firstResponse.avgSeconds)}</span></li>
                <li>Dentro da meta: <span className="font-medium text-ink">{firstResponse.withinTargetPct ?? 0}%</span></li>
                <li>Amostra: {firstResponse.sample} conversas</li>
              </ul>
            </>
          )}
        </KpiCard>

        {/* 2) Taxa de resposta a leads */}
        <KpiCard
          icon={<MessageSquareReply size={18} />}
          title="Taxa de resposta a leads"
          meta="meta 100%"
          metaOk={responseRate.pct === 100}
        >
          {responseRate.conversations === 0 ? (
            <NoData />
          ) : (
            <>
              <Big value={`${responseRate.pct ?? 0}%`} suffix="responderam" />
              <ProgressBar pct={responseRate.pct ?? 0} />
              <p className="mt-2 text-xs text-ink-soft">
                {responseRate.answered} de {responseRate.conversations} conversas com resposta
              </p>
            </>
          )}
        </KpiCard>

        {/* 3) Conversão lead → pedido */}
        <KpiCard
          icon={<ShoppingBag size={18} />}
          title="Conversão lead → pedido"
          meta="funil simples"
        >
          {conversion.conversations === 0 ? (
            <NoData />
          ) : (
            <>
              <Big value={`${conversion.pct ?? 0}%`} suffix={`${conversion.orders} pedidos`} />
              <FunnelBars
                steps={[
                  { label: "Conversas", value: conversion.conversations },
                  { label: "Com pedido", value: conversion.withOrder },
                ]}
              />
            </>
          )}
        </KpiCard>

        {/* 4) Handoff */}
        <KpiCard
          icon={<UserCheck size={18} />}
          title="Handoff para humano"
          meta="transferências"
        >
          {handoff.count === 0 ? (
            <NoData label="Nenhuma transferência no período" />
          ) : (
            <>
              <Big value={handoff.count.toLocaleString("pt-BR")} suffix="conversas" />
              <p className="mt-2 text-xs text-ink-soft">
                {handoff.pct ?? 0}% das conversas foram atribuídas a um atendente/departamento
              </p>
            </>
          )}
        </KpiCard>

        {/* 5) CSAT pós-entrega */}
        <KpiCard
          icon={<Star size={18} />}
          title="CSAT pós-entrega"
          meta="meta ≥ 4,7"
          metaOk={csat.avg != null && csat.avg >= 4.7}
        >
          {csat.count === 0 ? (
            <NoData label="Sem avaliações ainda" />
          ) : (
            <>
              <div className="flex items-baseline gap-1">
                <Star size={20} className="fill-yellow-400 text-yellow-400" />
                <span className="tnum text-3xl font-bold text-ink">{csat.avg?.toFixed(1)}</span>
                <span className="text-xs text-ink-soft">({csat.count} avaliações)</span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                {csat.distribution.map((d) => {
                  const max = Math.max(1, ...csat.distribution.map((x) => x.count));
                  return (
                    <div key={d.note} className="flex-1 text-center">
                      <div className="mx-auto mb-1 flex h-16 w-full max-w-[34px] items-end overflow-hidden rounded-t bg-gray-100">
                        <div
                          className="w-full rounded-t bg-brand transition-all"
                          style={{ height: `${(d.count / max) * 100}%` }}
                        />
                      </div>
                      <p className="text-[11px] font-medium text-ink">{d.note}★</p>
                      <p className="text-[10px] text-ink-soft">{d.count}</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </KpiCard>

        {/* 6) Reativação por disparo */}
        <KpiCard
          icon={<Send size={18} />}
          title="Reativação por disparo"
          meta="followups + campanhas"
        >
          {!reactivation.hasData ? (
            <NoData label="Sem dados de disparo ainda" />
          ) : (
            <>
              <Big value={reactivation.followupsSent.toLocaleString("pt-BR")} suffix="followups enviados" />
              <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
                <li>Campanhas ativas/concluídas: <span className="font-medium text-ink">{reactivation.campaignsRun}</span></li>
                <li>Mensagens de campanha enviadas: <span className="font-medium text-ink">{reactivation.campaignMessagesSent.toLocaleString("pt-BR")}</span></li>
              </ul>
            </>
          )}
        </KpiCard>
      </div>

      {/* Série diária: conversas × pedidos × receita */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-ink">Conversas e pedidos por dia</h3>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={report.byDay}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: INK_SOFT }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: INK_SOFT }} allowDecimals={false} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: INK_SOFT }}
              tickFormatter={(v) => brl(Number(v)).replace("R$", "").trim()}
            />
            <Tooltip
              formatter={(value, name) =>
                name === "Receita" ? brl(Number(value)) : String(value)
              }
            />
            <Bar yAxisId="left" dataKey="conversations" name="Conversas" fill={BRAND_SOFT} radius={[3, 3, 0, 0]} />
            <Bar yAxisId="left" dataKey="orders" name="Pedidos" fill={BRAND} radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="revenueCentavos" name="Receita" stroke="#8b5cf6" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* Funil de conversão (gráfico) */}
      {conversion.conversations > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-ink">Funil: conversas → pedido</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart
              layout="vertical"
              data={[
                { name: "Conversas", value: conversion.conversations },
                { name: "Com pedido", value: conversion.withOrder },
              ]}
              margin={{ left: 20 }}
            >
              <XAxis type="number" tick={{ fontSize: 11, fill: INK_SOFT }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: INK_SOFT }} width={90} />
              <Tooltip />
              <Bar dataKey="value" fill={BRAND} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

/* ── Subcomponentes ──────────────────────────────────────────────────────── */

function VolumeCard({ label, value, accent = "text-ink" }: { label: string; value: string; accent?: string }) {
  return (
    <Card className="py-4">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className={cn("tnum mt-1 text-2xl font-bold leading-tight", accent)}>{value}</p>
    </Card>
  );
}

function KpiCard({
  icon, title, meta, metaOk, children,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  metaOk?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light text-brand">{icon}</span>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
            metaOk === true ? "bg-success-bg text-green-700"
              : metaOk === false ? "bg-amber-100 text-amber-700"
              : "bg-gray-100 text-ink-soft",
          )}
        >
          {meta}
        </span>
      </div>
      {children}
    </Card>
  );
}

function Big({ value, suffix }: { value: string; suffix?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="tnum text-3xl font-bold text-ink">{value}</span>
      {suffix && <span className="text-xs text-ink-soft">{suffix}</span>}
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function FunnelBars({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="mt-3 space-y-2">
      {steps.map((s) => (
        <div key={s.label}>
          <div className="mb-0.5 flex justify-between text-xs text-ink-soft">
            <span>{s.label}</span>
            <span className="font-medium text-ink">{s.value}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(s.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function NoData({ label = "Sem dados ainda" }: { label?: string }) {
  return (
    <div className="py-4">
      <p className="text-sm text-ink-soft">{label}</p>
    </div>
  );
}
