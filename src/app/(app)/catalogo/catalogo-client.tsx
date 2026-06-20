"use client";

import { useCallback, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import {
  Search, Plus, LayoutGrid, LayoutList, Package, Eye, EyeOff,
  Edit2, Trash2, ExternalLink, ChevronDown, Filter,
} from "lucide-react";
import { EmptyState } from "@/components/ui";
import { ProdutoModal, type Product } from "./produto-modal";
import { toggleProductAction, deleteProductAction } from "./actions";
import { useRouter } from "next/navigation";

interface Fragrance {
  id: string;
  nome: string;
  perfil: string | null;
  indicar_para: string | null;
  confirmada: boolean;
}

const CATEGORIAS = ["Todas", "Home Spray", "Difusor", "Vela", "Refil", "Essência", "Sabonete", "Kit/Atacado", "Bem-estar", "Personalizado", "Afetos"];
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

function fotoUrl(filename: string | null): string | null {
  if (!filename) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/media/${filename}`;
}

function price(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

// ── Card de produto (grid) ────────────────────────────────────────────────────

function ProductCard({
  product, onEdit, onToggle, onDelete,
}: {
  product: Product;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const foto = fotoUrl(product.foto_arquivo);

  return (
    <div className={cn(
      "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition hover:shadow-md",
      !product.ativo && "opacity-60",
    )}>
      {/* Foto */}
      <div className="relative h-44 shrink-0 overflow-hidden bg-gray-100">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={foto}
            alt={product.nome}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package size={36} className="text-gray-300" />
          </div>
        )}

        {/* Badge categoria */}
        <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-ink-soft shadow-sm backdrop-blur">
          {product.categoria}
        </span>

        {/* Badge status */}
        <span className={cn(
          "absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm",
          product.ativo ? "bg-green-100/90 text-green-700" : "bg-red-100/90 text-red-600",
        )}>
          {product.ativo ? "Ativo" : "Inativo"}
        </span>

        {/* Galeria hint */}
        {product.galeria?.length > 0 && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
            +{product.galeria.length} fotos
          </span>
        )}

        {/* Ações hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
          <ActionBtn icon={<Edit2 size={14} />} label="Editar" onClick={onEdit} />
          <ActionBtn
            icon={product.ativo ? <EyeOff size={14} /> : <Eye size={14} />}
            label={product.ativo ? "Ocultar" : "Ativar"}
            onClick={onToggle}
          />
          {product.url_produto && (
            <ActionBtn
              icon={<ExternalLink size={14} />}
              label="Loja"
              onClick={() => window.open(product.url_produto!, "_blank")}
            />
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{product.nome}</p>
        {product.fragrancia && (
          <p className="text-xs text-ink-soft">Fragrância: {product.fragrancia}</p>
        )}
        <div className="mt-auto flex items-end justify-between pt-2">
          <p className="text-base font-bold text-brand">{price(product.preco_centavos)}</p>
          <p className="text-xs text-ink-soft">
            {product.estoque > 998 ? "∞ estoque" : `${product.estoque} un.`}
          </p>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink shadow transition hover:bg-brand hover:text-white"
    >
      {icon}
    </button>
  );
}

// ── Linha de produto (tabela) ─────────────────────────────────────────────────

function ProductRow({
  product, onEdit, onToggle, onDelete,
}: {
  product: Product;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const foto = fotoUrl(product.foto_arquivo);

  return (
    <tr className={cn("border-b border-border transition hover:bg-gray-50/70", !product.ativo && "opacity-60")}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-gray-100">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Package size={16} className="text-gray-300" />
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-ink">{product.nome}</p>
            {product.fragrancia && <p className="text-xs text-ink-soft">{product.fragrancia}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-ink-soft">{product.categoria}</td>
      <td className="px-4 py-3 text-sm font-semibold text-ink">{price(product.preco_centavos)}</td>
      <td className="px-4 py-3 text-sm text-ink-soft">
        {product.estoque > 998 ? "—" : product.estoque}
      </td>
      <td className="px-4 py-3">
        <span className={cn(
          "rounded-full px-2 py-0.5 text-xs font-medium",
          product.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500",
        )}>
          {product.ativo ? "Ativo" : "Inativo"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button onClick={onEdit} title="Editar"
            className="rounded p-1.5 text-ink-soft transition hover:bg-gray-100 hover:text-brand">
            <Edit2 size={13} />
          </button>
          <button onClick={onToggle} title={product.ativo ? "Desativar" : "Ativar"}
            className="rounded p-1.5 text-ink-soft transition hover:bg-gray-100 hover:text-ink">
            {product.ativo ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          {product.url_produto && (
            <a href={product.url_produto} target="_blank" rel="noopener noreferrer"
              className="rounded p-1.5 text-ink-soft transition hover:bg-gray-100 hover:text-brand">
              <ExternalLink size={13} />
            </a>
          )}
          <button onClick={onDelete} title="Excluir"
            className="rounded p-1.5 text-ink-soft transition hover:bg-red-50 hover:text-red-500">
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function CatalogoClient({
  products: initialProducts, fragrances,
}: {
  products: Product[];
  fragrances: Fragrance[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"produtos" | "fragrancias">("produtos");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("Todas");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativos" | "inativos">("todos");
  const [showFilters, setShowFilters] = useState(false);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Confirm delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();
  const [togglePending, startToggleTransition] = useTransition();

  const openCreate = () => { setSelectedProduct(null); setModalOpen(true); };
  const openEdit = (p: Product) => { setSelectedProduct(p); setModalOpen(true); };
  const handleSaved = () => { router.refresh(); };

  const handleToggle = useCallback(
    (product: Product) => {
      startToggleTransition(() => toggleProductAction(product.id, !product.ativo));
    },
    [],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (!window.confirm("Excluir este produto? Esta ação não pode ser desfeita.")) return;
      startDeleteTransition(async () => {
        await deleteProductAction(id);
        router.refresh();
      });
    },
    [router],
  );

  // Filtra produtos
  const filtered = initialProducts.filter((p) => {
    if (cat !== "Todas" && p.categoria !== cat) return false;
    if (statusFilter === "ativos" && !p.ativo) return false;
    if (statusFilter === "inativos" && p.ativo) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.nome.toLowerCase().includes(q) ||
        (p.fragrancia ?? "").toLowerCase().includes(q) ||
        p.slug.includes(q)
      );
    }
    return true;
  });

  const ativos = initialProducts.filter((p) => p.ativo).length;

  return (
    <>
      {/* Tabs */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex gap-1.5">
          {(["produtos", "fragrancias"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition",
                tab === t ? "bg-brand text-white shadow-sm" : "bg-gray-100 text-ink hover:bg-gray-200",
              )}
            >
              {t === "produtos" ? `Produtos (${initialProducts.length})` : `Fragrâncias (${fragrances.length})`}
            </button>
          ))}
        </div>

        {tab === "produtos" && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand/90"
          >
            <Plus size={14} /> Novo produto
          </button>
        )}
      </div>

      {/* ── Produtos ── */}
      {tab === "produtos" && (
        <>
          {/* Barra de filtros */}
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar produto, fragrância ou slug..."
                  className="w-full rounded-lg border border-border bg-surface pl-8 pr-3 py-2 text-sm outline-none focus:border-brand"
                />
              </div>

              {/* Filtro de status */}
              <div className="flex gap-1 rounded-lg border border-border bg-white p-1">
                {(["todos", "ativos", "inativos"] as const).map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={cn(
                      "rounded px-3 py-1 text-xs font-medium capitalize transition",
                      statusFilter === s ? "bg-brand text-white" : "text-ink-soft hover:text-ink",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* View toggle */}
              <div className="flex gap-1 rounded-lg border border-border bg-white p-1">
                <button onClick={() => setView("grid")}
                  className={cn("rounded p-1.5 transition", view === "grid" ? "bg-brand text-white" : "text-ink-soft hover:text-ink")}>
                  <LayoutGrid size={14} />
                </button>
                <button onClick={() => setView("table")}
                  className={cn("rounded p-1.5 transition", view === "table" ? "bg-brand text-white" : "text-ink-soft hover:text-ink")}>
                  <LayoutList size={14} />
                </button>
              </div>
            </div>

            {/* Pills de categoria */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIAS.map((c) => (
                <button key={c} onClick={() => setCat(c)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition",
                    cat === c ? "bg-brand text-white" : "bg-gray-100 text-ink-soft hover:bg-gray-200",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Resultado */}
          {filtered.length === 0 ? (
            <EmptyState
              title="Nenhum produto encontrado"
              hint={search ? "Tente outra busca." : 'Clique em "Novo produto" para começar.'}
            />
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onEdit={() => openEdit(p)}
                  onToggle={() => handleToggle(p)}
                  onDelete={() => handleDelete(p.id)}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50 text-left text-xs font-medium text-ink-soft">
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3">Preço</th>
                    <th className="px-4 py-3">Estoque</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <ProductRow
                      key={p.id}
                      product={p}
                      onEdit={() => openEdit(p)}
                      onToggle={() => handleToggle(p)}
                      onDelete={() => handleDelete(p.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-ink-soft">
            {filtered.length} produto{filtered.length !== 1 ? "s" : ""} exibido{filtered.length !== 1 ? "s" : ""} · {ativos} ativos
          </p>
        </>
      )}

      {/* ── Fragrâncias ── */}
      {tab === "fragrancias" && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50 text-left text-xs font-medium text-ink-soft">
                <th className="px-4 py-3">Fragrância</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Indicada para</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {fragrances.map((f) => (
                <tr key={f.id} className="border-b border-border hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-ink">{f.nome}</td>
                  <td className="px-4 py-3 text-ink-soft">{f.perfil ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{f.indicar_para ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      f.confirmada ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500",
                    )}>
                      {f.confirmada ? "Confirmada" : "Em catálogo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal produto */}
      <ProdutoModal
        product={selectedProduct}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </>
  );
}
