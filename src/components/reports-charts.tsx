"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Card } from "@/components/ui";
import type { ReportData } from "@/lib/data/reports";

const COLORS = ["#00a8ff", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#6b7280"];

export function ReportsCharts({ data }: { data: ReportData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Atendimentos" value={data.totals.all} accent="text-brand" />
        <Kpi label="Em andamento" value={data.totals.open} accent="text-green-600" />
        <Kpi label="Em espera" value={data.totals.queued} accent="text-amber-600" />
        <Kpi label="Encerrados" value={data.totals.closed} accent="text-ink" />
      </div>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-ink">Atendimentos nos últimos 14 dias</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.byDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#7a8699" }} />
            <YAxis tick={{ fontSize: 11, fill: "#7a8699" }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="total" fill="#00a8ff" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-ink">Por status</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {data.byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-ink">Por canal</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.byChannel} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: "#7a8699" }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#7a8699" }} width={120} />
              <Tooltip />
              <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {data.byDepartment.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-ink">Por departamento</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byDepartment}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#7a8699" }} />
              <YAxis tick={{ fontSize: 11, fill: "#7a8699" }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <Card className="py-4">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent}`}>{value.toLocaleString("pt-BR")}</p>
    </Card>
  );
}
