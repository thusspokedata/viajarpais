import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { argv } from "node:process";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Seed entry point for ViajarPaís.
 *
 * Phases (each opt-in via flag):
 *   --admin       Create the bootstrap admin via Better Auth API.
 *   --geo         Seed regions, provinces, departments, localities.
 *   --categories  Seed the 10 national categories with tri-locale names.
 *
 * No flag = run all three.
 *
 * Why this script doesn't import from `@/lib/db` or `@/lib/auth`:
 * - `@/lib/db` starts with `import "server-only"`, which throws when
 *   loaded outside the Next.js server runtime (i.e. under `tsx` from a
 *   CLI). The guard is correct in the runtime — it stops Prisma from
 *   leaking into client bundles.
 * - `@/lib/auth` imports `@/lib/db` transitively.
 *
 * Solution: instantiate a local Prisma client + (lazily) a local
 * Better Auth instance, both scoped to this script. Mirrors the
 * runtime config but is independent of the runtime singletons.
 *
 * All inserts go through `upsert` keyed by `code` so re-running is
 * idempotent — second runs report what was kept and exit 0.
 */

// ─────────────────────────────────────────────────────────────────────
// Connection (shared by all phases)
// ─────────────────────────────────────────────────────────────────────

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run the seed");
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

// ─────────────────────────────────────────────────────────────────────
// Flags
// ─────────────────────────────────────────────────────────────────────

type Flags = { admin: boolean; geo: boolean; categories: boolean };

function parseFlags(): Flags {
  const args = argv.slice(2);
  const explicit = args.some((a) => a === "--admin" || a === "--geo" || a === "--categories");
  if (!explicit) {
    return { admin: true, geo: true, categories: true };
  }
  return {
    admin: args.includes("--admin"),
    geo: args.includes("--geo"),
    categories: args.includes("--categories"),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

const DATA_DIR = join(process.cwd(), "prisma", "data");

async function readJson<T>(path: string): Promise<T> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as T;
}

// ─────────────────────────────────────────────────────────────────────
// Phase: admin
// ─────────────────────────────────────────────────────────────────────

async function seedAdmin(): Promise<void> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required for --admin",
    );
  }

  const authSecret = process.env.BETTER_AUTH_SECRET;
  if (!authSecret) {
    throw new Error("BETTER_AUTH_SECRET is required for --admin");
  }

  const auth = betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    secret: authSecret,
    baseURL: process.env.BETTER_AUTH_URL,
    emailAndPassword: { enabled: true, autoSignIn: false },
    user: {
      additionalFields: {
        role: {
          type: ["ADMIN", "EDITOR", "MERCHANT"] as const,
          required: false,
          defaultValue: "MERCHANT",
          input: false,
        },
      },
    },
  });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "ADMIN") {
      await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
      console.log(`Promoted ${email} to ADMIN`);
    } else {
      console.log(`Admin already exists: ${email}`);
    }
    return;
  }

  console.log(`Creating bootstrap admin: ${email}`);
  const result = await auth.api.signUpEmail({
    body: { email, password, name: "Admin" },
  });
  await prisma.user.update({
    where: { id: result.user.id },
    data: { role: "ADMIN" },
  });
  console.log(`✓ Admin user created with role ADMIN`);
}

// ─────────────────────────────────────────────────────────────────────
// Phase: geo (regions, provinces, departments, localities)
// ─────────────────────────────────────────────────────────────────────

/**
 * 6 regiones del directorio. Slugs DEFINITIVOS — cambiarlos rompe URLs.
 * Order is the canonical display order in nav / filters.
 */
const REGIONS: Array<{ code: string; name: string; order: number }> = [
  { code: "cuyo", name: "Cuyo", order: 1 },
  { code: "noa", name: "Noroeste Argentino", order: 2 },
  { code: "nea", name: "Nordeste Argentino", order: 3 },
  { code: "centro", name: "Centro", order: 4 },
  { code: "pampeana", name: "Pampeana", order: 5 },
  { code: "patagonia", name: "Patagonia", order: 6 },
];

