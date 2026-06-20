"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { setTotpEnabled } from "@/app/(app)/perfil/actions";

type Factor = { id: string; status: string };

export function TwoFactorSetup({ enabled }: { enabled?: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  // Estado de enrollment em curso.
  const [enrolling, setEnrolling] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verified = factors.filter((f) => f.status === "verified");
  const active = verified.length > 0 || enabled;

  async function refresh() {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    const all = [...(data?.totp ?? [])] as Factor[];
    setFactors(all);
    setLoading(false);
    return all;
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function startEnroll() {
    setError(null);
    setBusy(true);
    try {
      // Remove fatores não verificados pendentes (evita "factor already exists").
      const existing = await refresh();
      for (const f of existing) {
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao iniciar o 2FA.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll() {
    if (!enrolling || code.trim().length < 6) return;
    setError(null);
    setBusy(true);
    try {
      const ch = await supabase.auth.mfa.challenge({ factorId: enrolling.factorId });
      if (ch.error) throw ch.error;
      const v = await supabase.auth.mfa.verify({
        factorId: enrolling.factorId,
        challengeId: ch.data.id,
        code: code.trim(),
      });
      if (v.error) throw v.error;
      await setTotpEnabled(true);
      setEnrolling(null);
      setCode("");
      await refresh();
      router.refresh();
    } catch {
      setError("Código inválido. Verifique o app autenticador e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!confirm("Desativar a autenticação em dois fatores?")) return;
    setBusy(true);
    setError(null);
    try {
      const all = await refresh();
      for (const f of all) await supabase.auth.mfa.unenroll({ factorId: f.id });
      await setTotpEnabled(false);
      setEnrolling(null);
      await refresh();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao desativar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-4 max-w-xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">Autenticação em dois fatores (2FA)</h3>
          <p className="text-xs text-ink-soft">Adicione uma camada extra de segurança com um app autenticador (TOTP).</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-green-100 text-green-700" : "bg-gray-100 text-ink-soft"}`}>
          {active ? <ShieldCheck size={12} /> : <ShieldOff size={12} />}
          {active ? "2FA ativo" : "Desativado"}
        </span>
      </div>

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-ink-soft"><Loader2 size={14} className="animate-spin" /> Carregando…</p>
      ) : enrolling ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-ink-soft">1. Escaneie o QR Code no Google Authenticator, Authy ou similar:</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrolling.qr} alt="QR Code 2FA" className="h-44 w-44 rounded-lg border border-border bg-white p-1" />
          <p className="text-xs text-ink-soft">Ou insira o código manual: <code className="rounded bg-gray-100 px-1 font-mono text-[11px]">{enrolling.secret}</code></p>
          <p className="text-xs text-ink-soft">2. Digite o código de 6 dígitos gerado:</p>
          <div className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric" placeholder="000000"
              className="w-32 rounded-lg border border-border px-3 py-2 text-center font-mono text-sm tracking-widest outline-none focus:border-brand" />
            <Button onClick={confirmEnroll} disabled={busy || code.length < 6}>{busy ? "Verificando…" : "Confirmar"}</Button>
            <Button variant="ghost" onClick={() => { setEnrolling(null); setCode(""); }}>Cancelar</Button>
          </div>
        </div>
      ) : active ? (
        <div className="mt-4">
          <p className="text-xs text-ink-soft">A autenticação em dois fatores está ativa. No próximo login será pedido o código do app.</p>
          <Button variant="ghost" onClick={disable} disabled={busy} className="mt-3 text-danger">
            {busy ? "Desativando…" : "Desativar 2FA"}
          </Button>
        </div>
      ) : (
        <div className="mt-4">
          <Button onClick={startEnroll} disabled={busy}>{busy ? "Preparando…" : "Ativar 2FA"}</Button>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
    </Card>
  );
}
