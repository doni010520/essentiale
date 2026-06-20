"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X, Plus, Trash2, Loader2, ExternalLink, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FotoUpload, GaleriaUpload } from "./foto-upload";
import { createProductAction, updateProductAction, type ProductFormData } from "./actions";

export interface Product {
  id: string;
  slug: string;
  nome: string;
  categoria: string;
  preco_centavos: number;
  estoque: number;
  url_produto: string | null;
  descricao: string | null;
  caracteristicas: string[];
  exemplos_de_uso: string[];
  cuidados: string | null;
  fragrancia: string | null;
  foto_arquivo: string | null;
  galeria: string[];
  ativo: boolean;
}

interface Props {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORIAS = [
  "Home Spray", "Difusor", "Vela", "Refil",
  "Essência", "Sabonete", "Kit/Atacado", "Bem-estar",
  "Personalizado", "Afetos",
];

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// ── Campo de texto simples ────────────────────────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-ink-soft">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-gray-400 focus:border-brand focus:ring-1 focus:ring-brand/20";
const textareaCls = `${inputCls} resize-none`;

// ── Input de chips (array de strings) ────────────────────────────────────────

function ChipInput({
  value, onChange, placeholder,
}: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setInput("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
          placeholder={placeholder ?? "Adicionar…"}
          className={cn(inputCls, "flex-1")}
        />
        <button
          type="button"
          onClick={add}
          disabled={!input.trim()}
          className="flex items-center gap-1 rounded-lg border border-brand px-3 text-sm font-medium text-brand transition hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={14} /> Add
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className="flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
              {v}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────

type Tab = "basico" | "conteudo" | "fotos";

const TABS: { id: Tab; label: string }[] = [
  { id: "basico", label: "Básico" },
  { id: "conteudo", label: "Conteúdo" },
  { id: "fotos", label: "Fotos" },
];

const EMPTY: ProductFormData = {
  nome: "", slug: "", categoria: "Home Spray",
  preco_centavos: 0, estoque: 999,
  url_produto: "", descricao: "",
  caracteristicas: [], exemplos_de_uso: [],
  cuidados: "", fragrancia: "",
  foto_arquivo: "", galeria: [], ativo: true,
};

export function ProdutoModal({ product, open, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>("basico");
  const [form, setForm] = useState<ProductFormData>(EMPTY);
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Inicializa form ao abrir
  useEffect(() => {
    if (!open) return;
    setTab("basico");
    setError("");
    setSlugEdited(!!product);
    if (product) {
      setForm({
        nome: product.nome,
        slug: product.slug,
        categoria: product.categoria,
        preco_centavos: product.preco_centavos,
        estoque: product.estoque,
        url_produto: product.url_produto ?? "",
        descricao: product.descricao ?? "",
        caracteristicas: product.caracteristicas ?? [],
        exemplos_de_uso: product.exemplos_de_uso ?? [],
        cuidados: product.cuidados ?? "",
        fragrancia: product.fragrancia ?? "",
        foto_arquivo: product.foto_arquivo ?? "",
        galeria: product.galeria ?? [],
        ativo: product.ativo,
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, product]);

  // Auto-slug ao digitar nome (só se não editou o slug manualmente)
  const setNome = (nome: string) => {
    setForm((f) => ({
      ...f,
      nome,
      slug: slugEdited ? f.slug : slugify(nome),
    }));
  };

  const set = <K extends keyof ProductFormData>(k: K, v: ProductFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) { setError("Nome é obrigatório."); return; }
    if (!form.slug.trim()) { setError("Slug é obrigatório."); return; }
    if (!form.categoria) { setError("Categoria é obrigatória."); return; }
    setError("");

    startTransition(async () => {
      const result = product
        ? await updateProductAction(product.id, form)
        : await createProductAction(form);

      if (!result.ok) {
        setError(result.error ?? "Erro ao salvar.");
        return;
      }
      onSaved();
      onClose();
    });
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-over */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">
              {product ? "Editar produto" : "Novo produto"}
            </h2>
            {product && (
              <p className="mt-0.5 truncate text-xs text-ink-soft">slug: {product.slug}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {product?.url_produto && (
              <a
                href={product.url_produto}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-ink-soft transition hover:border-brand hover:text-brand"
              >
                <ExternalLink size={12} /> Ver na loja
              </a>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-gray-100 hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "border-b-2 px-4 py-3 text-sm font-medium transition",
                tab === t.id
                  ? "border-brand text-brand"
                  : "border-transparent text-ink-soft hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* ── Aba Básico ── */}
            {tab === "basico" && (
              <div className="space-y-4">
                <Field label="Nome do produto *">
                  <input
                    value={form.nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Home Spray Felicità 250ml"
                    className={inputCls}
                    required
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Slug (URL) *" hint="Gerado automaticamente do nome">
                    <input
                      value={form.slug}
                      onChange={(e) => { setSlugEdited(true); set("slug", e.target.value); }}
                      placeholder="home-spray-felicita-250ml"
                      className={cn(inputCls, "font-mono text-xs")}
                      required
                    />
                  </Field>

                  <Field label="Categoria *">
                    <div className="relative">
                      <select
                        value={form.categoria}
                        onChange={(e) => set("categoria", e.target.value)}
                        className={cn(inputCls, "appearance-none pr-8")}
                        required
                      >
                        {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                    </div>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Preço (R$) *">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={(form.preco_centavos / 100).toFixed(2)}
                      onChange={(e) => set("preco_centavos", Math.round(parseFloat(e.target.value || "0") * 100))}
                      className={inputCls}
                    />
                  </Field>

                  <Field label="Estoque">
                    <input
                      type="number"
                      min="0"
                      value={form.estoque}
                      onChange={(e) => set("estoque", parseInt(e.target.value || "0", 10))}
                      className={inputCls}
                    />
                  </Field>
                </div>

                <Field label="Fragrância" hint="Se aplicável (ex: Felicità, Poésie, Avelinè)">
                  <input
                    value={form.fragrancia ?? ""}
                    onChange={(e) => set("fragrancia", e.target.value)}
                    placeholder="Felicità"
                    className={inputCls}
                  />
                </Field>

                <Field label="URL do produto na loja" hint="Link para o produto no NuvemShop / site">
                  <input
                    type="url"
                    value={form.url_produto ?? ""}
                    onChange={(e) => set("url_produto", e.target.value)}
                    placeholder="https://www.essentialefragrance.com.br/produtos/..."
                    className={inputCls}
                  />
                </Field>

                <div className="flex items-center gap-3 rounded-xl border border-border bg-gray-50 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => set("ativo", !form.ativo)}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      form.ativo ? "bg-brand" : "bg-gray-300",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                        form.ativo ? "translate-x-4" : "translate-x-0.5",
                      )}
                    />
                  </button>
                  <span className="text-sm text-ink">
                    {form.ativo ? "Produto ativo (visível para a Caroline)" : "Produto inativo (oculto)"}
                  </span>
                </div>
              </div>
            )}

            {/* ── Aba Conteúdo ── */}
            {tab === "conteudo" && (
              <div className="space-y-5">
                <Field label="Descrição" hint="Texto principal do produto — sensorial, emocional">
                  <textarea
                    value={form.descricao ?? ""}
                    onChange={(e) => set("descricao", e.target.value)}
                    rows={4}
                    placeholder="Descreva o produto pelo benefício sensorial e emocional que proporciona..."
                    className={textareaCls}
                  />
                </Field>

                <Field label="Características" hint="Pressione Enter ou vírgula para adicionar">
                  <ChipInput
                    value={form.caracteristicas ?? []}
                    onChange={(v) => set("caracteristicas", v)}
                    placeholder="Ex: Perfuma até 40m², longa duração..."
                  />
                </Field>

                <Field label="Exemplos de uso" hint="Como e onde usar o produto">
                  <ChipInput
                    value={form.exemplos_de_uso ?? []}
                    onChange={(v) => set("exemplos_de_uso", v)}
                    placeholder="Ex: Sala de estar, quarto, escritório..."
                  />
                </Field>

                <Field label="Cuidados e modo de usar" hint="Instruções, alertas de segurança">
                  <textarea
                    value={form.cuidados ?? ""}
                    onChange={(e) => set("cuidados", e.target.value)}
                    rows={3}
                    placeholder="Modo de usar, ingredientes, cuidados..."
                    className={textareaCls}
                  />
                </Field>
              </div>
            )}

            {/* ── Aba Fotos ── */}
            {tab === "fotos" && (
              <div className="space-y-6">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs text-amber-800">
                    <strong>Dica:</strong> A foto principal é enviada pela Caroline no WhatsApp quando o cliente pede para ver o produto. Use imagens em WEBP para melhor desempenho.
                  </p>
                </div>

                <FotoUpload
                  value={form.foto_arquivo || null}
                  slug={form.slug || "produto"}
                  label="Foto principal"
                  onUpload={(filename) => set("foto_arquivo", filename)}
                  onRemove={() => set("foto_arquivo", "")}
                />

                <hr className="border-border" />

                <GaleriaUpload
                  value={form.galeria ?? []}
                  slug={form.slug || "produto"}
                  onChange={(filenames) => set("galeria", filenames)}
                />

                <div className="rounded-xl border border-border bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs font-medium text-ink-soft">Chave do arquivo (foto_arquivo)</p>
                  <code className="text-xs text-ink">
                    {form.foto_arquivo || <span className="italic text-gray-400">Nenhuma foto enviada</span>}
                  </code>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            {error ? (
              <p className="text-xs text-red-600">{error}</p>
            ) : (
              <p className="text-xs text-ink-soft">
                {product ? "Alterações são salvas no catálogo imediatamente." : "O produto ficará ativo assim que salvo."}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-2 text-sm text-ink-soft transition hover:border-gray-400 hover:text-ink"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                {product ? "Salvar alterações" : "Criar produto"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
