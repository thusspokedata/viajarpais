import "server-only";
import { getTranslations } from "next-intl/server";
import type { GeoNode } from "./geoLoader";
import type { GeoPageLayoutI18n } from "@/components/public/GeoPageLayout";

/*
  Helper compartido por las 4 paginas geograficas para resolver los
  strings i18n que necesita GeoPageLayout. Centraliza la logica de:

  - Mapping de level -> eyebrow key.
  - Mapping de current level -> children section title (depende del
    nivel del padre, no del nodo: "Provincias adentro" es titulo en
    region, no en province).
  - Pluralizacion de meta strings de PlaceCard (fichas + sub-niveles).
  - Empty state copy contextual segun nivel.

  El componente layout es agnostico de i18n — recibe strings ya
  resueltas. La logica vive aca para no esparcir keys de Public.* por
  las 4 paginas.

  Las keys de la namespace Public se agregan en commit 16. Hasta
  entonces, next-intl muestra la clave literal si no encuentra el
  valor (visible en smoke tests). No es bloqueante para typecheck/
  build — los strings faltantes solo afectan UX runtime.
*/

/**
 * No recibe `locale` como parametro — `getTranslations()` lo
 * resuelve via setRequestLocale en el caller, que ya corre antes
 * en cada pagina. Pasarlo aca seria redundante.
 */
export async function buildGeoPageI18n(
  node: GeoNode,
): Promise<GeoPageLayoutI18n> {
  const t = await getTranslations("Public");

  // Eyebrow segun nivel del nodo.
  const eyebrowKey = `eyebrow.${node.level}` as const;

  // Children section title segun nivel del nodo (qué sub-nivel está
  // adentro):
  //   region     → "Provincias adentro"
  //   province   → "Departamentos adentro"
  //   department → "Localidades adentro"
  //   locality   → null (no hay sub-nivel)
  const childrenKeyByLevel = {
    region: "childrenTitle.provinces",
    province: "childrenTitle.departments",
    department: "childrenTitle.localities",
    locality: null,
  } as const;
  const childrenKey = childrenKeyByLevel[node.level];
  const childrenSectionTitle = childrenKey ? t(childrenKey) : null;

  // Empty state — copy ya interpolado con `name`. La pagina pasa
  // node.name y los nombres de parent/grandparent.
  const parent = node.parents[node.parents.length - 1];
  const grandparent =
    node.parents.length >= 2
      ? node.parents[node.parents.length - 2]
      : undefined;

  return {
    eyebrow: t(eyebrowKey),
    breadcrumbsAriaLabel: t("breadcrumbsLabel"),
    breadcrumbBackLabel: (name: string) => t("breadcrumbBack", { name }),
    galleryAriaLabel: t("galleryAriaLabel"),
    galleryTriggerLabel: t("viewGallery", { count: node.images.length }),
    openGalleryLabel: t("openGallery"),
    galleryLabels: {
      closeLabel: t("galleryClose"),
      prevLabel: t("galleryPrev"),
      nextLabel: t("galleryNext"),
      thumbLabelPrefix: t("galleryThumbPrefix"),
    },
    childrenSectionTitle,
    emptyState: {
      title: t("emptyTitle"),
      description: t("emptyDescription", {
        name: node.name,
        level: t(`levelSingular.${node.level}`),
      }),
      backToLabel: parent
        ? t("emptyBackTo", { name: parent.name })
        : undefined,
      exploreLabel: grandparent
        ? t("emptyExplore", { name: grandparent.name })
        : undefined,
    },
    formatChildMeta: ({ listingCount, subdivisionCount, level }) => {
      // listingCount === 0 → "Aún sin fichas" (PlaceCard usa este
      // como signal pero igual queremos el texto).
      if (listingCount === 0) {
        return t("noListingsYet");
      }
      // level es el level del NODE actual (no del child). El child
      // mostrado depende del nivel: region->province, province->dept,
      // dept->locality. Cada uno tiene plural distinto.
      const listingsLabel = t("listingsCount", { count: listingCount });
      if (subdivisionCount !== null) {
        const subdivisionKeyByParentLevel = {
          region: "localitiesCount",
          province: "localitiesCount",
          department: null,
          locality: null,
        } as const;
        const subKey = subdivisionKeyByParentLevel[level];
        if (subKey) {
          const subLabel = t(subKey, { count: subdivisionCount });
          return `${listingsLabel} · ${subLabel}`;
        }
      }
      return listingsLabel;
    },
    noPhotoLabel: t("noPhotoLabel"),
  };
}
