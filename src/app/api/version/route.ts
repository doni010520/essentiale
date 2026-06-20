import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Endpoint público de diagnóstico: diz qual versão do app está REALMENTE no ar.
 * Serve pra confirmar se um deploy aplicou de fato (sem depender do Easypanel).
 * Não expõe nada sensível.
 */
export function GET() {
  return NextResponse.json(
    {
      version: APP_VERSION,
      commit: process.env.GIT_SHA ?? process.env.SOURCE_COMMIT ?? null,
      now: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
