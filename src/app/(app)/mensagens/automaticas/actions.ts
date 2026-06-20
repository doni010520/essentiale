"use server";

import { revalidatePath } from "next/cache";
import { orgInsert, orgUpdate, orgDelete } from "@/lib/crud-helpers";

function parse(fd: FormData) {
  return {
    event: String(fd.get("event") || "welcome"),
    body: String(fd.get("body") || "").trim(),
    active: fd.get("active") === "on",
    interval_min: parseInt(String(fd.get("interval_min") || "0"), 10) || null,
    channel_id: String(fd.get("channel_id") || "") || null,
    department_id: String(fd.get("department_id") || "") || null,
  };
}

export async function createAutoMessage(fd: FormData) {
  await orgInsert("auto_messages", parse(fd));
  revalidatePath("/mensagens/automaticas");
}

export async function updateAutoMessage(id: string, fd: FormData) {
  await orgUpdate("auto_messages", id, parse(fd));
  revalidatePath("/mensagens/automaticas");
}

export async function deleteAutoMessage(id: string) {
  await orgDelete("auto_messages", id);
  revalidatePath("/mensagens/automaticas");
}
