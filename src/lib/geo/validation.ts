import { z } from "zod";

/*
  Validaciones zod para el form de contenido editorial de los 4 niveles
  geográficos (Region, Province, Department, Locality). Compartidas
  entre cliente (RHF + zodResolver) y server actions.

  Los 4 niveles aceptan exactamente los mismos campos editoriales para
  v0.3-geo-a — el form admin va a ser uno solo (`EditorialContentForm`)
  parametrizado por nivel + stats.

  Solo se editan los campos `*Es`. Las traducciones `*En` y `*PtBr` las
  va a generar DeepL en v0.3-geo-b — el editor no las modifica desde
  admin.

  Límites alineados con la spec:
  - tagline:         max 120 chars (frase corta para hero / og:description / cards)
  - description:     max 5000 chars (markdown básico)
  - metaTitle:       max 60 chars (SEO best practice)
  - metaDescription: max 160 chars (SEO best practice)
*/

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} no puede superar los ${max} caracteres.`)
    .or(z.literal(""))
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

export const GeoEditorialContentSchema = z.object({
  taglineEs: optionalText(120, "El tagline"),
  descriptionEs: optionalText(5000, "La descripción"),
  metaTitleEs: optionalText(60, "El meta title"),
  metaDescriptionEs: optionalText(160, "La meta description"),
});

export type GeoEditorialContentInput = z.input<
  typeof GeoEditorialContentSchema
>;
export type GeoEditorialContentValues = z.output<
  typeof GeoEditorialContentSchema
>;
