import * as React from "react";

/*
  <JsonLd /> — Server Component para emitir bloques JSON-LD
  estructurados (schema.org) en el <head>/<body> de las paginas
  publicas.

  Por que no `<script>` con children JSX:
  - React no permite children dentro de <script>, hay que pasarlo
    por dangerouslySetInnerHTML.
  - JSON.stringify por defecto NO escapa `<`, asi que un valor
    string con `</script>` rompe el cierre. Vector clasico de XSS
    si el JSON viene de datos del usuario.

  Mitigacion:
  - JSON.stringify + replace de `<` por `<` antes de inyectar.
  - Esto preserva la semantica del JSON (los parsers leen <
    como `<`) pero el browser HTML parser NO interpreta `<`
    como cierre de tag.
  - Es la mitigacion estandar recomendada en docs de Next, MDN, y
    OWASP.

  Defensa en profundidad — los strings que llegan aca ya pasaron
  por `markdownToPlainText` (que strippea HTML) y por el schema de
  TypeScript estricto. Pero la JSON-LD escape es la unica linea
  contra `</script>` injection.
*/

export interface JsonLdProps {
  /**
   * Objeto JSON-LD (con @context, @type, etc.) listo para
   * stringificarse. Puede ser un solo objeto o un array de
   * objetos (cada uno emite su propio <script>).
   */
  data: Record<string, unknown> | Record<string, unknown>[];
}

/**
 * Escape de string JSON para inclusion en <script> tag. Reemplaza
 * `<` por `<` para prevenir `</script>` injection. Tambien
 * escapa `>` y `&` por defense in depth (algunos parsers viejos
 * tratan `&` como entity).
 */
function safeJsonStringify(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function JsonLd({ data }: JsonLdProps) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((item, idx) => (
        <script
          key={idx}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonStringify(item),
          }}
        />
      ))}
    </>
  );
}
