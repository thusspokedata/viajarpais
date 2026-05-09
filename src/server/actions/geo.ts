"use server";

import { requireRole } from "@/lib/authz";
import {
  listDepartmentsByProvince as readDepartments,
  listLocalitiesByDepartment as readLocalities,
} from "@/server/data/geo";

/**
 * Server actions para que el client component del form admin pueda
 * cargar departamentos y localidades en cascada al cambiar el select
 * superior. Gateadas por rol porque solo el admin las llama desde el
 * form — no exponemos un endpoint público de geo en v0.2.a.
 */

export async function getDepartmentsByProvinceAction(provinceId: string) {
  await requireRole(["ADMIN", "EDITOR"]);
  return readDepartments(provinceId);
}

export async function getLocalitiesByDepartmentAction(departmentId: string) {
  await requireRole(["ADMIN", "EDITOR"]);
  return readLocalities(departmentId);
}
