"use server";

import { revalidatePath } from "next/cache";
import { orgInsert, orgUpdate, orgDelete } from "@/lib/crud-helpers";
import type { TagScope } from "@/lib/types";

export async function createTag(scope: TagScope, fd: FormData) {
  await orgInsert("tags", {
    name: String(fd.get("name") || "").trim(),
    color: String(fd.get("color") || "#00a8ff"),
    scope,
  });
  revalidatePath("/ajustes/tags");
}

export async function updateTag(id: string, fd: FormData) {
  await orgUpdate("tags", id, {
    name: String(fd.get("name") || "").trim(),
    color: String(fd.get("color") || "#00a8ff"),
  });
  revalidatePath("/ajustes/tags");
}

export async function deleteTag(id: string) {
  await orgDelete("tags", id);
  revalidatePath("/ajustes/tags");
}
