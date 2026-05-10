import "server-only";
import { prisma } from "@/lib/db";

export async function listProvincesWithStats(filters: { regionId?: string } = {}) {
  const provinces = await prisma.province.findMany({
    where: filters.regionId ? { regionId: filters.regionId } : undefined,
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      slug: true,
      name: true,
      taglineEs: true,
      descriptionEs: true,
      updatedAt: true,
      regionId: true,
      region: { select: { id: true, code: true, nameEs: true } },
      _count: {
        select: { departments: true, localities: true, listings: true },
      },
    },
  });
  return provinces;
}

export async function getProvinceByCode(code: string) {
  const province = await prisma.province.findUnique({
    where: { code },
    include: {
      region: { select: { id: true, code: true, nameEs: true } },
      images: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      lastEditedBy: { select: { id: true, name: true, email: true } },
      _count: { select: { departments: true, localities: true, listings: true } },
    },
  });
  return province;
}

export async function listProvinceOptions() {
  return prisma.province.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      regionId: true,
      region: { select: { code: true, nameEs: true } },
    },
  });
}
