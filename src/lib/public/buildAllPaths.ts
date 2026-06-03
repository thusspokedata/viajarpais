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
      return {
        paths: [
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
      const adminPath = `/admin/geo/provinces/${identifier}`;
      if (!province) {
        // Fallback: sin lookup no tenemos slug -> tag con code como
        // best-effort. El loader nunca matcheara este tag, pero el
        // admin recibe su revalidate.
        return { paths: [adminPath], tags: [`province:${identifier}`] };
      }
      return {
        paths: [
          adminPath,
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
      const adminPath = `/admin/geo/departments/${identifier}`;
      if (!department) {
        return {
          paths: [adminPath],
          tags: [`department:${identifier}`],
        };
      }
      return {
        paths: [
          adminPath,
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
      const adminPath = `/admin/geo/localities/${identifier}`;
      if (!locality) {
        return { paths: [adminPath], tags: [`locality:${identifier}`] };
      }
      return {
        paths: [
          adminPath,
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
      // v0.4-a — solo admin path + tag de consistencia (no usado
      // hoy por ningun loader).
      return {
        paths: [`/admin/listings/${identifier}`],
        tags: [`listing:${identifier}`],
      };
    }
  }
}
