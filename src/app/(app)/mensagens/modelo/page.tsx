import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Scroll } from "@/components/scroll";
import { PageHeader } from "@/components/ui";
import { CrudManager, type CrudField } from "@/components/crud-manager";
import { getQuickReplies } from "@/lib/data/management";
import { createQuickReply, updateQuickReply, deleteQuickReply } from "../actions";

const FIELDS: CrudField[] = [
  { name: "title", label: "Título", placeholder: "Ex.: Saudação", required: true, inList: true },
  { name: "content", label: "Mensagem", type: "textarea", placeholder: "Texto que será enviado", required: true },
  { name: "shortcut", label: "Atalho", placeholder: "/oi", inList: true },
];

export default async function ModeloPage() {
  const items = await getQuickReplies("model");
  return (
    <Scroll>
      <Link href="/mensagens" className="mt-4 inline-flex items-center gap-1 text-sm text-brand hover:underline">
        <ArrowLeft size={15} /> Mensagens
      </Link>
      <PageHeader title="Mensagens Modelo" subtitle="Modelos reutilizáveis para agilizar o atendimento." />
      <CrudManager
        items={items}
        fields={FIELDS}
        createAction={createQuickReply.bind(null, "model")}
        updateAction={updateQuickReply}
        deleteAction={deleteQuickReply}
        addLabel="Novo modelo"
        emptyTitle="Nenhum modelo ainda"
      />
    </Scroll>
  );
}
