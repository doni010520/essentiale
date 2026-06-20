"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";
import { AuthShell, AuthField } from "@/app/login/page";

export default function OnboardingPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error } = await supabase.rpc("create_organization", {
      org_name: String(form.get("org_name")),
      org_document: String(form.get("org_document") || "") || null,
    });
    setPending(false);
    if (error) setError(error.message);
    else router.push("/dashboard");
  }

  return (
    <AuthShell title="Sua empresa" subtitle="Crie sua organização para começar">
      <form onSubmit={onSubmit} className="space-y-4">
        <AuthField name="org_name" type="text" label="Nome da empresa" placeholder="Ex.: Essentiale Fragrance" />
        <AuthField name="org_document" type="text" label="CNPJ (opcional)" placeholder="00.000.000/0000-00" />
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Criando..." : "Criar organização"}
        </Button>
      </form>
    </AuthShell>
  );
}
