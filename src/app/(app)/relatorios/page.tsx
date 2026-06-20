import { Scroll } from "@/components/scroll";
import { PageHeader } from "@/components/ui";
import { ReportsCharts } from "@/components/reports-charts";
import { ReportsTabs } from "@/components/reports-tabs";
import {
  getReportData,
  getAgentReports,
  getClientReports,
  getCsatReport,
} from "@/lib/data/reports";

export default async function RelatoriosPage() {
  const [data, agents, clients, csat] = await Promise.all([
    getReportData(),
    getAgentReports(),
    getClientReports(),
    getCsatReport(),
  ]);
  return (
    <Scroll>
      <PageHeader title="Relatórios" subtitle="Acompanhe os indicadores de atendimento da sua empresa." />
      <ReportsTabs data={data} agents={agents} clients={clients} csat={csat} />
    </Scroll>
  );
}
