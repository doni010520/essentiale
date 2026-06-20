"use server";

import { revalidatePath } from "next/cache";
import { orgInsert, orgUpdate, orgDelete } from "@/lib/crud-helpers";
import { AutomationSchema, fdToObj, parse } from "@/lib/validation";

export async function createAutomation(fd: FormData) {
  const input = parse(AutomationSchema, fdToObj(fd));
  await orgInsert("automations", {
    name: input.name,
    channel_id: input.channel_id ?? null,
    integration_id: input.integration_id ?? null,
    trigger: input.trigger ?? null,
  });
  revalidatePath("/automacoes");
}

export async function updateAutomationConfig(
  id: string,
  data: { integration_id?: string | null; schedule?: unknown },
) {
  await orgUpdate("automations", id, { ...data, updated_at: new Date().toISOString() });
  revalidatePath("/automacoes");
}
export async function toggleAutomation(id: string, active: boolean) {
  await orgUpdate("automations", id, { active, updated_at: new Date().toISOString() });
  revalidatePath("/automacoes");
}
export async function deleteAutomation(id: string) {
  await orgDelete("automations", id);
  revalidatePath("/automacoes");
}

export async function updateAutomationFlow(id: string, flowJson: string) {
  let flow: unknown;
  try {
    flow = JSON.parse(flowJson);
  } catch {
    throw new Error("Fluxo inválido.");
  }
  await orgUpdate("automations", id, { flow, updated_at: new Date().toISOString() });
  revalidatePath(`/automacoes/${id}`);
}
