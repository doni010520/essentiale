import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Scroll } from "@/components/scroll";
import { PageHeader } from "@/components/ui";
import { CrudManager, type CrudField } from "@/components/crud-manager";
import { SyncTemplatesButton } from "@/components/sync-templates-button";
import { createClient } from "@/lib/supabase/server";
import { PREVIEW_MODE } from "@/lib/mock";
import { createTemplate, updateTemplate, deleteTemplate } from "./actions";

const FIELDS: CrudField[] = [
  { name: "name", label: "Nome do template", placeholder: "Ex.: boas_vindas", required: true, inList: true },
  { name: "language", label: "Idioma", placeholder: "pt_BR" },
  {
    name: "category", label: "Categoria", type: "select",
    options: [
      { value: "UTILITY", label: "Utilidade" },
      { value: "MARKETING", label: "Marketing" },
      { value: "AUTHENTICATION", label: "Autenticação" },
    ],
  },
  { name: "components", label: "Componentes (JSON)", type: "textarea", placeholder: '[{"type":"BODY","text":"Olá {{1}}, tudo bem?"}]' },
];

export default async function TemplatesPage() {
  let templates: Record<string, unknown>[] = [];
  if (!PREVIEW_MODE) {
    const sb = await createClient();
    const { data } = await sb.from("wa_templates").select("*").order("name");
    templates = (data ?? []) as Record<string, unknown>[];
  }

  return (
    <Scroll>
      <Link href="/mensagens" className="mt-4 inline-flex items-center gap-1 text-sm text-brand hover:underline">
        <ArrowLeft size={15} /> Mensagens
      </Link>
      <PageHeader
        title="Templates (API Oficial Meta)"
        subtitle="Templates HSM aprovados pela Meta para envio fora da janela de 24h."
        action={<SyncTemplatesButton />}
      />
      <CrudManager
        items={templates.map((t) => ({
          ...t,
          id: String(t.id),
          components: JSON.stringify(t.components ?? [], null, 2),
          _subtitle: `${t.language} · ${t.category} · ${t.status}`,
        }))}
        fields={FIELDS}
        createAction={createTemplate}
        updateAction={updateTemplate}
        deleteAction={deleteTemplate}
        addLabel="Novo template"
        emptyTitle="Nenhum template cadastrado"
        emptyHint="Crie templates para iniciar conversas fora da janela de 24h (requer canal Meta)."
      />
    </Scroll>
  );
}
