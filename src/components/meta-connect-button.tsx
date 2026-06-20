"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { finalizeMetaCoexistence } from "@/app/(app)/canais/actions";

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID;
const GRAPH_V = process.env.NEXT_PUBLIC_META_GRAPH_VERSION || "v23.0";

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

export function MetaConnectButton({ onConnected }: { onConnected?: () => void }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionInfo = useRef<{ waba_id?: string; phone_number_id?: string }>({});

  useEffect(() => {
    if (!APP_ID) return;

    function onMessage(ev: MessageEvent) {
      let host = "";
      try {
        host = new URL(ev.origin).hostname;
      } catch {
        return;
      }
      if (!host.endsWith("facebook.com")) return;
      try {
        const data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data?.data) {
          sessionInfo.current = {
            waba_id: data.data.waba_id,
            phone_number_id: data.data.phone_number_id,
          };
        }
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("message", onMessage);

    if (!window.FB) {
      window.fbAsyncInit = () => {
        window.FB.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: false, version: GRAPH_V });
        setReady(true);
      };
      const s = document.createElement("script");
      s.src = "https://connect.facebook.net/en_US/sdk.js";
      s.async = true;
      s.defer = true;
      s.crossOrigin = "anonymous";
      document.body.appendChild(s);
    } else {
      setReady(true);
    }
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const launch = useCallback(() => {
    const FB = window.FB;
    if (!FB) return;
    setError(null);
    FB.login(
      (response: any) => {
        const code = response?.authResponse?.code;
        if (!code) {
          setError("Login cancelado.");
          return;
        }
        const { waba_id, phone_number_id } = sessionInfo.current;
        if (!waba_id || !phone_number_id) {
          setError("Não recebi os dados da conta (WABA/número). Tente novamente.");
          return;
        }
        setPending(true);
        finalizeMetaCoexistence({ code, wabaId: waba_id, phoneNumberId: phone_number_id })
          .then(() => {
            onConnected?.();
            router.refresh();
          })
          .catch((e) => setError(e instanceof Error ? e.message : "Erro ao conectar."))
          .finally(() => setPending(false));
      },
      {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          // Sub-fluxo de coexistência (número já no app WhatsApp Business).
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3",
        },
      },
    );
  }, [router, onConnected]);

  if (!APP_ID || !CONFIG_ID) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Configure as variáveis <code>NEXT_PUBLIC_META_APP_ID</code> e{" "}
        <code>NEXT_PUBLIC_META_CONFIG_ID</code> (após aprovação como Tech Provider) para conectar via
        Embedded Signup / Coexistência.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={launch}
        disabled={!ready || pending}
        className="w-full rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#166fe0] disabled:opacity-50"
      >
        {pending ? "Conectando..." : "Conectar com a Meta (Coexistência)"}
      </button>
      <p className="text-[11px] text-ink-soft">
        Você vai confirmar o número e escanear um QR no app WhatsApp Business para parear.
      </p>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
