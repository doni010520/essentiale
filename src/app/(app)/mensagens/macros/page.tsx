import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Scroll } from "@/components/scroll";
import { PageHeader } from "@/components/ui";
import { CrudManager, type CrudField } from "@/components/crud-manager";
import { getQuickReplies } from "@/lib/data/management";
import { createQuickReply, updateQuickReply, deleteQuickReply } from "../actions";

const FIELDS: CrudField[] = [
  { name: "title", label: "Nome da macro", placeholder: "Ex.: Encaminhar suporte", required: true, inList: true },
  { name: "content", label: "Ação / mensagem", type: "textarea", required: true },
  { name: "shortcut", label: "Atalho", placeholder: "/macro", inList: true },
];

export default async function MacrosPage() {
  const items = await getQuickReplies("macro");
  return (
    <Scroll>
      <Link href="/mensagens" className="mt-4 inline-flex items-center gap-1 text-sm text-brand hover:underline">
        <ArrowLeft size={15} /> Mensagens
      </Link>
      <PageHeader title="Macros" subtitle="Sequências de ações automatizadas com um clique." />
      <CrudManager
        items={items}
        fields={FIELDS}
        createAction={createQuickReply.bind(null, "macro")}
        updateAction={updateQuickReply}
        deleteAction={deleteQuickReply}
        addLabel="Nova macro"
        emptyTitle="Nenhuma macro ainda"
      />
    </Scroll>
  );
}
