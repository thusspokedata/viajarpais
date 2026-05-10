import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type LocalitiesFilters = {
  regionId?: string;
  provinceId?: string;
  departmentId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 50;

export async function listLocalitiesWithStats(filters: LocalitiesFilters = {}) {
  const where: Prisma.LocalityWhereInput = {};
  if (filters.departmentId) where.departmentId = filters.departmentId;
  else if (filters.provinceId) where.provinceId = filters.provinceId;
  else if (filters.regionId)
    where.province = { regionId: filters.regionId };
  if (filters.search?.trim()) {
    where.name = { contains: filters.search.trim(), mode: "insensitive" };
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  const [items, total] = await Promise.all([
    prisma.locality.findMany({
      where,
      orderBy: [
        { province: { name: "asc" } },
        { department: { name: "asc" } },
        { name: "asc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        code: true,
        slug: true,
        name: true,
        taglineEs: true,
        descriptionEs: true,
        updatedAt: true,
        provinceId: true,
        departmentId: true,
        province: {
          select: {
            id: true,
            name: true,
            region: { select: { id: true, code: true, nameEs: true } },
          },
        },
        department: { select: { id: true, name: true } },
        _count: { select: { listings: true } },
      },
    }),
    prisma.locality.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getLocalityByCode(code: string) {
  const locality = await prisma.locality.findUnique({
    where: { code },
    include: {
      province: {
        select: {
          id: true,
          code: true,
          name: true,
          region: { select: { id: true, code: true, nameEs: true } },
        },
      },
      department: { select: { id: true, code: true, name: true } },
      images: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      lastEditedBy: { select: { id: true, name: true, email: true } },
      _count: { select: { listings: true } },
    },
  });
  return locality;
}
