"use server";

import { revalidatePath } from "next/cache";
import { orgInsert, orgUpdate, orgDelete } from "@/lib/crud-helpers";

function parseSurvey(fd: FormData) {
  const max = parseInt(String(fd.get("scale_max") || "5"), 10);
  return {
    name: String(fd.get("name") || "").trim(),
    question: String(fd.get("question") || "De 1 a 5, como você avalia o nosso atendimento?").trim(),
    scale_type: String(fd.get("scale_type") || "stars"),
    scale_max: Number.isFinite(max) && max >= 2 && max <= 10 ? max : 5,
    channels: fd.getAll("channels").map(String).filter(Boolean),
    close_after_min: parseInt(String(fd.get("close_after_min") || "30"), 10),
    active: fd.get("active") === "on",
  };
}

export async function createSurvey(fd: FormData) {
  await orgInsert("satisfaction_surveys", parseSurvey(fd));
  revalidatePath("/ajustes/satisfacao");
}

export async function updateSurvey(id: string, fd: FormData) {
  await orgUpdate("satisfaction_surveys", id, parseSurvey(fd));
  revalidatePath("/ajustes/satisfacao");
}

export async function deleteSurvey(id: string) {
  await orgDelete("satisfaction_surveys", id);
  revalidatePath("/ajustes/satisfacao");
}
