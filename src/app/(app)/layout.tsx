import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { Toaster } from "@/components/toast";
import { getSession } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const hasEnv = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

  let userName = "ADONIAS SOUZA";
  let orgName = "Modo preview";
  let email: string | undefined;
  let userId: string | null = null;

  if (hasEnv) {
    const session = await getSession();
    if (!session) redirect("/login");
    if (!session.organization) redirect("/onboarding");
    userName = session.profile?.name || session.profile?.email || "Usuário";
    orgName = session.organization.name;
    email = session.profile?.email ?? undefined;
    userId = session.userId ?? null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar userName={userName} orgName={orgName} email={email} userId={userId} />
        {!hasEnv && (
          <div className="mx-6 mb-2 rounded-lg bg-amber-100 px-4 py-2 text-xs text-amber-800">
            Modo preview — Supabase não configurado. Crie o projeto e preencha o{" "}
            <code>.env.local</code> para ativar login e dados reais.
          </div>
        )}
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
