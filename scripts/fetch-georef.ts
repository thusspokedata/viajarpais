/**
 * scripts/fetch-georef.ts
 *
 * Snapshot of Argentina's geography from Georef API
 * (https://apis.datos.gob.ar/georef/api).
 *
 * Strategy: this script runs once per "refresh window" — its output
 * (`prisma/data/{provinces,departments,localities}.json`) is committed
 * to the repo so the actual seed (`prisma/seed.ts`) reads from disk
 * and never touches Georef at runtime.
 *
 * Why not let the seed fetch live: Georef can be down, slow, or change
 * shape. The snapshot decouples seeding from the public API and gives
 * us auditable diffs the day Georef releases new data.
 *
 * Idempotency:
 * - Default (no flag): if all 3 JSONs already exist, skip the fetch
 *   and warn. Use `--refresh` to force re-download.
 *
 * Slug collisions:
 * - Within a province scope, two departments / two localities cannot
 *   share a slug (schema enforces `@@unique([provinceId, slug])`). If
 *   we detect a collision in the snapshot we FAIL FAST with conflict
 *   detail — manual intervention needed (URLs are stable, sufijos por
 *   orden de aparición serían frágiles ante refreshes de Georef).
 *
 * Region mapping:
 * - We assign each province to one of the 6 regions of the directorio.
 *   Mapping keyed by Georef's INDEC 2-digit province ID (immutable).
 *
 * CABA slug override:
 * - "Ciudad Autónoma de Buenos Aires" (Georef id "02") gets slug `caba`
 *   instead of `ciudad-autonoma-de-buenos-aires`. SOLO la provincia —
 *   sus comunas (departments) usan slug normal `comuna-1`...`comuna-15`.
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { argv, exit } from "node:process";

const GEOREF_BASE = "https://apis.datos.gob.ar/georef/api";
const DATA_DIR = join(process.cwd(), "prisma", "data");
const PROVINCES_PATH = join(DATA_DIR, "provinces.json");
const DEPARTMENTS_PATH = join(DATA_DIR, "departments.json");
const LOCALITIES_PATH = join(DATA_DIR, "localities.json");

/**
 * Province ID (Georef / INDEC, 2-digit zero-padded) → region slug.
 * The 6 region slugs are the project's permanent URL slugs (do not
 * change, would break public URLs).
 */
const REGION_BY_PROVINCE_ID: Record<string, string> = {
  "02": "pampeana", // Ciudad Autónoma de Buenos Aires
  "06": "pampeana", // Buenos Aires
  "10": "noa", // Catamarca
  "14": "centro", // Córdoba
  "18": "nea", // Corrientes
  "22": "nea", // Chaco
  "26": "patagonia", // Chubut
  "30": "pampeana", // Entre Ríos
  "34": "nea", // Formosa
  "38": "noa", // Jujuy
  "42": "patagonia", // La Pampa
  "46": "noa", // La Rioja
  "50": "cuyo", // Mendoza
  "54": "nea", // Misiones
  "58": "patagonia", // Neuquén
  "62": "patagonia", // Río Negro
  "66": "noa", // Salta
  "70": "cuyo", // San Juan
  "74": "cuyo", // San Luis
  "78": "patagonia", // Santa Cruz
  "82": "centro", // Santa Fe
  "86": "noa", // Santiago del Estero
  "90": "noa", // Tucumán
  "94": "patagonia", // Tierra del Fuego, Antártida e Islas del Atlántico Sur
};

/**
 * Locality categorías to keep. Decisión cerrada del producto: filtro
 * inclusivo, todos menos `Entidad` (entidades administrativas no
 * turísticas).
 */
const KEEP_CATEGORIES = new Set([
  "Localidad simple",
  "Localidad compuesta",
  "Componente de localidad compuesta",
]);

// ─────────────────────────────────────────────────────────────────────
// Types — Georef response shapes (only the fields we ask for)
// ─────────────────────────────────────────────────────────────────────

