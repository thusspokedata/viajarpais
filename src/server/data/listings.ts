import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type ListingsFilters = {
  search?: string;
  status?: ("DRAFT" | "PUBLISHED" | "ARCHIVED")[];
  tier?: ("FREE" | "PAID" | "FEATURED")[];
  provinceId?: string;
  departmentId?: string;
  localityId?: string;
  categoryId?: string;
  verified?: "yes" | "no" | "all";
};

export type ListingsPagination = {
  page: number;
  pageSize: number;
};

export const DEFAULT_PAGE_SIZE = 20;

/**
 * Lista de fichas para el admin con filtros y paginación.
 * Ordena por updatedAt desc. Por default oculta ARCHIVED salvo que se
 * lo pida explícitamente vía `status`.
 */
export async function listListings(
  filters: ListingsFilters,
  pagination: ListingsPagination,
) {
  const where: Prisma.ListingWhereInput = {};

  if (filters.status && filters.status.length > 0) {
    where.status = { in: filters.status };
  } else {
    where.status = { not: "ARCHIVED" };
  }

  if (filters.tier && filters.tier.length > 0) {
    where.tier = { in: filters.tier };
  }

  if (filters.provinceId) where.provinceId = filters.provinceId;
  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.localityId) where.localityId = filters.localityId;

  if (filters.categoryId) {
    where.categories = { some: { categoryId: filters.categoryId } };
  }

  if (filters.verified === "yes") where.verifiedAt = { not: null };
  else if (filters.verified === "no") where.verifiedAt = null;

  if (filters.search && filters.search.trim()) {
    where.name = { contains: filters.search.trim(), mode: "insensitive" };
  }

  const skip = Math.max(0, (pagination.page - 1) * pagination.pageSize);

  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: pagination.pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        tier: true,
        verifiedAt: true,
        verifiedUntil: true,
        updatedAt: true,
        locality: { select: { id: true, name: true } },
        province: { select: { id: true, name: true } },
        categories: {
          select: {
            isPrimary: true,
            category: {
              select: { id: true, slug: true, nameEs: true, nameSingularEs: true },
            },
          },
        },
      },
    }),
    prisma.listing.count({ where }),
  ]);

  return {
    items,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    pageCount: Math.max(1, Math.ceil(total / pagination.pageSize)),
  };
}

export type ListingForEdit = NonNullable<
  Awaited<ReturnType<typeof getListingForEdit>>
>;

/**
 * Carga la ficha completa para el form de edición.
 * Categorías ordenadas: primary primero. Imágenes ordenadas por `order`.
 */
export async function getListingForEdit(id: string) {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      categories: {
        orderBy: [{ isPrimary: "desc" }],
        select: { categoryId: true, isPrimary: true },
      },
      images: {
        orderBy: [{ order: "asc" }],
      },
    },
  });
  if (!listing) return null;
  return {
    ...listing,
    lat: listing.lat ? listing.lat.toString() : null,
    lng: listing.lng ? listing.lng.toString() : null,
  };
}
