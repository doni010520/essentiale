import { SgpClient } from "./client";
import { type SgpConfig, SgpError } from "./types";
import { decryptSgpConfig } from "@/lib/crypto";

export { SgpClient } from "./client";
export * from "./types";

type AnyDb = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (col: string, v: unknown) => {
        eq: (col: string, v: unknown) => {
          limit: (n: number) => { maybeSingle: () => Promise<{ data: unknown }> };
        };
      };
    };
  };
};

function parseConfig(config: unknown): SgpConfig {
  const raw = (config ?? {}) as Record<string, string>;
  const c = decryptSgpConfig(raw);
  const str = (v: unknown) => String(v ?? "").trim();
  return {
    url: str(c.url),
    app: str(c.app),
    token: str(c.token),
    username: str(c.username) || undefined,
    password: str(c.password) || undefined,
  };
}

/** Constrói um SgpClient a partir de uma config crua (integrations.config). */
export function sgpFromConfig(config: unknown): SgpClient {
  return new SgpClient(parseConfig(config));
}

/**
 * Carrega a integração SGP ativa da organização e devolve um SgpClient.
 * Retorna null se a org não tem SGP configurado. Use o service client em
 * contexto de webhook; o client com RLS em contexto de usuário.
 */
export async function sgpForOrg(db: AnyDb, organizationId: string): Promise<SgpClient | null> {
  const { data } = await db
    .from("integrations")
    .select("config")
    .eq("organization_id", organizationId)
    .eq("type", "sgp")
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  try {
    return sgpFromConfig((data as { config: unknown }).config);
  } catch (e) {
    if (e instanceof SgpError) return null; // config incompleta
    throw e;
  }
}

/**
 * Carrega um SgpClient a partir de um ID de integração específico.
 * Usar quando a automação tem integration_id definido — garante que
 * cada automação consulta o SGP correto (ex.: IGUAI vs NOVA CANAA).
 */
export async function sgpForIntegration(db: AnyDb, integrationId: string): Promise<SgpClient | null> {
  const { data } = await db
    .from("integrations")
    .select("config")
    .eq("id", integrationId)
    .eq("type", "sgp")
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  try {
    return sgpFromConfig((data as { config: unknown }).config);
  } catch (e) {
    if (e instanceof SgpError) return null;
    throw e;
  }
}
