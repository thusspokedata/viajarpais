import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { cloudinaryUrl } from "@/lib/cloudinary";
import type { TranslationSource } from "@/generated/prisma/enums";
import type { Crumb } from "@/components/public/Breadcrumbs";
import type { GalleryImage } from "@/components/public/PhotoGallery";
import type { ListingCardProps, ListingTier } from "@/components/public";

/*
  geoLoader — fuente unica de datos para las 4 paginas geograficas
  publicas (region/province/department/locality). Cada nivel tiene
  su propio loader cacheado con unstable_cache + tags granulares.

  Tags (consistente con buildAllPaths para wire de revalidacion):
  - region:{code}        (region: code == slug, no hay slug field)
  - province:{slug}
  - department:{slug}
  - locality:{slug}
  Para 3 niveles deeper, usamos slug porque es el unico dato
  disponible en el call site (la pagina llega con slug desde la
  URL). buildAllPaths, llamado desde admin con identifier=code,
  resuelve el slug via Prisma lookup y emite el mismo tag.

  Revalidation:
  - revalidate: 86400 (24h) por defecto en cada cache.
  - El admin dispara revalidateTag con el mismo formato cuando se
    edita contenido editorial o se sube/borra imagen — commit 17
    (refactor buildAllPaths) cablea esto.

  Localizacion:
  - Region: nameEs/En/PtBr (hardcoded por seed, no editorial).
  - Province/Department/Locality: name unico (toponimo, no se
    traduce per AGENTS.md "Topónimos NO se traducen").
  - tagline + description: localizado por locale param.
  - source flags (descriptionEnSource/PtBrSource) usados por el
    TranslationDisclaimer.

  Decisiones cerradas:
  - Disclaimer fires if descriptionSource OR taglineSource ===
    MACHINE (decision del PM, mas honesto que solo description).
  - Hero image: cloudinaryUrl(publicId, "hero") — variant 1920x1080.
  - PlaceCard image: cloudinaryUrl(publicId, "card") — variant
    600x400.
  - Lightbox image: cloudinaryUrl(publicId, "full") — variant
    2400w (lossless-ish quality, master upscale-friendly).
  - Lightbox thumbs: cloudinaryUrl(publicId, "thumbnail").

  Listing ordering (top featured query del PM):
    ORDER BY
      CASE tier WHEN FEATURED THEN 1 WHEN PAID THEN 2 WHEN FREE THEN 3,
      CASE WHEN verifiedUntil > NOW() THEN 0 ELSE 1,
      updatedAt DESC
  Como Prisma no soporta CASE en orderBy, se fetch un batch
  razonable + sort en memoria. Para 24 listings (default page) el
  costo es trivial.
*/

export type SupportedLocale = "es" | "en" | "pt-BR";
export type GeoLevel = "region" | "province" | "department" | "locality";

/**
 * Estructura uniforme que devuelven los 4 loaders. La pagina
 * consume `node.*` sin chequear nivel — las variaciones por nivel
 * estan encapsuladas en el loader.
 */
export interface GeoNode {
  level: GeoLevel;
  id: string;
  /**
   * `code` (region) o `slug` (province/department/locality). Sirve
   * para construir el href de la pagina y los tags de cache.
   */
  slug: string;
  /**
   * Nombre localizado (Region) o toponimo unico
   * (Province/Department/Locality). Es el unico h1 de la pagina.
   */
  name: string;

  // Contenido editorial localizado
  tagline: string | null;
  description: string | null;
  descriptionSource: TranslationSource;
  taglineSource: TranslationSource;
  /**
   * True si el nodo tiene algo editorial (tagline o description o
   * galeria > 1). Usado por la pagina para decidir entre
   * EditorialContent vs PublicEmptyState.
   */
  hasEditorial: boolean;

  /**
   * Breadcrumbs incluyendo el nivel actual como ultimo item.
   * El href del ultimo no se usa (aria-current sin link) pero se
   * pasa por consistencia de tipo.
   */
  breadcrumbs: Crumb[];

  // Galeria
  /**
   * Imagen primary del nodo, ya con variant hero (1920x1080).
   * Null si el nodo no tiene imagenes.
   */
  primaryImage: { url: string; alt: string; publicId: string } | null;
  /**
   * Todas las imagenes del nodo, ya mapeadas a GalleryImage con
   * variant full + thumbnail derivadas. Incluye la primary.
   */
  images: GalleryImage[];

