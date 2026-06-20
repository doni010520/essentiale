import { Scroll } from "@/components/scroll";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { CatalogoClient } from "./catalogo-client";
import type { Product } from "./produto-modal";

async function getProducts(): Promise<Product[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("products")
    .select(
      "id, slug, nome, categoria, preco_centavos, estoque, url_produto, descricao, " +
      "caracteristicas, exemplos_de_uso, cuidados, fragrancia, " +
      "foto_arquivo, galeria, ativo, created_at",
    )
    .order("categoria")
    .order("nome")
    .limit(500);
  return (data ?? []) as unknown as Product[];
}

async function getFragrances() {
  const sb = await createClient();
  const { data } = await sb
    .from("fragrances")
    .select("id, nome, perfil, indicar_para, confirmada")
    .order("confirmada", { ascending: false })
    .order("nome");
  return data ?? [];
}

export default async function CatalogoPage() {
  const [products, fragrances] = await Promise.all([getProducts(), getFragrances()]);
  const ativos = products.filter((p) => p.ativo).length;

  return (
    <Scroll>
      <PageHeader
        title="Catálogo Essentiale"
        subtitle={`${products.length} produtos · ${ativos} ativos · ${fragrances.length} fragrâncias`}
      />
      <CatalogoClient products={products} fragrances={fragrances} />
    </Scroll>
  );
}
