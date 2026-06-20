import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Scroll } from "@/components/scroll";
import { PageHeader, Card } from "@/components/ui";
import { SettingsForm } from "@/components/settings-form";
import { getDepartments } from "@/lib/data/management";
import { getChannels } from "@/lib/data/channels";
import { getSession } from "@/lib/auth";
import { PREVIEW_MODE } from "@/lib/mock";
import type { OrgSettings } from "@/lib/types";

export default async function ConfiguracoesPage() {
  const [departments, channels] = await Promise.all([getDepartments(), getChannels()]);
  let settings: OrgSettings = {};
  if (!PREVIEW_MODE) {
    const session = await getSession();
    settings = (session?.organization?.settings ?? {}) as OrgSettings;
  }

  return (
    <Scroll>
      <Link href="/ajustes" className="mt-4 inline-flex items-center gap-1 text-sm text-brand hover:underline">
        <ArrowLeft size={15} /> Ajustes
      </Link>
      <PageHeader
        title="Configurações"
        subtitle="Ajuste as preferências de funcionamento do chat e do atendimento."
      />
      <Card className="max-w-3xl">
        <SettingsForm settings={settings} departments={departments} channels={channels} />
      </Card>
    </Scroll>
  );
}
