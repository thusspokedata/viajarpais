import "server-only";
import { prisma } from "@/lib/db";

/**
 * Lecturas para la cascada Provincia → Departamento → Localidad.
 *
 * Estos datos cambian solo al re-correr el seed. Para v0.2.a las queries
 * van directo a Neon en cada request — Cache Components todavía no está
 * habilitado en `next.config.ts`. Si en el futuro lo activamos, envolver
 * cada función con `"use cache"` + `cacheTag("geo")` y revalidar el tag
 * cuando corra el seed.
 */

export async function listProvinces() {
  return prisma.province.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
}

export async function listDepartmentsByProvince(provinceId: string) {
  if (!provinceId) return [];
  return prisma.department.findMany({
    where: { provinceId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
}

export async function listLocalitiesByDepartment(departmentId: string) {
  if (!departmentId) return [];
  return prisma.locality.findMany({
    where: { departmentId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
}

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { order: "asc" },
    select: {
      id: true,
      slug: true,
      nameEs: true,
      nameSingularEs: true,
      icon: true,
    },
  });
}
