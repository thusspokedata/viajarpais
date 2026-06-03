import "server-only";
import { prisma } from "@/lib/db";
import type { EntityType } from "@/lib/images/dispatcher";

/*
  buildAllPaths — helper unico para resolver TODAS las paths +
  tags que hay que invalidar despues de mutar contenido editorial
  o imagenes de un nivel geografico / Listing.

  Reemplaza la version anterior `buildAdminPaths` (solo paths
  admin) que tenian images/index.ts y translations/index.ts
  duplicada. Cierra deuda M-4 (revalidacion publica) del backlog.

  Returns:
  - paths: paths a invalidar con revalidatePath. Incluye:
    - 1 path admin del editor (siempre).
    - 3 paths publicos (es/en/pt-BR) cuando aplica (solo geo,
      no para listing porque no tienen pagina publica detail
      en v0.4-a).
  - tags: tags a invalidar con revalidateTag. Format:
      "{level}:{code}"
    consistente con el formato que setea geoLoader en sus
    unstable_cache. Para Listing usamos su id (cuid) como
    consistency, aunque hoy ningun loader lo consume.

  Por que async:
  - Para province/department/locality necesitamos la cadena
    completa de slugs para armar la URL publica
    `/{region.code}/{province.slug}/{department.slug}/{locality.slug}`.
  - El `identifier` que llega es el code del entity (per
    findEntityIdentifier) — distinto al slug que usa la URL.
  - Hacemos UN query Prisma por nivel para resolver la cadena.
  - El costo extra (~5-15ms post-mutation) es aceptable.

  Defense in depth:
  - Si el lookup falla (entity no existe), devolvemos solo el
    admin path + tag. Mutation continua, public lag puede
    aparecer pero el editor ve sus cambios.
*/

export type BuildAllPathsResult = {
  paths: string[];
  tags: string[];
};

const LOCALES = ["es", "en", "pt-BR"] as const;

/**
 * Para un path publico (sin locale prefix), expande a 3 variantes
 * localizadas. `es` es default sin prefix per next-intl
 * `localePrefix: "as-needed"`.
 */
function expandLocalePaths(path: string): string[] {
  return LOCALES.map((locale) =>
    locale === "es" ? path : `/${locale}${path}`,
  );
}

