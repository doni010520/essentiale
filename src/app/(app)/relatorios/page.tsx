import { Scroll } from "@/components/scroll";
import { PageHeader } from "@/components/ui";
import { getKpiReport, type PeriodDays } from "@/lib/data/reports";
import { RelatoriosClient } from "./relatorios-client";

function parsePeriod(raw: string | undefined): PeriodDays {
  const n = Number(raw);
  if (n === 7 || n === 90) return n;
  return 30;
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const periodDays = parsePeriod((await searchParams)?.periodo);
  const report = await getKpiReport(periodDays);

  return (
    <Scroll>
      <PageHeader
        title="Relatórios"
        subtitle="Indicadores de sucesso do atendimento Essentiale (Guia §1.3)."
      />
      <RelatoriosClient report={report} />
    </Scroll>
  );
}