type GeorefProvincia = { id: string; nombre: string };
type GeorefDepartamento = {
  id: string;
  nombre: string;
  provincia: { id: string; nombre: string };
};
type GeorefLocalidad = {
  id: string;
  nombre: string;
  categoria: string;
  centroide?: { lat: number; lon: number } | null;
  departamento?: { id: string; nombre: string } | null;
  provincia: { id: string; nombre: string };
};

type GeorefResponse<K extends string, T> = {
  cantidad: number;
  inicio: number;
  total: number;
} & Record<K, T[]>;

// ─────────────────────────────────────────────────────────────────────
// Output schemas — what we write to prisma/data/*.json
// ─────────────────────────────────────────────────────────────────────

type ProvinceSnapshot = {
  code: string;
  slug: string;
  name: string;
  regionCode: string;
};

type DepartmentSnapshot = {
  code: string;
  slug: string;
  name: string;
  provinceCode: string;
};

type LocalitySnapshot = {
  code: string;
  slug: string;
  name: string;
  lat: number | null;
  lng: number | null;
  departmentCode: string;
  provinceCode: string;
};

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

/**
 * Lowercase + remove diacritics + non-alphanum → `-` + collapse + trim.
 * Examples:
 *   "Mendoza"           → "mendoza"
 *   "Tierra del Fuego"  → "tierra-del-fuego"
 *   "San José de Jáchal" → "san-jose-de-jachal"
 */