type ProvinceSnapshot = { code: string; slug: string; name: string; regionCode: string };
type DepartmentSnapshot = { code: string; slug: string; name: string; provinceCode: string };
type LocalitySnapshot = {
  code: string;
  slug: string;
  name: string;
  lat: number | null;
  lng: number | null;
  departmentCode: string;
  provinceCode: string;
};

async function seedGeo(): Promise<void> {
  // ── Regions ──
  console.log(`Seeding ${REGIONS.length} regions…`);
  const regionIdByCode = new Map<string, string>();
  for (const r of REGIONS) {
    const row = await prisma.region.upsert({
      where: { code: r.code },
      create: { code: r.code, name: r.name, order: r.order },
      update: { name: r.name, order: r.order },
    });
    regionIdByCode.set(row.code, row.id);
  }
  console.log(`  ✓ ${regionIdByCode.size} regions`);

  // ── Provinces ──
  const provinces = await readJson<ProvinceSnapshot[]>(join(DATA_DIR, "provinces.json"));
  console.log(`Seeding ${provinces.length} provinces…`);
  const provinceIdByCode = new Map<string, string>();
  for (const p of provinces) {
    const regionId = regionIdByCode.get(p.regionCode);
    if (!regionId) {
      throw new Error(
        `Province ${p.code} (${p.name}) references unknown region "${p.regionCode}"`,
      );
    }
    const row = await prisma.province.upsert({
      where: { code: p.code },
      create: { code: p.code, slug: p.slug, name: p.name, regionId },
      update: { slug: p.slug, name: p.name, regionId },
    });
    provinceIdByCode.set(row.code, row.id);
  }
  console.log(`  ✓ ${provinceIdByCode.size} provinces`);

  // ── Departments ──
  const departments = await readJson<DepartmentSnapshot[]>(
    join(DATA_DIR, "departments.json"),
  );
  console.log(`Seeding ${departments.length} departments (chunks of 200)…`);
  const departmentIdByCode = new Map<string, string>();
  for (const batch of chunk(departments, 200)) {
    const rows = await Promise.all(
      batch.map((d) => {
        const provinceId = provinceIdByCode.get(d.provinceCode);
        if (!provinceId) {
          throw new Error(
            `Department ${d.code} (${d.name}) references unknown province "${d.provinceCode}"`,
          );
        }
        return prisma.department.upsert({
          where: { code: d.code },
          create: { code: d.code, slug: d.slug, name: d.name, provinceId },
          update: { slug: d.slug, name: d.name, provinceId },
        });
      }),
    );
    for (const row of rows) departmentIdByCode.set(row.code, row.id);
  }
  console.log(`  ✓ ${departmentIdByCode.size} departments`);

  // ── Localities ──
  const localities = await readJson<LocalitySnapshot[]>(
    join(DATA_DIR, "localities.json"),
  );
  console.log(`Seeding ${localities.length} localities (chunks of 200)…`);
  let localityCount = 0;
  for (const batch of chunk(localities, 200)) {
    await Promise.all(
      batch.map((l) => {
        const provinceId = provinceIdByCode.get(l.provinceCode);
        if (!provinceId) {
          throw new Error(
            `Locality ${l.code} (${l.name}) references unknown province "${l.provinceCode}"`,
          );
        }
        const departmentId = departmentIdByCode.get(l.departmentCode);
        if (!departmentId) {
          throw new Error(
            `Locality ${l.code} (${l.name}) references unknown department "${l.departmentCode}"`,
          );
        }
        return prisma.locality.upsert({
          where: { code: l.code },
          create: {
            code: l.code,
            slug: l.slug,
            name: l.name,
            lat: l.lat ?? null,
            lng: l.lng ?? null,
            departmentId,
            provinceId,
          },
          update: {
            slug: l.slug,
            name: l.name,
            lat: l.lat ?? null,
            lng: l.lng ?? null,
            departmentId,
            provinceId,
          },
        });
      }),
    );
    localityCount += batch.length;
    process.stdout.write(`    ${localityCount}/${localities.length}\r`);
  }
  process.stdout.write("\n");
  console.log(`  ✓ ${localities.length} localities`);

  console.log(
    `✓ Geography seeded: ${REGIONS.length} regions, ${provinces.length} provinces, ` +
      `${departments.length} departments, ${localities.length} localities`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// Phase: categories
// ─────────────────────────────────────────────────────────────────────

/**
 * 10 categorías nacionales con nombres en es / en / pt-BR (plural y
 * singular). Slugs en español (sin localizar) — son URLs estables.
 * Iconos quedan null por ahora (los decidimos en una fase futura).
 */
const CATEGORIES: Array<{
  slug: string;
  nameEs: string;
  nameEn: string;
  namePtBr: string;
  nameSingularEs: string;
  nameSingularEn: string;
  nameSingularPtBr: string;
  order: number;
}> = [
  {
    slug: "alojamientos",
    nameEs: "Alojamientos",
    nameEn: "Accommodations",
    namePtBr: "Hospedagens",
    nameSingularEs: "Alojamiento",
    nameSingularEn: "Accommodation",
    nameSingularPtBr: "Hospedagem",
    order: 1,
  },
  {
    slug: "restaurantes",
    nameEs: "Restaurantes",
    nameEn: "Restaurants",
    namePtBr: "Restaurantes",
    nameSingularEs: "Restaurante",
    nameSingularEn: "Restaurant",
    nameSingularPtBr: "Restaurante",
    order: 2,
  },
  {
    slug: "excursiones",
    nameEs: "Excursiones",
    nameEn: "Excursions",
    namePtBr: "Excursões",
    nameSingularEs: "Excursión",
    nameSingularEn: "Excursion",
    nameSingularPtBr: "Excursão",
    order: 3,
  },
  {
    slug: "guias-habilitados",
    nameEs: "Guías habilitados",
    nameEn: "Licensed guides",
    namePtBr: "Guias credenciados",
    nameSingularEs: "Guía habilitado",
    nameSingularEn: "Licensed guide",
    nameSingularPtBr: "Guia credenciado",
    order: 4,
  },
  {
    slug: "agencias",
    nameEs: "Agencias de viajes",
    nameEn: "Travel agencies",
    namePtBr: "Agências de viagem",
    nameSingularEs: "Agencia de viajes",
    nameSingularEn: "Travel agency",
    nameSingularPtBr: "Agência de viagem",
    order: 5,
  },
  {
    slug: "eventos",
    nameEs: "Eventos",
    nameEn: "Events",
    namePtBr: "Eventos",
    nameSingularEs: "Evento",
    nameSingularEn: "Event",
    nameSingularPtBr: "Evento",
    order: 6,
  },
  {
    slug: "sitios-de-interes",
    nameEs: "Sitios de interés",
    nameEn: "Points of interest",
    namePtBr: "Pontos de interesse",
    nameSingularEs: "Sitio de interés",
    nameSingularEn: "Point of interest",
    nameSingularPtBr: "Ponto de interesse",
    order: 7,
  },
  {
    slug: "terminales",
    nameEs: "Terminales",
    nameEn: "Bus & travel terminals",
    namePtBr: "Terminais",
    nameSingularEs: "Terminal",
    nameSingularEn: "Terminal",
    nameSingularPtBr: "Terminal",
    order: 8,
  },
  {
    slug: "tiendas-artesanales",
    nameEs: "Tiendas artesanales",
    nameEn: "Artisan shops",
    namePtBr: "Lojas artesanais",
    nameSingularEs: "Tienda artesanal",
    nameSingularEn: "Artisan shop",
    nameSingularPtBr: "Loja artesanal",
    order: 9,
  },
  {
    slug: "spas-termas",
    nameEs: "Spas y termas",
    nameEn: "Spas & hot springs",
    namePtBr: "Spas e termas",
    nameSingularEs: "Spa o termas",
    nameSingularEn: "Spa or hot springs",
    nameSingularPtBr: "Spa ou termas",
    order: 10,
  },
];

async function seedCategories(): Promise<void> {
  console.log(`Seeding ${CATEGORIES.length} categories…`);
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: c,
      update: c,
    });
  }
  console.log(`  ✓ ${CATEGORIES.length} categories`);
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const flags = parseFlags();
  if (flags.admin) await seedAdmin();
  if (flags.geo) await seedGeo();
  if (flags.categories) await seedCategories();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
