import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type DepartmentsFilters = {
  regionId?: string;
  provinceId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 50;

export async function listDepartmentsWithStats(filters: DepartmentsFilters = {}) {
  const where: Prisma.DepartmentWhereInput = {};
  if (filters.provinceId) where.provinceId = filters.provinceId;
  else if (filters.regionId) where.province = { regionId: filters.regionId };
  if (filters.search?.trim()) {
    where.name = { contains: filters.search.trim(), mode: "insensitive" };
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  const [items, total] = await Promise.all([
    prisma.department.findMany({
      where,
      orderBy: [{ province: { name: "asc" } }, { name: "asc" }],
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
        province: {
          select: {
            id: true,
            name: true,
            region: { select: { id: true, code: true, nameEs: true } },
          },
        },
        _count: { select: { localities: true, listings: true } },
      },
    }),
    prisma.department.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getDepartmentByCode(code: string) {
  const department = await prisma.department.findUnique({
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
      images: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      lastEditedBy: { select: { id: true, name: true, email: true } },
      _count: { select: { localities: true, listings: true } },
    },
  });
  return department;
}
