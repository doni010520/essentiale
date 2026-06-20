"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui";
import { createChannel } from "@/app/(app)/canais/actions";
import { QrConnectModal } from "@/components/qr-connect-modal";

type ChannelType = "uazapi" | "meta_cloud";

export function NewChannelDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ChannelType>("uazapi");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrChannel, setQrChannel] = useState<{ id: string; qr?: string; phone?: string } | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const phone = String(formData.get("phone") || "").replace(/\D/g, "");
      const res = await createChannel(formData);
      setOpen(false);
      if (type === "uazapi" && res.status !== "connected") {
        setQrChannel({ id: res.id, qr: res.qrCode, phone });
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao cadastrar canal.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} /> Cadastrar
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-card bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Novo canal</h2>
              <button onClick={() => setOpen(false)} className="text-ink-soft hover:text-ink">
                <X size={18} />
              </button>
            </div>

            <form action={onSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Tipo de conexão</label>
                <div className="grid grid-cols-2 gap-2">
                  <TypeOption
                    label="WhatsApp (QR Code)"
                    desc="Via UAZAPI"
                    active={type === "uazapi"}
                    onClick={() => setType("uazapi")}
                  />
                  <TypeOption
                    label="API Oficial"
                    desc="Meta Cloud API"
                    active={type === "meta_cloud"}
                    onClick={() => setType("meta_cloud")}
                  />
                </div>
                <input type="hidden" name="type" value={type} />
              </div>

              <Field name="name" label="Nome do canal" placeholder="Como vai identificar o canal?" required />
              <Field
                name="phone"
                label="Número (com DDI)"
                placeholder="55 73 9XXXX-XXXX"
                required={type === "meta_cloud"}
              />

              {type === "meta_cloud" && (
                <>
                  <Field name="phone_number_id" label="Phone Number ID" placeholder="Ex: 120596359925687" required />
                  <Field name="waba_id" label="WhatsApp Business Account ID (WABA)" placeholder="Ex: 166623730459..." />
                  <Field name="access_token" label="Token permanente" placeholder="Token do System User (EAAV...)" required />
                  <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    Obtenha o Phone Number ID e o token permanente no{" "}
                    <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="underline">
                      Meta for Developers
                    </a>{" "}
                    → WhatsApp → Configuração da produção.
                  </p>
                </>
              )}

              {type === "uazapi" && (
                <p className="rounded-lg bg-brand-light px-3 py-2 text-xs text-brand-dark">
                  Após cadastrar, será gerado um QR Code para você escanear no WhatsApp.
                </p>
              )}

              {error && <p className="text-xs text-danger">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Salvando..." : "Cadastrar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {qrChannel && (
        <QrConnectModal
          channelId={qrChannel.id}
          initialQr={qrChannel.qr}
          initialPhone={qrChannel.phone}
          onClose={() => {
            setQrChannel(null);
            router.refresh();
          }}
          onConnected={() => {
            setQrChannel(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function TypeOption({
  label,
  desc,
  active,
  onClick,
}: {
  label: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-3 text-left transition ${
        active ? "border-brand bg-brand-light" : "border-border hover:border-gray-300"
      }`}
    >
      <p className="text-sm font-medium text-ink">{label}</p>
      <p className="text-xs text-ink-soft">{desc}</p>
    </button>
  );
}

function Field({
  name,
  label,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-soft">{label}</label>
      <input
        name={name}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand"
      />
    </div>
  );
}