  // Sub-niveles (PlaceCard grid)
  children: PlaceChildData[];
  /**
   * Label localizado del titulo de seccion de sub-niveles:
   * "Provincias adentro" / "Departamentos adentro" / etc.
   * Null en locality (no hay sub-nivel).
   *
   * NOTA: el geoLoader devuelve null en este campo. La pagina lo
   * setea con la string traducida via i18n. Lo declaramos en el
   * tipo para que la pagina sepa que existe.
   */
  childrenSectionTitle: string | null;

  // Listings dentro del nodo (top N ordered by featured > paid > free)
  listings: ListingCardProps[];
  totalListings: number;

  // Metadata para SEO/OG (usado por generateMetadata)
  /**
   * `parents` ordenados del mas alto al mas cercano. Usado por
   * generateMetadata para construir title `"{name} — {parent}".`
   * Vacio para region (no hay parent geografico).
   */
  parents: {
    level: GeoLevel;
    name: string;
    slug: string;
    href: string;
  }[];
}

export interface PlaceChildData {
  /** href ya localizado (relativo, sin prefix de locale). */
  href: string;
  name: string;
  imageUrl: string | null;
  imageAlt: string;
  publicId: string | null;
  listingCount: number;
  /**
   * Numero de sub-sub-niveles para enriquecer el meta (ej.
   * provincias muestran "X fichas · Y localidades"). Null si no
   * aplica (locality no tiene sub-niveles, department muestra
   * solo fichas).
   */
  subdivisionCount: number | null;
}

/* ================================================================
   HELPERS — localizacion + mapeos
   ================================================================ */

/**
 * Selecciona el campo i18n correcto. Si el target es null/undefined,
 * fallback a Es (siempre presente).
 *
 * M5 fix: usa `??` (nullish) en lugar de `||` (truthy). Si en algun
 * momento el form admin permite vaciar explicitamente un campo
 * (`descriptionEn = ""`), el operador `||` lo confundia con falsy y
 * caia al fallback ES — perdiendose la decision editorial de "este
 * campo no aplica en este idioma". `??` distingue null/undefined de
 * empty string.
 *
 * Follow-up (fuera de scope del PR): el form admin deberia validar en
 * Zod que `""` se persiste como `null` para que la decision quede
 * canonica en DB. Sin esa validacion, hoy es teorico — el admin form
 * de v0.3 usa controles que devuelven null para vacios.
 */
function pickLocalizedField<T extends string | null | undefined>(
  es: T,
  en: T,
  ptBr: T,
  locale: SupportedLocale,
): T {
  if (locale === "es") return es;
  if (locale === "en") return en ?? es;
  return ptBr ?? es;
}

function pickLocalizedSource(
  enSource: TranslationSource,
  ptBrSource: TranslationSource,
  locale: SupportedLocale,
): TranslationSource {
  if (locale === "es") return "NONE"; // ES no se considera traducido
  return locale === "en" ? enSource : ptBrSource;
}

/**
 * Convierte un row Listing + categories + images a ListingCardProps.
 * El mapping de tier es lowercase (enum -> string). Description usa
 * tagline (mas corta) si existe, sino description truncada a ~150
 * chars. categoria primary se resuelve desde ListingCategory.
 */
