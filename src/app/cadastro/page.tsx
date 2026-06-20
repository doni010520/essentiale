"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";
import { AuthShell, AuthField } from "@/app/login/page";

export default function CadastroPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setError("Supabase não configurado (.env.local). Cadastro indisponível no modo preview.");
      return;
    }
    setPending(true);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: String(form.get("email")),
      password: String(form.get("password")),
      options: { data: { name: String(form.get("name")) } },
    });
    setPending(false);
    if (error) setError(error.message);
    else router.push("/onboarding");
  }

  return (
    <AuthShell title="Criar conta" subtitle="Comece a atender pelo WhatsApp">
      <form onSubmit={onSubmit} className="space-y-4">
        <AuthField name="name" type="text" label="Seu nome" placeholder="Nome completo" />
        <AuthField name="email" type="email" label="E-mail" placeholder="voce@empresa.com" />
        <AuthField name="password" type="password" label="Senha" placeholder="mínimo 6 caracteres" />
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Criando..." : "Criar conta"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-soft">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
