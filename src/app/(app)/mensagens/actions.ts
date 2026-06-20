"use server";

import { revalidatePath } from "next/cache";
import { orgInsert, orgUpdate, orgDelete } from "@/lib/crud-helpers";
import type { QuickReply } from "@/lib/types";

function parse(fd: FormData) {
  return {
    title: String(fd.get("title") || "").trim(),
    content: String(fd.get("content") || "").trim(),
    shortcut: String(fd.get("shortcut") || "").trim() || null,
  };
}

export async function createQuickReply(kind: QuickReply["kind"], fd: FormData) {
  await orgInsert("quick_replies", { ...parse(fd), kind });
  revalidatePath("/mensagens/modelo");
  revalidatePath("/mensagens/macros");
}
export async function updateQuickReply(id: string, fd: FormData) {
  await orgUpdate("quick_replies", id, parse(fd));
  revalidatePath("/mensagens/modelo");
  revalidatePath("/mensagens/macros");
}
export async function deleteQuickReply(id: string) {
  await orgDelete("quick_replies", id);
  revalidatePath("/mensagens/modelo");
  revalidatePath("/mensagens/macros");
}