function listingToCardProps(
  listing: {
    id: string;
    name: string;
    slug: string;
    tier: "FREE" | "PAID" | "FEATURED";
    verifiedAt: Date | null;
    verifiedUntil: Date | null;
    province: { name: string; slug: string };
    locality: { name: string; slug: string };
    department: { slug: string };
    region: { code: string };
    taglineEs: string | null;
    taglineEn: string | null;
    taglinePtBr: string | null;
    descriptionEs: string;
    descriptionEn: string | null;
    descriptionPtBr: string | null;
    images: { cloudinaryPublicId: string; isPrimary: boolean; altText: string | null }[];
    categories: {
      isPrimary: boolean;
      category: { slug: string; nameEs: string; nameEn: string; namePtBr: string };
    }[];
  },
  locale: SupportedLocale,
): ListingCardProps {
  // Tier mapping enum -> string
  const tierMap: Record<typeof listing.tier, ListingTier> = {
    FREE: "free",
    PAID: "paid",
    FEATURED: "featured",
  };
  const tier = tierMap[listing.tier];

  // Description card: prefer tagline, fallback truncado de description.
  const tagline = pickLocalizedField(
    listing.taglineEs,
    listing.taglineEn,
    listing.taglinePtBr,
    locale,
  );
  // descriptionEs es required en el schema; el fallback siempre tiene
  // string. Casteamos para que TS no la considere nullable.
  const description = (pickLocalizedField(
    listing.descriptionEs,
    listing.descriptionEn,
    listing.descriptionPtBr,
    locale,
  ) ?? listing.descriptionEs) as string;
  const cardDescription = tagline ?? truncate(description, 160);

  // Primary category (con isPrimary=true) — fallback a la primera.
  const primaryCategory = listing.categories.find((c) => c.isPrimary)
    ?? listing.categories[0];
  const categoryName = primaryCategory
    ? pickLocalizedField(
        primaryCategory.category.nameEs,
        primaryCategory.category.nameEn,
        primaryCategory.category.namePtBr,
        locale,
      )
    : "";

  // Imagen primary
  const primary = listing.images.find((img) => img.isPrimary)
    ?? listing.images[0];
  const imageUrl = primary
    ? cloudinaryUrl(primary.cloudinaryPublicId, "card")
    : undefined;

  // Galeria (paid/featured) — primary + hasta 3 mas para el strip.
  const galleryUrls = listing.images
    .filter((img) => !img.isPrimary)
    .slice(0, 3)
    .map((img) => cloudinaryUrl(img.cloudinaryPublicId, "thumbnail"));

  // href publica de la ficha (v0.4-b, hoy 404 pero el link queda
  // listo).
  const href = `/${listing.region.code}/${listing.province.slug}/${listing.department.slug}/${listing.locality.slug}/${listing.slug}`;

  return {
    tier,
    name: listing.name,
    category: categoryName,
    province: listing.province.name,
    locality: listing.locality.name,
    description: cardDescription,
    imageUrl,
    galleryUrls: galleryUrls.length > 0 ? galleryUrls : undefined,
    verifiedAt: listing.verifiedAt?.toISOString(),
    expiresAt: listing.verifiedUntil?.toISOString(),
    href,
  };
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}

/**
 * Tier ranking para el sort top-featured. Module-level para evitar
 * la inferencia generica de Record<T["tier"], number> que TS rechaza
 * (no puede satisfacer las keys literales dentro de un generico).
 */
const TIER_RANK: Record<"FREE" | "PAID" | "FEATURED", number> = {
  FEATURED: 1,
  PAID: 2,
  FREE: 3,
};

/**
 * Ordenacion top-6 featured per spec del PM:
 *   CASE tier WHEN FEATURED 1 WHEN PAID 2 WHEN FREE 3
 *   CASE WHEN verifiedUntil > NOW THEN 0 ELSE 1
 *   updatedAt DESC
 *
 * Como Prisma no soporta CASE en orderBy, sort en memoria sobre un
 * batch razonable. Para 24 listings es trivial.
 */
function sortListingsTopFeatured<
  T extends {
    tier: "FREE" | "PAID" | "FEATURED";
    verifiedUntil: Date | null;
    updatedAt: Date;
  },