export async function buildAllPaths(
  type: EntityType,
  identifier: string,
): Promise<BuildAllPathsResult> {
  switch (type) {
    case "region": {
      // identifier = region.code (per findEntityIdentifier).
      // Public URL: `/{code}`. Tag: region:{code}.
      // No existe `/admin/geo/regions` como lista standalone
      // (solo el `/admin/geo` index agregado); el detail se cubre
      // con `/admin/geo/regions/${code}`.
      return {
        paths: [
          "/admin/geo",
          `/admin/geo/regions/${identifier}`,
          ...expandLocalePaths(`/${identifier}`),
        ],
        tags: [`region:${identifier}`],
      };
    }

    case "province": {
      // identifier = province.code. Lookup slug + region.code para
      // armar la URL publica `/{region.code}/{province.slug}`.
      const province = await prisma.province.findUnique({
        where: { code: identifier },
        select: {
          slug: true,
          region: { select: { code: true } },
        },
      });
      const adminListPath = "/admin/geo/provinces";
      const adminDetailPath = `/admin/geo/provinces/${identifier}`;
      if (!province) {
        // Fail-loud: el lookup deberia siempre encontrar la entity
        // que se acaba de mutar — si no, hay un bug upstream (race
        // con delete, o identifier mal). Emitimos console.error con
        // contexto y devolvemos tags vacio (el tag por code no
        // matchea con el formato slug del loader, asi que es peor
        // ensuciar el cache de tags con basura).
        console.error("[buildAllPaths] Province lookup failed", {
          entityType: "province",
          identifier,
          impact: "public revalidate skipped (no slug to build tag/URL)",
        });
        return {
          paths: [adminListPath, adminDetailPath],
          tags: [],
        };
      }
      return {
        paths: [
          adminListPath,
          adminDetailPath,
          ...expandLocalePaths(
            `/${province.region.code}/${province.slug}`,
          ),
        ],
        // Tag con slug — consistente con el formato del loader.
        tags: [`province:${province.slug}`],
      };
    }

    case "department": {
      // identifier = department.code. Lookup slug + province.slug
      // + region.code.
      const department = await prisma.department.findUnique({
        where: { code: identifier },
        select: {
          slug: true,
          province: {
            select: {
              slug: true,
              region: { select: { code: true } },
            },
          },
        },
      });
      const adminListPath = "/admin/geo/departments";
      const adminDetailPath = `/admin/geo/departments/${identifier}`;
      if (!department) {
        console.error("[buildAllPaths] Department lookup failed", {
          entityType: "department",
          identifier,
          impact: "public revalidate skipped (no slug to build tag/URL)",
        });
        return {
          paths: [adminListPath, adminDetailPath],
          tags: [],
        };
      }
      return {
        paths: [
          adminListPath,
          adminDetailPath,
          ...expandLocalePaths(
            `/${department.province.region.code}/${department.province.slug}/${department.slug}`,
          ),
        ],
        // Tag con slug — consistente con el formato del loader.
        tags: [`department:${department.slug}`],
      };
    }

    case "locality": {
      // identifier = locality.code. Lookup slug + department.slug +
      // province.slug + region.code.
      const locality = await prisma.locality.findUnique({
        where: { code: identifier },
        select: {
          slug: true,
          department: {
            select: {
              slug: true,
              province: {
                select: {
                  slug: true,
                  region: { select: { code: true } },
                },
              },
            },
          },
        },
      });
      const adminListPath = "/admin/geo/localities";
      const adminDetailPath = `/admin/geo/localities/${identifier}`;
      if (!locality) {
        console.error("[buildAllPaths] Locality lookup failed", {
          entityType: "locality",
          identifier,
          impact: "public revalidate skipped (no slug to build tag/URL)",
        });
        return {
          paths: [adminListPath, adminDetailPath],
          tags: [],
        };
      }
      return {
        paths: [
          adminListPath,
          adminDetailPath,
          ...expandLocalePaths(
            `/${locality.department.province.region.code}/${locality.department.province.slug}/${locality.department.slug}/${locality.slug}`,
          ),
        ],
        // Tag con slug — consistente con el formato del loader.
        tags: [`locality:${locality.slug}`],
      };
    }

    case "listing": {
      // identifier = listing.id. Sin pagina publica detail en
      // v0.4-a, pero los listings PUBLISHED aparecen en las paginas
      // de los 4 niveles geo a los que pertenecen (via
      // `loadListingsForLevel` + counts en PlaceCard). Cuando una
      // listing cambia (tier, verified, status, contenido editorial,
      // imagen) los caches geo de los 4 niveles deben revalidarse
      // para que el order/count/preview reflejen el cambio.
      //
      // Lookup de los 4 FKs denormalizados (`regionId`, `provinceId`,
      // `departmentId`, `localityId`) — Prisma resuelve en 1 query.
      // Si el listing no existe (deleted entre mutation y revalidate),
      // fail-loud + skip tags.
      const listing = await prisma.listing.findUnique({
        where: { id: identifier },
        select: {
          region: { select: { code: true } },
          province: { select: { slug: true } },
          department: { select: { slug: true } },
          locality: { select: { slug: true } },
        },
      });
      const adminListPath = "/admin/listings";
      const adminDetailPath = `/admin/listings/${identifier}`;
      if (!listing) {
        console.error("[buildAllPaths] Listing lookup failed", {
          entityType: "listing",
          identifier,
          impact: "public revalidate skipped (no geo FKs to tag)",
        });
        return {
          paths: [adminListPath, adminDetailPath],
          tags: [],
        };
      }
      return {
        paths: [adminListPath, adminDetailPath],
        // Tags de los 4 niveles geo — invalidan los caches publicos
        // del region/province/department/locality que contienen
        // esta ficha. Cuando se promueve a FEATURED o se publica,
        // estos tags hacen que el order top-featured y los counts
        // se refresquen sin esperar el revalidate de 24h.
        tags: [
          `region:${listing.region.code}`,
          `province:${listing.province.slug}`,
          `department:${listing.department.slug}`,
          `locality:${listing.locality.slug}`,
        ],
      };
    }
  }
}
