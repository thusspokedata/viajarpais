/*
  Este modulo NO usa "server-only" porque `slugify` y `SLUG_REGEX` viven
  tambien en el cliente (preview del slug en el form admin). Las
  funciones que tocan la DB reciben `prisma` como parametro y solo se
  invocan desde server actions / data loaders. No hay riesgo de filtrar
  credenciales al bundle del cliente porque el archivo no importa
  ninguna conexion a DB — la conexion la inyecta el caller.
*/
import type { PrismaClient } from "@/generated/prisma/client";

// Combining diacritical marks block (U+0300 .. U+036F) — escapes
// explícitos para que el archivo sea grep-friendly en cualquier editor.
const DIACRITICS_REGEX = new RegExp(`[̀-ͯ]`, "g");

/**
 * Convierte un nombre legible en un slug URL-friendly.
 * Quita diacríticos, baja a minúsculas, colapsa caracteres no-alfanuméricos
 * a guiones, y trimea guiones de los extremos.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Regex para validar slugs escritos a mano por el editor.
 * - Solo `a-z`, `0-9`, `-`.
 * - No empieza ni termina con `-`.
 * - Sin `--` consecutivos.
 */
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class SlugCollisionError extends Error {
  constructor(
    message: string,
    public readonly attempted: string[],
  ) {
    super(message);
    this.name = "SlugCollisionError";
  }
}

async function isListingSlugAvailable(
  prisma: PrismaClient,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const existing = await prisma.listing.findFirst({
    where: {
      slug,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  return !existing;
}

/**
 * Genera un slug único para un Listing.
 *
 * Estrategia:
 * 1. `slugify(name)`. Si está libre → usar.
 * 2. Si colisiona, agregar sufijo de localidad: `slugify(name)-{localitySlug}`.
 *    Si está libre → usar.
 * 3. Si la versión con localidad también colisiona, fallar con
 *    `SlugCollisionError`. El editor escribe a mano.
 *
 * Razón: URLs con localidad como sufijo tienen valor SEO contextual
 * (ej. `cabanas-don-pedro-uspallata`), a diferencia de un sufijo numérico.
 */
export async function generateUniqueSlug(
  prisma: PrismaClient,
  name: string,
  localitySlug: string,
  excludeId?: string,
): Promise<string> {
  const baseSlug = slugify(name);
  if (!baseSlug) {
    throw new Error(
      "El nombre no produce un slug válido. Usá al menos un carácter alfanumérico.",
    );
  }

  if (await isListingSlugAvailable(prisma, baseSlug, excludeId)) {
    return baseSlug;
  }

  const withLocality = `${baseSlug}-${localitySlug}`;
  if (await isListingSlugAvailable(prisma, withLocality, excludeId)) {
    return withLocality;
  }

  throw new SlugCollisionError(
    `No se pudo generar un slug único para "${name}". Por favor, escribilo a mano.`,
    [baseSlug, withLocality],
  );
}

/**
 * Verifica que un slug escrito a mano sea válido en formato y único.
 * Tira `Error` con mensaje user-friendly si falla.
 */
export async function assertSlugValidAndAvailable(
  prisma: PrismaClient,
  slug: string,
  excludeId?: string,
): Promise<void> {
  if (!SLUG_REGEX.test(slug)) {
    throw new Error(
      "El slug solo puede contener letras minúsculas, números y guiones. No puede empezar ni terminar con guion ni tener guiones consecutivos.",
    );
  }
  const ok = await isListingSlugAvailable(prisma, slug, excludeId);
  if (!ok) {
    throw new Error(`El slug "${slug}" ya está en uso por otra ficha.`);
  }
}