>(listings: T[]): T[] {
  const now = Date.now();
  return [...listings].sort((a, b) => {
    const tierDiff = TIER_RANK[a.tier] - TIER_RANK[b.tier];
    if (tierDiff !== 0) return tierDiff;
    const aVerified = a.verifiedUntil && a.verifiedUntil.getTime() > now ? 0 : 1;
    const bVerified = b.verifiedUntil && b.verifiedUntil.getTime() > now ? 0 : 1;
    const verDiff = aVerified - bVerified;
    if (verDiff !== 0) return verDiff;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

/**
 * Mapea un image row (Region/Province/Department/Locality/Listing
 * Image) a un GalleryImage con variants Cloudinary derivadas.
 */
function imageToGalleryImage(
  img: {
    cloudinaryPublicId: string;
    caption: string | null;
    altText: string | null;
  },
  fallbackAlt: string,
): GalleryImage {
  return {
    publicId: img.cloudinaryPublicId,
    url: cloudinaryUrl(img.cloudinaryPublicId, "full"),
    thumbUrl: cloudinaryUrl(img.cloudinaryPublicId, "thumbnail"),
    caption: img.caption ?? undefined,
    alt: img.altText ?? img.caption ?? fallbackAlt,
  };
}

/* ================================================================
   LOADERS por nivel — cada uno cacheado con unstable_cache.
   Cada loader exterior es plain async para passing locale + slug
   como args; la fn interior es la cacheada.
   ================================================================ */

/* ---------- Region ---------- */

export async function getRegionNode(
  code: string,
  locale: SupportedLocale,
): Promise<GeoNode | null> {
  return unstable_cache(
    () => loadRegionNode(code, locale),
    ["geo", "region", code, locale],
    {
      tags: [`region:${code}`],
      revalidate: 86400,
    },
  )();
}

async function loadRegionNode(
  code: string,
  locale: SupportedLocale,
): Promise<GeoNode | null> {
  const region = await prisma.region.findUnique({
    where: { code },
    include: {
      images: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      },
      provinces: {
        orderBy: { name: "asc" },
        include: {
          _count: {
            // Solo listings PUBLISHED — DRAFTs y ARCHIVEDs no se
            // muestran en el publico, asi que tampoco se cuentan.
            // Antes el count incluia todo, mostrando "12 fichas" en
            // PlaceCard pero al entrar habian solo 3 visibles.
            select: {
              listings: { where: { status: "PUBLISHED" } },
              localities: true,
            },
          },
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { cloudinaryPublicId: true, altText: true },
          },
        },
      },
    },
  });
  if (!region) return null;

  const name = pickLocalizedField(
    region.nameEs,
    region.nameEn,
    region.namePtBr,
    locale,
  );
  const tagline = pickLocalizedField(
    region.taglineEs,
    region.taglineEn,
    region.taglinePtBr,
    locale,
  );
  const description = pickLocalizedField(
    region.descriptionEs,
    region.descriptionEn,
    region.descriptionPtBr,
    locale,
  );
  const taglineSource = pickLocalizedSource(
    region.taglineEnSource,
    region.taglinePtBrSource,
    locale,
  );
  const descriptionSource = pickLocalizedSource(
    region.descriptionEnSource,
    region.descriptionPtBrSource,
    locale,
  );

  const primaryImageRow = region.images.find((img) => img.isPrimary)
    ?? region.images[0];
  const primaryImage = primaryImageRow
    ? {
        url: cloudinaryUrl(primaryImageRow.cloudinaryPublicId, "hero"),
        alt:
          primaryImageRow.altText ??
          primaryImageRow.caption ??
          `${name}, vista del lugar`,
        publicId: primaryImageRow.cloudinaryPublicId,
      }
    : null;

  const images: GalleryImage[] = region.images.map((img) =>
    imageToGalleryImage(img, name),
  );

  // Listings de la region (denormalizado en Listing.regionId).
  const listings = await loadListingsForLevel(
    { regionId: region.id },
    locale,
  );

  const children: PlaceChildData[] = region.provinces.map((p) => {
    const primaryImg = p.images[0];
    return {
      href: `/${code}/${p.slug}`,
      name: p.name,
      imageUrl: primaryImg
        ? cloudinaryUrl(primaryImg.cloudinaryPublicId, "card")
        : null,
      publicId: primaryImg?.cloudinaryPublicId ?? null,
      imageAlt: primaryImg?.altText ?? `${p.name}, provincia de ${name}`,
      listingCount: p._count.listings,
      subdivisionCount: p._count.localities,
    };
  });

  // hasEditorial: solo cuenta tagline o description. La galeria NO
  // es contenido editorial — ya se muestra en hero/lightbox; si
  // contara aca, GeoPageLayout monta <EditorialContent> con TranslationDisclaimer
  // como unico hijo (truthy) y produce un section vacio con padding
  // debajo del hero (H6 finding).
  const hasEditorial = Boolean(tagline) || Boolean(description);

  return {
    level: "region",
    id: region.id,
    slug: code,
    name,
    tagline,
    description,
    descriptionSource,
    taglineSource,
    hasEditorial,
    breadcrumbs: [{ label: name, href: `/${code}` }],
    primaryImage,
    images,
    children,
    childrenSectionTitle: null, // pagina lo cablea con i18n
    listings: listings.listings,
    totalListings: listings.total,
    parents: [], // region es top-level
  };
}

/* ---------- Province ---------- */

export async function getProvinceNode(
  regionCode: string,
  provinceSlug: string,
  locale: SupportedLocale,
): Promise<GeoNode | null> {
  return unstable_cache(
    () => loadProvinceNode(regionCode, provinceSlug, locale),
    ["geo", "province", regionCode, provinceSlug, locale],
    {
      tags: [`province:${provinceSlug}`],
      revalidate: 86400,
    },
  )();
}

async function loadProvinceNode(
  regionCode: string,
  provinceSlug: string,
  locale: SupportedLocale,
): Promise<GeoNode | null> {
  const province = await prisma.province.findFirst({
    where: {
      slug: provinceSlug,
      region: { code: regionCode },
    },
    include: {
      region: {
        select: {
          id: true,
          code: true,
          nameEs: true,
          nameEn: true,
          namePtBr: true,
        },
      },
      images: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      },
      departments: {
        orderBy: { name: "asc" },
        include: {
          _count: {
            // Solo listings PUBLISHED — ver loadRegionNode.
            select: {
              listings: { where: { status: "PUBLISHED" } },
              localities: true,
            },
          },
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { cloudinaryPublicId: true, altText: true },
          },
        },
      },
    },
  });
  if (!province) return null;

  const regionName = pickLocalizedField(
    province.region.nameEs,
    province.region.nameEn,
    province.region.namePtBr,
    locale,
  );
  const tagline = pickLocalizedField(
    province.taglineEs,
    province.taglineEn,
    province.taglinePtBr,
    locale,
  );
  const description = pickLocalizedField(
    province.descriptionEs,
    province.descriptionEn,
    province.descriptionPtBr,
    locale,
  );
  const taglineSource = pickLocalizedSource(
    province.taglineEnSource,
    province.taglinePtBrSource,
    locale,
  );
  const descriptionSource = pickLocalizedSource(
    province.descriptionEnSource,
    province.descriptionPtBrSource,
    locale,
  );

  const primaryImageRow = province.images.find((img) => img.isPrimary)
    ?? province.images[0];
  const primaryImage = primaryImageRow
    ? {
        url: cloudinaryUrl(primaryImageRow.cloudinaryPublicId, "hero"),
        alt:
          primaryImageRow.altText ??
          primaryImageRow.caption ??
          `${province.name}, vista del lugar`,
        publicId: primaryImageRow.cloudinaryPublicId,
      }
    : null;

  const images: GalleryImage[] = province.images.map((img) =>
    imageToGalleryImage(img, province.name),
  );

  const listings = await loadListingsForLevel(
    { provinceId: province.id },
    locale,
  );

  const children: PlaceChildData[] = province.departments.map((d) => {
    const primaryImg = d.images[0];
    return {
      href: `/${regionCode}/${provinceSlug}/${d.slug}`,
      name: d.name,
      imageUrl: primaryImg
        ? cloudinaryUrl(primaryImg.cloudinaryPublicId, "card")
        : null,
      publicId: primaryImg?.cloudinaryPublicId ?? null,
      imageAlt:
        primaryImg?.altText ?? `${d.name}, departamento de ${province.name}`,
      listingCount: d._count.listings,
      subdivisionCount: d._count.localities,
    };
  });

  // hasEditorial: solo cuenta tagline o description. La galeria NO
  // es contenido editorial — ya se muestra en hero/lightbox; si
  // contara aca, GeoPageLayout monta <EditorialContent> con TranslationDisclaimer
  // como unico hijo (truthy) y produce un section vacio con padding
  // debajo del hero (H6 finding).
  const hasEditorial = Boolean(tagline) || Boolean(description);

  return {
    level: "province",
    id: province.id,
    slug: provinceSlug,
    name: province.name,
    tagline,
    description,
    descriptionSource,
    taglineSource,
    hasEditorial,
    breadcrumbs: [
      { label: regionName, href: `/${regionCode}` },
      { label: province.name, href: `/${regionCode}/${provinceSlug}` },
    ],
    primaryImage,
    images,
    children,
    childrenSectionTitle: null,
    listings: listings.listings,
    totalListings: listings.total,
    parents: [
      {
        level: "region",
        name: regionName,
        slug: regionCode,
        href: `/${regionCode}`,
      },
    ],
  };
}

