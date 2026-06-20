"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";

const ORG = "aaaaaaaa-0000-0000-0000-000000000001";

export interface ProductFormData {
  nome: string;
  slug: string;
  categoria: string;
  preco_centavos: number;
  estoque: number;
  url_produto?: string;
  descricao?: string;
  caracteristicas?: string[];
  exemplos_de_uso?: string[];
  cuidados?: string;
  fragrancia?: string;
  foto_arquivo?: string;
  galeria?: string[];
  ativo: boolean;
}

export async function createProductAction(
  data: ProductFormData,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const db = createServiceClient();
  const { data: row, error } = await db
    .from("products")
    .insert({
      organization_id: ORG,
      nome: data.nome.trim(),
      slug: data.slug.trim(),
      categoria: data.categoria,
      preco_centavos: data.preco_centavos,
      estoque: data.estoque,
      url_produto: data.url_produto?.trim() || null,
      descricao: data.descricao?.trim() || null,
      caracteristicas: data.caracteristicas ?? [],
      exemplos_de_uso: data.exemplos_de_uso ?? [],
      cuidados: data.cuidados?.trim() || null,
      fragrancia: data.fragrancia?.trim() || null,
      foto_arquivo: data.foto_arquivo || null,
      galeria: data.galeria ?? [],
      ativo: data.ativo,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/catalogo");
  return { ok: true, id: row.id };
}

export async function updateProductAction(
  id: string,
  data: Partial<ProductFormData>,
): Promise<{ ok: boolean; error?: string }> {
  const db = createServiceClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (data.nome !== undefined) patch.nome = data.nome.trim();
  if (data.slug !== undefined) patch.slug = data.slug.trim();
  if (data.categoria !== undefined) patch.categoria = data.categoria;
  if (data.preco_centavos !== undefined) patch.preco_centavos = data.preco_centavos;
  if (data.estoque !== undefined) patch.estoque = data.estoque;
  if (data.url_produto !== undefined) patch.url_produto = data.url_produto?.trim() || null;
  if (data.descricao !== undefined) patch.descricao = data.descricao?.trim() || null;
  if (data.caracteristicas !== undefined) patch.caracteristicas = data.caracteristicas;
  if (data.exemplos_de_uso !== undefined) patch.exemplos_de_uso = data.exemplos_de_uso;
  if (data.cuidados !== undefined) patch.cuidados = data.cuidados?.trim() || null;
  if (data.fragrancia !== undefined) patch.fragrancia = data.fragrancia?.trim() || null;
  if (data.foto_arquivo !== undefined) patch.foto_arquivo = data.foto_arquivo || null;
  if (data.galeria !== undefined) patch.galeria = data.galeria;
  if (data.ativo !== undefined) patch.ativo = data.ativo;

  const { error } = await db.from("products").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/catalogo");
  return { ok: true };
}

export async function deleteProductAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = createServiceClient();
  const { error } = await db.from("products").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/catalogo");
  return { ok: true };
}

export async function toggleProductAction(id: string, ativo: boolean) {
  const db = createServiceClient();
  await db
    .from("products")
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/catalogo");
}
