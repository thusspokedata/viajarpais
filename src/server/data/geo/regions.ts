import "server-only";
import { prisma } from "@/lib/db";

/*
  Reads de Region para el admin geo. Server-only.

  `listRegionsWithStats()` devuelve las 6 regiones con conteos de
  provincias, departamentos, localidades y fichas adentro. Para los
  totales que cruzan multiples niveles (departamentos por region,
  localidades por region) usamos sub-queries via `_count` en la cadena
  Province → Department/Locality.

  En producción Postgres optimiza esto con joins, no un N+1.
*/
export async function listRegionsWithStats() {
  const regions = await prisma.region.findMany({
    orderBy: { order: "asc" },
    select: {
      id: true,
      code: true,
      nameEs: true,
      nameEn: true,
      namePtBr: true,
      taglineEs: true,
      descriptionEs: true,
      updatedAt: true,
      _count: {
        select: {
          provinces: true,
          listings: true,
        },
      },
      provinces: {
        select: {
          _count: {
            select: {
              departments: true,
              localities: true,
            },
          },
        },
      },
    },
  });

  return regions.map((r) => ({
    id: r.id,
    code: r.code,
    nameEs: r.nameEs,
    nameEn: r.nameEn,
    namePtBr: r.namePtBr,
    taglineEs: r.taglineEs,
    descriptionEs: r.descriptionEs,
    updatedAt: r.updatedAt,
    counts: {
      provinces: r._count.provinces,
      departments: r.provinces.reduce(
        (sum, p) => sum + p._count.departments,
        0,
      ),
      localities: r.provinces.reduce(
        (sum, p) => sum + p._count.localities,
        0,
      ),
      listings: r._count.listings,
    },
  }));
}

export async function getRegionByCode(code: string) {
  const region = await prisma.region.findUnique({
    where: { code },
    include: {
      images: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      lastEditedBy: { select: { id: true, name: true, email: true } },
      _count: { select: { provinces: true, listings: true } },
      provinces: {
        select: {
          _count: { select: { departments: true, localities: true } },
        },
      },
    },
  });
  if (!region) return null;
  return {
    ...region,
    counts: {
      provinces: region._count.provinces,
      departments: region.provinces.reduce(
        (sum, p) => sum + p._count.departments,
        0,
      ),
      localities: region.provinces.reduce(
        (sum, p) => sum + p._count.localities,
        0,
      ),
      listings: region._count.listings,
    },
  };
}
