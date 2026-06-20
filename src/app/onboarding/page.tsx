import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

// Guard: usuário já logado e com organização não precisa de onboarding — vai direto
// pro app. Só mostra o formulário se, de fato, não houver organização.
export default async function OnboardingPage() {
  const hasEnv = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (hasEnv) {
    const session = await getSession();
    if (!session) redirect("/login");
    if (session.organization) redirect("/dashboard");
  }
  return <OnboardingForm />;
}