/* ---------- Department ---------- */

export async function getDepartmentNode(
  regionCode: string,
  provinceSlug: string,
  departmentSlug: string,
  locale: SupportedLocale,
): Promise<GeoNode | null> {
  return unstable_cache(
    () => loadDepartmentNode(regionCode, provinceSlug, departmentSlug, locale),
    ["geo", "department", regionCode, provinceSlug, departmentSlug, locale],
    {
      tags: [`department:${departmentSlug}`],
      revalidate: 86400,
    },
  )();
}

async function loadDepartmentNode(
  regionCode: string,
  provinceSlug: string,
  departmentSlug: string,
  locale: SupportedLocale,
): Promise<GeoNode | null> {
  const department = await prisma.department.findFirst({
    where: {
      slug: departmentSlug,
      province: {
        slug: provinceSlug,
        region: { code: regionCode },
      },
    },
    include: {
      province: {
        select: {
          id: true,
          name: true,
          slug: true,
          region: {
            select: {
              code: true,
              nameEs: true,
              nameEn: true,
              namePtBr: true,
            },
          },
        },
      },
      images: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      },
      localities: {
        orderBy: { name: "asc" },
        include: {
          _count: {
            // Solo listings PUBLISHED — ver loadRegionNode. Locality
            // no tiene sub-niveles, asi que solo cuenta fichas directas.
            select: { listings: { where: { status: "PUBLISHED" } } },
          },
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { cloudinaryPublicId: true, altText: true },
          },
        },
      },
    },
  });
  if (!department) return null;

  const regionName = pickLocalizedField(
    department.province.region.nameEs,
    department.province.region.nameEn,
    department.province.region.namePtBr,
    locale,
  );
  const tagline = pickLocalizedField(
    department.taglineEs,
    department.taglineEn,
    department.taglinePtBr,
    locale,
  );
  const description = pickLocalizedField(
    department.descriptionEs,
    department.descriptionEn,
    department.descriptionPtBr,
    locale,
  );
  const taglineSource = pickLocalizedSource(
    department.taglineEnSource,
    department.taglinePtBrSource,
    locale,
  );
  const descriptionSource = pickLocalizedSource(
    department.descriptionEnSource,
    department.descriptionPtBrSource,
    locale,
  );

  const primaryImageRow = department.images.find((img) => img.isPrimary)
    ?? department.images[0];
  const primaryImage = primaryImageRow
    ? {
        url: cloudinaryUrl(primaryImageRow.cloudinaryPublicId, "hero"),
        alt:
          primaryImageRow.altText ??
          primaryImageRow.caption ??
          `${department.name}, vista del lugar`,
        publicId: primaryImageRow.cloudinaryPublicId,
      }
    : null;

  const images: GalleryImage[] = department.images.map((img) =>
    imageToGalleryImage(img, department.name),
  );

  const listings = await loadListingsForLevel(
    { departmentId: department.id },
    locale,
  );

  const children: PlaceChildData[] = department.localities.map((l) => {
    const primaryImg = l.images[0];
    return {
      href: `/${regionCode}/${provinceSlug}/${departmentSlug}/${l.slug}`,
      name: l.name,
      imageUrl: primaryImg
        ? cloudinaryUrl(primaryImg.cloudinaryPublicId, "card")
        : null,
      publicId: primaryImg?.cloudinaryPublicId ?? null,
      imageAlt:
        primaryImg?.altText ?? `${l.name}, localidad de ${department.name}`,
      listingCount: l._count.listings,
      subdivisionCount: null,
    };
  });

  // hasEditorial: solo cuenta tagline o description. La galeria NO
  // es contenido editorial — ya se muestra en hero/lightbox; si
  // contara aca, GeoPageLayout monta <EditorialContent> con TranslationDisclaimer
  // como unico hijo (truthy) y produce un section vacio con padding
  // debajo del hero (H6 finding).
  const hasEditorial = Boolean(tagline) || Boolean(description);

  return {
    level: "department",
    id: department.id,
    slug: departmentSlug,
    name: department.name,
    tagline,
    description,
    descriptionSource,
    taglineSource,
    hasEditorial,
    breadcrumbs: [
      { label: regionName, href: `/${regionCode}` },
      {
        label: department.province.name,
        href: `/${regionCode}/${provinceSlug}`,
      },
      {
        label: department.name,
        href: `/${regionCode}/${provinceSlug}/${departmentSlug}`,
      },
    ],
    primaryImage,
    images,
    children,
    childrenSectionTitle: null,
    listings: listings.listings,
    totalListings: listings.total,
    parents: [
      {
        level: "region",
        name: regionName,
        slug: regionCode,
        href: `/${regionCode}`,
      },
      {
        level: "province",
        name: department.province.name,
        slug: provinceSlug,
        href: `/${regionCode}/${provinceSlug}`,
      },
    ],
  };
}

