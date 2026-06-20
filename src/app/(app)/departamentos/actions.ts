"use server";

import { revalidatePath } from "next/cache";
import { orgInsert, orgUpdate, orgDelete } from "@/lib/crud-helpers";
import { DepartmentSchema, fdToObj, parse } from "@/lib/validation";

export async function createDepartment(fd: FormData) {
  const input = parse(DepartmentSchema, fdToObj(fd));
  await orgInsert("departments", { name: input.name, color: input.color });
  revalidatePath("/departamentos");
}

export async function updateDepartment(id: string, fd: FormData) {
  const input = parse(DepartmentSchema, fdToObj(fd));
  await orgUpdate("departments", id, { name: input.name, color: input.color });
  revalidatePath("/departamentos");
}

export async function deleteDepartment(id: string) {
  await orgDelete("departments", id);
  revalidatePath("/departamentos");
}
