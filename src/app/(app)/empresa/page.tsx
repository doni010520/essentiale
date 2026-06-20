import { Scroll } from "@/components/scroll";
import { PageHeader, Card, Button } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { PREVIEW_MODE } from "@/lib/mock";
import { updateOrg } from "./actions";

export default async function EmpresaPage() {
  const session = PREVIEW_MODE ? null : await getSession();
  const org = session?.organization;
  const company = ((org?.settings as Record<string, unknown> | undefined)?.company ?? {}) as Record<string, string>;

  const inputCls = "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand";
  const Field = ({ name, label, placeholder, span }: { name: string; label: string; placeholder?: string; span?: boolean }) => (
    <div className={span ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-xs font-medium text-ink-soft">{label}</label>
      <input name={name} defaultValue={company[name] ?? ""} placeholder={placeholder} className={inputCls} />
    </div>
  );

  return (
    <Scroll>
      <PageHeader title="Dados da empresa" subtitle="Informações cadastrais da sua organização." />
      <form action={updateOrg} className="max-w-2xl space-y-4">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-ink">Dados</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-ink-soft">Nome da empresa</label>
              <input name="name" defaultValue={org?.name ?? ""} placeholder="Razão social / nome fantasia" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">CNPJ / Documento</label>
              <input name="document" defaultValue={org?.document ?? ""} placeholder="00.000.000/0000-00" className={inputCls} />
            </div>
            <Field name="inscription" label="Inscrição estadual" placeholder="Isento / número" />
            <Field name="phone" label="Celular / telefone" placeholder="(00) 00000-0000" />
            <Field name="email" label="E-mail" placeholder="contato@empresa.com.br" />
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-ink">Endereço</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field name="zipcode" label="CEP" placeholder="00000-000" />
            <Field name="street" label="Logradouro" placeholder="Rua / Avenida" />
            <Field name="number" label="Número" />
            <Field name="complement" label="Complemento" />
            <Field name="district" label="Bairro" />
            <Field name="city" label="Cidade" />
            <Field name="state" label="Estado" placeholder="UF" />
            <Field name="country" label="País" placeholder="Brasil" />
          </div>
        </Card>

        <Button type="submit">Salvar</Button>
      </form>
    </Scroll>
  );
}
