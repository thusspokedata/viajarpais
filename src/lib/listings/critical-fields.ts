/**
 * Campos cuyo cambio invalida la verificación previa de una ficha.
 *
 * Si una ficha está verificada y se edita uno de estos campos, el server
 * action de update resetea `verifiedAt`/`verifiedUntil`/`verifiedById` a
 * null. El editor ve un banner pidiendo re-verificación.
 *
 * Decisión cerrada (AGENTS.md):
 * - Cambiar el nombre, dirección, geografía o categorías invalida la
 *   verificación.
 * - Cambiar la descripción, redes, horarios, precios, etc. NO invalida.
 *   La verificación valida QUÉ es y DÓNDE está, no la calidad del copy.
 */
export const CRITICAL_FIELDS = [
  "name",
  "address",
  "provinceId",
  "departmentId",
  "localityId",
  "categories",
] as const;

export type CriticalField = (typeof CRITICAL_FIELDS)[number];

/**
 * Compara los campos críticos de un listing antes/después y devuelve
 * los que cambiaron.
 *
 * Para `categories`: compara la lista completa (set de category IDs +
 * cuál es primary) — cualquier cambio en la composición o en la primaria
 * cuenta como cambio crítico.
 */
export function findChangedCriticalFields(
  before: {
    name: string;
    address: string;
    provinceId: string;
    departmentId: string;
    localityId: string;
    categories: { categoryId: string; isPrimary: boolean }[];
  },
  after: {
    name: string;
    address: string;
    provinceId: string;
    departmentId: string;
    localityId: string;
    categories: { categoryId: string; isPrimary: boolean }[];
  },
): CriticalField[] {
  const changed: CriticalField[] = [];

  if (before.name !== after.name) changed.push("name");
  if (before.address !== after.address) changed.push("address");
  if (before.provinceId !== after.provinceId) changed.push("provinceId");
  if (before.departmentId !== after.departmentId) changed.push("departmentId");
  if (before.localityId !== after.localityId) changed.push("localityId");

  if (categoriesDiffer(before.categories, after.categories)) {
    changed.push("categories");
  }

  return changed;
}

function categoriesDiffer(
  a: { categoryId: string; isPrimary: boolean }[],
  b: { categoryId: string; isPrimary: boolean }[],
): boolean {
  if (a.length !== b.length) return true;
  const sortedA = [...a].sort((x, y) => x.categoryId.localeCompare(y.categoryId));
  const sortedB = [...b].sort((x, y) => x.categoryId.localeCompare(y.categoryId));
  for (let i = 0; i < sortedA.length; i++) {
    if (sortedA[i].categoryId !== sortedB[i].categoryId) return true;
    if (sortedA[i].isPrimary !== sortedB[i].isPrimary) return true;
  }
  return false;
}