function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Georef HTTP ${response.status} on ${url}`);
  }
  return (await response.json()) as T;
}

/**
 * Paginated fetch — Georef's `inicio` parameter for offset. Loops
 * until we've collected `total` items.
 */
async function fetchPaginated<K extends string, T>(
  url: string,
  collectionKey: K,
  pageSize: number,
): Promise<T[]> {
  const out: T[] = [];
  let offset = 0;
   
  while (true) {
    const u = new URL(url);
    u.searchParams.set("max", String(pageSize));
    u.searchParams.set("inicio", String(offset));
    const data = await fetchJson<GeorefResponse<K, T>>(u.toString());
    const batch = data[collectionKey] as T[];
    out.push(...batch);
    if (out.length >= data.total) break;
    if (batch.length === 0) break; // safety net
    offset += pageSize;
  }
  return out;
}

/**
 * Fail fast on slug collisions — within (provinceCode, level) scope.
 * `level` is just for the error message ("departments" / "localities").
 */
function assertNoSlugCollisions<T extends { slug: string; name: string; code: string; provinceCode: string }>(
  rows: T[],
  level: string,
): void {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.provinceCode}::${row.slug}`;
    const existing = byKey.get(key);
    if (existing) {
      console.error(
        `\n✖ Slug collision in ${level} within province ${row.provinceCode}:`,
      );
      console.error(`  slug = "${row.slug}"`);
      console.error(`  - ${existing.code}: "${existing.name}"`);
      console.error(`  - ${row.code}:      "${row.name}"`);
      console.error(
        `\nResolución manual: editar el JSON o agregar contexto al slug ` +
          `(p.ej. departamento) antes de re-correr el seed.\n`,
      );
      throw new Error(`Slug collision in ${level} (province ${row.provinceCode})`);
    }
    byKey.set(key, row);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const refresh = argv.includes("--refresh");

  await mkdir(DATA_DIR, { recursive: true });

  if (!refresh) {
    const all = await Promise.all([
      fileExists(PROVINCES_PATH),
      fileExists(DEPARTMENTS_PATH),
      fileExists(LOCALITIES_PATH),
    ]);
    if (all.every(Boolean)) {
      console.log(
        "✓ Snapshot exists at prisma/data/. Use `--refresh` to re-fetch.",
      );
      return;
    }
  }

  console.log("Fetching from Georef…");

  // ── Provinces ──
  const provinciasResp = await fetchJson<GeorefResponse<"provincias", GeorefProvincia>>(
    `${GEOREF_BASE}/provincias?max=24&campos=id,nombre`,
  );
  const provincias = provinciasResp.provincias;
  if (provincias.length !== 24) {
    throw new Error(
      `Expected 24 provincias, got ${provincias.length}. Georef shape changed?`,
    );
  }

  const provinceSnapshots: ProvinceSnapshot[] = provincias.map((p) => {
    const regionCode = REGION_BY_PROVINCE_ID[p.id];
    if (!regionCode) {
      throw new Error(
        `No region mapping for province id ${p.id} ("${p.nombre}"). ` +
          `Update REGION_BY_PROVINCE_ID in scripts/fetch-georef.ts.`,
      );
    }
    // CABA override: id "02" → slug "caba" (only at province level)
    const slug = p.id === "02" ? "caba" : slugify(p.nombre);
    return { code: p.id, slug, name: p.nombre, regionCode };
  });

  console.log(`  ✓ Provinces: ${provinceSnapshots.length}`);

  // ── Departments ──
  const departmentSnapshots: DepartmentSnapshot[] = [];
  for (const province of provinceSnapshots) {
    const depts = await fetchPaginated<"departamentos", GeorefDepartamento>(
      `${GEOREF_BASE}/departamentos?provincia=${province.code}&campos=id,nombre,provincia.id,provincia.nombre`,
      "departamentos",
      200,
    );
    for (const d of depts) {
      departmentSnapshots.push({
        code: d.id,
        slug: slugify(d.nombre),
        name: d.nombre,
        provinceCode: province.code,
      });
    }
    console.log(`    ${province.name}: ${depts.length} depts`);
  }
  assertNoSlugCollisions(departmentSnapshots, "departments");

  console.log(`  ✓ Departments: ${departmentSnapshots.length}`);

  // ── Localities ──
  const localitySnapshots: LocalitySnapshot[] = [];
  let skippedNoDept = 0;
  let filtered = 0;
  for (const province of provinceSnapshots) {
    const locs = await fetchPaginated<"localidades", GeorefLocalidad>(
      `${GEOREF_BASE}/localidades?provincia=${province.code}&campos=id,nombre,categoria,centroide.lat,centroide.lon,departamento.id,departamento.nombre,provincia.id,provincia.nombre`,
      "localidades",
      5000,
    );
    let kept = 0;
    for (const l of locs) {
      if (!KEEP_CATEGORIES.has(l.categoria)) {
        filtered += 1;
        continue;
      }
      if (!l.departamento?.id) {
        console.warn(
          `    ⚠ Skipping locality ${l.id} ("${l.nombre}", ${province.name}) — no department in Georef`,
        );
        skippedNoDept += 1;
        continue;
      }
      const lat = l.centroide?.lat ?? null;
      const lng = l.centroide?.lon ?? null;
      localitySnapshots.push({
        code: l.id,
        slug: slugify(l.nombre),
        name: l.nombre,
        lat,
        lng,
        departmentCode: l.departamento.id,
        provinceCode: province.code,
      });
      kept += 1;
    }
    console.log(`    ${province.name}: ${kept}/${locs.length} kept`);
  }
  assertNoSlugCollisions(localitySnapshots, "localities");

  console.log(
    `  ✓ Localities: ${localitySnapshots.length} (filtered out ${filtered} ` +
      `non-turísticas, skipped ${skippedNoDept} without department)`,
  );

  // ── Write snapshots ──
  await writeFile(
    PROVINCES_PATH,
    JSON.stringify(provinceSnapshots, null, 2) + "\n",
    "utf8",
  );
  await writeFile(
    DEPARTMENTS_PATH,
    JSON.stringify(departmentSnapshots, null, 2) + "\n",
    "utf8",
  );
  await writeFile(
    LOCALITIES_PATH,
    JSON.stringify(localitySnapshots, null, 2) + "\n",
    "utf8",
  );

  console.log(`\n✓ Snapshot written to prisma/data/`);
}

main().catch((error) => {
  console.error(error);
  exit(1);
});