/* ---------- Locality ---------- */

export async function getLocalityNode(
  regionCode: string,
  provinceSlug: string,
  departmentSlug: string,
  localitySlug: string,
  locale: SupportedLocale,
): Promise<GeoNode | null> {
  return unstable_cache(
    () =>
      loadLocalityNode(
        regionCode,
        provinceSlug,
        departmentSlug,
        localitySlug,
        locale,
      ),
    [
      "geo",
      "locality",
      regionCode,
      provinceSlug,
      departmentSlug,
      localitySlug,
      locale,
    ],
    {
      tags: [`locality:${localitySlug}`],
      revalidate: 86400,
    },
  )();
}

async function loadLocalityNode(
  regionCode: string,
  provinceSlug: string,
  departmentSlug: string,
  localitySlug: string,
  locale: SupportedLocale,
): Promise<GeoNode | null> {
  const locality = await prisma.locality.findFirst({
    where: {
      slug: localitySlug,
      province: { slug: provinceSlug },
      department: { slug: departmentSlug },
    },
    include: {
      department: {
        select: {
          id: true,
          name: true,
          slug: true,
          province: {
            select: {
              name: true,
              slug: true,
              region: {
                select: {
                  code: true,
                  nameEs: true,
                  nameEn: true,
                  namePtBr: true,
                },
              },
            },
          },
        },
      },
      images: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!locality) return null;

  const regionName = pickLocalizedField(
    locality.department.province.region.nameEs,
    locality.department.province.region.nameEn,
    locality.department.province.region.namePtBr,
    locale,
  );
  const tagline = pickLocalizedField(
    locality.taglineEs,
    locality.taglineEn,
    locality.taglinePtBr,
    locale,
  );
  const description = pickLocalizedField(
    locality.descriptionEs,
    locality.descriptionEn,
    locality.descriptionPtBr,
    locale,
  );
  const taglineSource = pickLocalizedSource(
    locality.taglineEnSource,
    locality.taglinePtBrSource,
    locale,
  );
  const descriptionSource = pickLocalizedSource(
    locality.descriptionEnSource,
    locality.descriptionPtBrSource,
    locale,
  );

  const primaryImageRow = locality.images.find((img) => img.isPrimary)
    ?? locality.images[0];
  const primaryImage = primaryImageRow
    ? {
        url: cloudinaryUrl(primaryImageRow.cloudinaryPublicId, "hero"),
        alt:
          primaryImageRow.altText ??
          primaryImageRow.caption ??
          `${locality.name}, vista del lugar`,
        publicId: primaryImageRow.cloudinaryPublicId,
      }
    : null;

  const images: GalleryImage[] = locality.images.map((img) =>
    imageToGalleryImage(img, locality.name),
  );

  const listings = await loadListingsForLevel(
    { localityId: locality.id },
    locale,
  );

  // hasEditorial: solo cuenta tagline o description. La galeria NO
  // es contenido editorial — ya se muestra en hero/lightbox; si
  // contara aca, GeoPageLayout monta <EditorialContent> con TranslationDisclaimer
  // como unico hijo (truthy) y produce un section vacio con padding
  // debajo del hero (H6 finding).
  const hasEditorial = Boolean(tagline) || Boolean(description);

  return {
    level: "locality",
    id: locality.id,
    slug: localitySlug,
    name: locality.name,
    tagline,
    description,
    descriptionSource,
    taglineSource,
    hasEditorial,
    breadcrumbs: [
      { label: regionName, href: `/${regionCode}` },
      {
        label: locality.department.province.name,
        href: `/${regionCode}/${provinceSlug}`,
      },
      {
        label: locality.department.name,
        href: `/${regionCode}/${provinceSlug}/${departmentSlug}`,
      },
      {
        label: locality.name,
        href: `/${regionCode}/${provinceSlug}/${departmentSlug}/${localitySlug}`,
      },
    ],
    primaryImage,
    images,
    children: [], // locality es nivel mas profundo, sin sub-niveles
    childrenSectionTitle: null,
    listings: listings.listings,
    totalListings: listings.total,
    parents: [
      {
        level: "region",
        name: regionName,
        slug: regionCode,
        href: `/${regionCode}`,
      },
      {
        level: "province",
        name: locality.department.province.name,
        slug: provinceSlug,
        href: `/${regionCode}/${provinceSlug}`,
      },
      {
        level: "department",
        name: locality.department.name,
        slug: departmentSlug,
        href: `/${regionCode}/${provinceSlug}/${departmentSlug}`,
      },
    ],
  };
}

/* ---------- loadListingsForLevel ---------- */

/**
 * Helper compartido — carga listings publicas de un nivel (region,
 * province, department, locality) con sort top-featured + total.
 *
 * Solo carga listings con `status: 'PUBLISHED'` (admin drafts no
 * son visibles en publico). Limit 24 para el primer render — la
 * paginacion por query params es v0.5.
 */
async function loadListingsForLevel(
  where:
    | { regionId: string }
    | { provinceId: string }
    | { departmentId: string }
    | { localityId: string },
  locale: SupportedLocale,
): Promise<{ listings: ListingCardProps[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.listing.findMany({
      where: { ...where, status: "PUBLISHED" },
      take: 30, // batch antes del sort en memoria, top 24 al final
      orderBy: [
        { updatedAt: "desc" }, // un orden inicial coherente
      ],
      include: {
        province: { select: { name: true, slug: true } },
        locality: { select: { name: true, slug: true } },
        department: { select: { slug: true } },
        region: { select: { code: true } },
        images: {
          select: {
            cloudinaryPublicId: true,
            isPrimary: true,
            altText: true,
          },
          orderBy: [{ isPrimary: "desc" }, { order: "asc" }],
        },
        categories: {
          include: {
            category: {
              select: {
                slug: true,
                nameEs: true,
                nameEn: true,
                namePtBr: true,
              },
            },
          },
        },
      },
    }),
    prisma.listing.count({
      where: { ...where, status: "PUBLISHED" },
    }),
  ]);

  const sorted = sortListingsTopFeatured(rows).slice(0, 24);
  const listings = sorted.map((listing) => listingToCardProps(listing, locale));
  return { listings, total };
}

/* ================================================================
   generateStaticParams — solo nodos con contenido editorial.
   ================================================================ */

/**
 * Wrapper para los `listPopulated*` que alimentan `generateStaticParams`.
 *
 * El build de CI corre `next build` con un DATABASE_URL placeholder
 * (localhost sin Postgres real), asi que la query Prisma de
 * `generateStaticParams` tira al intentar conectar y rompe el build
 * con "Failed to collect page data". Como `dynamicParams = true` en
 * las 4 paginas, no necesitamos pre-renderizar NADA en build — todo
 * puede generarse on-demand con ISR.
 *
 * Por eso: si la query falla (DB no disponible en build), devolvemos
 * `[]` y logueamos. En CI -> 0 paginas pre-generadas, build verde.
 * En prod (DB real) -> pre-genera los nodos populados normalmente.
 */
async function safeStaticParams<T>(
  label: string,
  fn: () => Promise<T[]>,
): Promise<T[]> {
  try {
    return await fn();
  } catch (err) {
    console.warn(
      `[geoLoader] ${label}: DB no disponible en build, 0 static params (ISR on-demand)`,
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/**
 * Lista los regions populados (con descriptionEs cargada) para
 * pre-render en build. El resto se genera on-demand con ISR
 * (dynamicParams=true en la pagina).
 *
 * Estado actual del proyecto: probablemente 0-6 regiones con
 * description cargada. Las paginas vacias no se pre-generan,
 * caen en `PublicEmptyState` la primera vez que las visitan.
 */
export async function listPopulatedRegions(): Promise<{ region: string }[]> {
  return safeStaticParams("listPopulatedRegions", async () => {
    const regions = await prisma.region.findMany({
      where: { descriptionEs: { not: null } },
      select: { code: true },
    });
    return regions.map((r) => ({ region: r.code }));
  });
}

export async function listPopulatedProvinces(): Promise<
  { region: string; province: string }[]
> {
  return safeStaticParams("listPopulatedProvinces", async () => {
    const provinces = await prisma.province.findMany({
      where: { descriptionEs: { not: null } },
      select: {
        slug: true,
        region: { select: { code: true } },
      },
    });
    return provinces.map((p) => ({
      region: p.region.code,
      province: p.slug,
    }));
  });
}

export async function listPopulatedDepartments(): Promise<
  { region: string; province: string; department: string }[]
> {
  return safeStaticParams("listPopulatedDepartments", async () => {
    const departments = await prisma.department.findMany({
      where: { descriptionEs: { not: null } },
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
    return departments.map((d) => ({
      region: d.province.region.code,
      province: d.province.slug,
      department: d.slug,
    }));
  });
}

export async function listPopulatedLocalities(): Promise<
  {
    region: string;
    province: string;
    department: string;
    locality: string;
  }[]
> {
  return safeStaticParams("listPopulatedLocalities", async () => {
    const localities = await prisma.locality.findMany({
      where: { descriptionEs: { not: null } },
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
    return localities.map((l) => ({
      region: l.department.province.region.code,
      province: l.department.province.slug,
      department: l.department.slug,
      locality: l.slug,
    }));
  });
}
