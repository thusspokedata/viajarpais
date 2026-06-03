/*
  Helpers para procesar markdown del editor en contextos donde NO
  queremos renderizar HTML (Open Graph descriptions, JSON-LD,
  <title>, meta description).

  El schema completo de sanitizacion para render React vive en
  `@/components/public/EditorialContent` (export
  `editorialSanitizeSchema`), porque es donde se aplica a traves de
  react-markdown + rehype-sanitize sobre el AST hast.

  Aca solo exponemos un strip plain-text para metadata. Reglas:

  - No usa AST — regex pragmaticas que cubren los casos comunes del
    markdown que carga el editor. Si en el futuro se requiere
    extraccion mas robusta (e.g. preservar links como "texto (url)"),
    migrar a `mdast-util-to-string` + `remark-parse`.
  - Trim final, espacios colapsados, sin newlines.
  - Opcional `maxLength` con truncado por ellipsis para Open Graph
    (default 155 chars segun convencion social).
*/

/**
 * Strip de sintaxis markdown a plain text. Cubre headings, bold,
 * italic, links, imagenes, code inline, code blocks, blockquotes,
 * listas (- y 1.), tables (gfm). Colapsa newlines y whitespace.
 *
 * NO es seguridad — la sanitization HTML se hace en rehype-sanitize.
 * Este helper es solo formato para uso en metadata.
 */
export function stripMarkdown(md: string): string {
  return md
    // Headings (# h1, ## h2, etc.)
    .replace(/^#{1,6}\s+/gm, "")
    // Bold (**foo** or __foo__)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    // Italic (*foo* or _foo_)
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    // Inline code (`foo`)
    .replace(/`([^`]+)`/g, "$1")
    // Code blocks (```...```)
    .replace(/```[\s\S]*?```/g, "")
    // Images: ![alt](url) → alt
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    // Links: [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Blockquotes
    .replace(/^>\s+/gm, "")
    // Unordered lists
    .replace(/^[-*+]\s+/gm, "")
    // Ordered lists
    .replace(/^\d+\.\s+/gm, "")
    // Horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Table separators (|---|)
    .replace(/\|[-:|\s]+\|/g, "")
    // Table pipes
    .replace(/\|/g, " ")
    // Newlines a espacios
    .replace(/\n+/g, " ")
    // Colapsar whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Plain text con truncado por ellipsis. Pensado para Open Graph
 * description (~155 chars), meta description (~155-160), JSON-LD
 * description, etc.
 *
 * Si el texto post-strip es <= maxLength, devuelve como esta.
 * Si excede, corta a maxLength-1 (para el ellipsis) y agrega "…".
 *
 * Trim adicional al final para evitar "...hola " con espacio.
 */
export function markdownToPlainText(md: string, maxLength = 155): string {
  const plain = stripMarkdown(md);
  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength - 1).trimEnd() + "…";
}
