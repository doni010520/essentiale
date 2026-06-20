import { createClient } from "@/lib/supabase/server";
import type { Organization, Profile } from "@/lib/types";

/** Retorna o usuário autenticado + seu profile + a organização. Null se não logado. */
export async function getSession(): Promise<{
  userId: string;
  profile: Profile | null;
  organization: Organization | null;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  let organization: Organization | null = null;
  if (profile?.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .maybeSingle();
    organization = org ?? null;
  }

  return { userId: user.id, profile: (profile as Profile) ?? null, organization };
}
