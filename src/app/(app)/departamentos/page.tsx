import { Scroll } from "@/components/scroll";
import { PageHeader } from "@/components/ui";
import { CrudManager, type CrudField } from "@/components/crud-manager";
import { getDepartments } from "@/lib/data/management";
import { createDepartment, updateDepartment, deleteDepartment } from "./actions";

const FIELDS: CrudField[] = [
  { name: "name", label: "Nome do departamento", placeholder: "Ex.: Suporte Técnico", required: true, inList: true },
  { name: "color", label: "Cor", type: "color" },
];

export default async function DepartamentosPage() {
  const departments = await getDepartments();
  return (
    <Scroll>
      <PageHeader title="Departamentos" subtitle="Agrupe seus atendentes para organizar as filas de atendimento." />
      <CrudManager
        items={departments}
        fields={FIELDS}
        createAction={createDepartment}
        updateAction={updateDepartment}
        deleteAction={deleteDepartment}
        addLabel="Novo departamento"
        emptyTitle="Nenhum departamento cadastrado"
        emptyHint="Crie departamentos para distribuir os atendimentos."
      />
    </Scroll>
  );
}
