import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { Scroll } from "@/components/scroll";
import { PageHeader, Card, Button } from "@/components/ui";
import { getBusinessHours } from "@/lib/data/management";
import { saveBusinessHours } from "./actions";

const DAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export default async function HorarioPage() {
  const hours = await getBusinessHours();
  const byDay = new Map(hours.filter((h) => !h.department_id).map((h) => [h.day_of_week, h]));

  return (
    <Scroll>
      <Link href="/ajustes" className="mt-4 inline-flex items-center gap-1 text-sm text-brand hover:underline">
        <ArrowLeft size={15} /> Ajustes
      </Link>
      <PageHeader
        title="Horário de Atendimento"
        subtitle="Defina os dias e horários de funcionamento. Fora do horário, a mensagem automática 'Fora do horário' será enviada."
      />
      <Card className="max-w-2xl">
        <form action={saveBusinessHours} className="space-y-3">
          {DAYS.map((label, i) => {
            const h = byDay.get(i);
            return (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name={`day_${i}_active`} defaultChecked={h?.active ?? (i >= 1 && i <= 5)} className="h-4 w-4 accent-brand" />
                  <span className="w-32 text-sm font-medium text-ink">{label}</span>
                </label>
                <input type="time" name={`day_${i}_start`} defaultValue={h?.start_time ?? "08:00"}
                  className="rounded-lg border border-border px-2 py-1 text-sm outline-none focus:border-brand" />
                <span className="text-xs text-ink-soft">às</span>
                <input type="time" name={`day_${i}_end`} defaultValue={h?.end_time ?? "18:00"}
                  className="rounded-lg border border-border px-2 py-1 text-sm outline-none focus:border-brand" />
              </div>
            );
          })}
          <div className="pt-2">
            <Button type="submit">
              <Clock size={14} /> Salvar horários
            </Button>
          </div>
        </form>
      </Card>
    </Scroll>
  );
}
