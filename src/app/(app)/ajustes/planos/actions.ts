"use server";

import { revalidatePath } from "next/cache";
import { orgInsert, orgUpdate, orgDelete } from "@/lib/crud-helpers";

function parse(fd: FormData) {
  const priceRaw = String(fd.get("price") || "").replace(",", ".");
  return {
    name: String(fd.get("name") || "").trim(),
    price: priceRaw ? Number(priceRaw) : null,
    description: String(fd.get("description") || "").trim() || null,
  };
}

export async function createPlan(fd: FormData) {
  await orgInsert("plans", parse(fd));
  revalidatePath("/ajustes/planos");
}
export async function updatePlan(id: string, fd: FormData) {
  await orgUpdate("plans", id, parse(fd));
  revalidatePath("/ajustes/planos");
}
export async function deletePlan(id: string) {
  await orgDelete("plans", id);
  revalidatePath("/ajustes/planos");
}
