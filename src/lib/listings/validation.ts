import { z } from "zod";

/*
  Schemas zod para Listing. Compartidos entre cliente (form) y server
  action. NO importa nada de "server-only" para que pueda correr en el
  navegador con react-hook-form + zodResolver.
*/

// Mantener en sync con prisma/schema.prisma
export const PriceRangeSchema = z.enum(["BUDGET", "MID", "HIGH", "LUXURY"]);
export const PaymentMethodSchema = z.enum([
  "CASH",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "MERCADO_PAGO",
  "TRANSFER",
  "CRYPTO",
]);
export const SpokenLanguageSchema = z.enum(["ES", "EN", "PT", "FR", "DE", "IT"]);
export const ListingStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const ListingTierSchema = z.enum(["FREE", "PAID", "FEATURED"]);

// Slug escrito a mano: minúsculas, números, guiones (sin "--", sin
// guiones en extremos). El cliente NO valida unicidad — eso lo hace
// la server action contra la DB.
const HANDWRITTEN_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
export const TimeRangeSchema = z
  .object({
    open: z.string().regex(TIME_REGEX, "Formato HH:MM (24h)"),
    close: z.string().regex(TIME_REGEX, "Formato HH:MM (24h)"),
  })
  .refine((r) => r.open < r.close, {
    message: "La hora de cierre debe ser posterior a la de apertura.",
    path: ["close"],
  });

const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export const OpeningHoursSchema = z
  .object({
    monday: z.array(TimeRangeSchema).default([]),
    tuesday: z.array(TimeRangeSchema).default([]),
    wednesday: z.array(TimeRangeSchema).default([]),
    thursday: z.array(TimeRangeSchema).default([]),
    friday: z.array(TimeRangeSchema).default([]),
    saturday: z.array(TimeRangeSchema).default([]),
    sunday: z.array(TimeRangeSchema).default([]),
  })
  .nullable()
  .optional();

export type OpeningHours = z.infer<typeof OpeningHoursSchema>;
export const OPENING_HOURS_DAYS = DAY_KEYS;

export const CategoryEntrySchema = z.object({
  categoryId: z.string().min(1, "Categoría inválida"),
  isPrimary: z.boolean(),
});

const optionalUrl = (label: string) =>
  z
    .string()
    .trim()
    .url(`${label} debe ser una URL válida (https://...)`)
    .or(z.literal(""))
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

const optionalNonEmpty = z
  .string()
  .trim()
  .or(z.literal(""))
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const optionalEmail = z
  .string()
  .trim()
  .email("Email inválido")
  .or(z.literal(""))
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

/*
  Coordenadas opcionales. Si el campo está vacío o null, queda como
  `undefined`. Si tiene contenido, debe parsear a número finito —
  caso contrario el form muestra error inline en vez de descartarlo
  silenciosamente como hacía la versión anterior con `transform`.
  Antes, escribir "abc" en lat se traducía a `undefined` y se guardaba
  como null sin avisar al editor.
*/
const optionalLatLng = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .superRefine((v, ctx) => {
    if (v === null || v === undefined) return;
    if (typeof v === "number") {
      if (!Number.isFinite(v)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Número inválido.",
        });
      }
      return;
    }
    const s = v.trim();
    if (!s) return;
    const n = Number(s);
    if (!Number.isFinite(n)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Coordenada inválida — usá un número decimal (ej. -32.8908).",
      });
    }
  })
  .transform((v) => {
    if (v === null || v === undefined) return undefined;
    if (typeof v === "number") return v;
    const s = v.trim();
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  });

// Algunos atributos JSON del usuario son texto crudo en el form;
// el server action lo parsea con esta validación.
export const AttributesSchema = z
  .union([z.record(z.string(), z.unknown()), z.null()])
  .optional();

export const ListingFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "El nombre debe tener al menos 3 caracteres.")
      .max(200, "El nombre no puede superar los 200 caracteres."),

    slug: z
      .string()
      .trim()
      .or(z.literal(""))
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined))
      .refine(
        (v) => v === undefined || HANDWRITTEN_SLUG_REGEX.test(v),
        {
          message:
            "El slug solo puede contener letras minúsculas, números y guiones (no al inicio/fin, sin guiones consecutivos).",
        },
      ),

    description: z
      .string()
      .trim()
      .min(200, "La descripción debe tener al menos 200 caracteres.")
      .max(2000, "La descripción no puede superar los 2000 caracteres."),

    provinceId: z.string().min(1, "Elegí una provincia."),
    departmentId: z.string().min(1, "Elegí un departamento."),
    localityId: z.string().min(1, "Elegí una localidad."),
    address: z.string().trim().min(1, "Ingresá una dirección.").max(200),
    lat: optionalLatLng,
    lng: optionalLatLng,

    phone: optionalNonEmpty,
    whatsapp: optionalNonEmpty,
    email: optionalEmail,
    website: optionalUrl("Website"),

    instagram: optionalNonEmpty,
    facebook: optionalUrl("Facebook"),
    tiktok: optionalNonEmpty,
    youtube: optionalUrl("YouTube"),

    priceRange: PriceRangeSchema.optional().nullable(),
    openingHours: OpeningHoursSchema,
    paymentMethods: z.array(PaymentMethodSchema).default([]),
    languages: z.array(SpokenLanguageSchema).default([]),

    attributes: AttributesSchema,

    metaTitle: optionalNonEmpty,
    metaDescription: optionalNonEmpty,

    categories: z
      .array(CategoryEntrySchema)
      .min(1, "Elegí al menos una categoría."),
  })
  .refine(
    (data) =>
      Boolean(data.phone || data.whatsapp || data.email || data.website),
    {
      message:
        "Tenés que cargar al menos un dato de contacto (teléfono, WhatsApp, email o website).",
      path: ["phone"],
    },
  )
  .refine(
    (data) => data.categories.filter((c) => c.isPrimary).length === 1,
    {
      message: "Marcá exactamente una categoría como principal.",
      path: ["categories"],
    },
  );

export type ListingFormInput = z.input<typeof ListingFormSchema>;
export type ListingFormValues = z.output<typeof ListingFormSchema>;

/**
 * Valida texto crudo del campo `attributes` del form.
 * Acepta vacío (→ undefined) o un JSON object parseable.
 */
export function parseAttributesText(raw: string): {
  ok: true;
  value: Record<string, unknown> | undefined;
} | {
  ok: false;
  error: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: undefined };
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return { ok: false, error: "Atributos debe ser un objeto JSON ({ ... })." };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: "JSON inválido en Atributos." };
  }
}
