import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Scroll } from "@/components/scroll";
import { PageHeader } from "@/components/ui";
import { CrudManager, type CrudField } from "@/components/crud-manager";
import { getTags } from "@/lib/data/management";
import type { TagScope } from "@/lib/types";
import { createTag, updateTag, deleteTag } from "./actions";

const META: Record<TagScope, { title: string; subtitle: string }> = {
  conversation: { title: "Classificação de Atendimento", subtitle: "Tags para classificar e organizar seus atendimentos." },
  contact: { title: "Classificação de Clientes", subtitle: "Categorize seus clientes conforme a necessidade." },
  status: { title: "Classificação de Status", subtitle: "Status que os atendentes podem assumir (ausente, almoço, etc.)." },
};

const FIELDS: CrudField[] = [
  { name: "name", label: "Nome", placeholder: "Ex.: Resolvido", required: true, inList: true },
  { name: "color", label: "Cor", type: "color" },
];

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope: raw } = await searchParams;
  const scope = (["conversation", "contact", "status"].includes(raw ?? "") ? raw : "conversation") as TagScope;
  const meta = META[scope];
  const tags = await getTags(scope);

  return (
    <Scroll>
      <Link href="/ajustes" className="mt-4 inline-flex items-center gap-1 text-sm text-brand hover:underline">
        <ArrowLeft size={15} /> Ajustes
      </Link>
      <PageHeader title={meta.title} subtitle={meta.subtitle} />
      <CrudManager
        items={tags}
        fields={FIELDS}
        createAction={createTag.bind(null, scope)}
        updateAction={updateTag}
        deleteAction={deleteTag}
        addLabel="Nova classificação"
        emptyTitle="Nenhuma classificação ainda"
      />
    </Scroll>
  );
}
