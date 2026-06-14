import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { cn } from "@/components/ui";
import { GEO_HERO_H1_ID } from "./GeoHero";

/*
  <EditorialContent /> — pattern v0.4-a §3 del handoff.

  Render del contenido editorial (`description` Markdown hasta 5.000
  chars + opcional `tagline` arriba como bajada). Server Component:
  el markdown se renderiza en server, no necesita JS de cliente.

  Pipeline:
    markdown (autor)
      -> remark-gfm (tables, autolinks, task lists, strikethrough)
      -> rehype-sanitize con schema estricto (allowlist de tags +
         atributos + protocolos)
      -> React tree via components mapping (clases prose con tokens
         del DS)

  Decisiones cerradas del handoff:
  - react-markdown (NO marked + DOMPurify). Sin paso por HTML
    intermedio: AST mdast -> hast -> React, sin
    dangerouslySetInnerHTML. El sanitizer trabaja sobre el AST
    despues del parse y antes del render, asi cualquier nodo no
    autorizado se descarta antes de llegar a React.
  - target="_blank" + rel="nofollow noopener noreferrer" SOLO para
    links externos (auto-detectados por protocolo http/https).
    Internos sin target.
  - Headings del autor degradados: `# h1` → render como h2 (ya hay
    un h1 unico de pagina en GeoHero). h4+ caps a h3 para no romper
    la jerarquia. Mapping en `components` — schema permite h1-h3 en
    tagNames, asi h1 pasa sanitize y components.h1 lo re-emite.
  - Spacing entre bloques: `> * + *` adjacent-sibling con
    margin-top space-5. Sin trucos exoticos — selector estandar
    via Tailwind arbitrary variant.

  Accesibilidad:
  - Jerarquia: h1 (hero) -> h2 (titulos de secciones markdown) ->
    h3 (subsecciones). Nunca skip.
  - Links externos: rel completo + target=_blank.
  - Sin dangerouslySetInnerHTML.
*/

/*
  Schema de sanitizacion (sobre el defaultSchema de rehype-sanitize).
  El defaultSchema ya tiene una allowlist conservadora; redefinimos
  tagNames y attributes para el subset que la editorial necesita:

  - tagNames: p, h1, h2, h3 (h1 se mantiene en allowlist pero
    components lo re-emite como h2 para preservar jerarquia), ul,
    ol, li, a, strong, em, blockquote, br, hr. Sin tables (gfm las
    activa pero el handoff no las permite todavia — la editorial
    no las pidio; si llegan se ven sin estilo).
  - attributes:
    - a: href + title + rel (solo nofollow/noopener/noreferrer) +
      target (solo _blank). Estos rel/target NORMALMENTE los agrega
      components.a en runtime para links externos, pero permitirlos
      en el schema defends-in-depth si algun preprocesador los
      hubiese inyectado.
  - protocols.href: http, https, mailto. NO ftp, NO data, NO
    javascript.

  Schema exportado para que `generateMetadata` lo pueda reusar al
  derivar plain-text desde markdown para Open Graph descriptions.
*/
export const editorialSanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    "p",
    "h1",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "a",
    "strong",
    "em",
    "blockquote",
    "br",
    "hr",
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: [
      "href",
      "title",
      ["rel", "nofollow", "noopener", "noreferrer"],
      ["target", "_blank"],
    ],
  },
  protocols: {
    href: ["http", "https", "mailto"],
  },
};

export interface EditorialContentProps {
  /**
   * Bajada editorial. Se renderiza ARRIBA del markdown, en Fraunces
   * 500 con `text-secondary`. Opcional. Si no se pasa, el bloque
   * arranca directo con el markdown.
   */
  tagline?: string | null;
  /**
   * Contenido markdown. Si es null o vacio, no se renderiza nada
   * (el caller deberia mostrar `PublicEmptyState` en ese caso).
   */
  markdown?: string | null;
  /**
   * Slot para hijos. Util para `TranslationDisclaimer` inline al
   * inicio del bloque, ANTES del tagline. Render order:
   *
   *   children -> tagline -> markdown
   *
   * Esto matchea la composicion sugerida en el handoff:
   *
   *   <EditorialContent>
   *     <TranslationDisclaimer ... />
   *   </EditorialContent>
   */
  children?: React.ReactNode;
  className?: string;
}

export function EditorialContent({
  tagline,
  markdown,
  children,
  className,
}: EditorialContentProps) {
  const hasMarkdown = typeof markdown === "string" && markdown.trim().length > 0;
  const hasTagline = typeof tagline === "string" && tagline.trim().length > 0;

  if (!hasMarkdown && !hasTagline && !children) return null;

  return (
    <section
      // aria-labelledby apunta al h1 del GeoHero — sin esto el
      // <section> no es un landmark para AT (sin label). Minor A
      // del audit.
      aria-labelledby={GEO_HERO_H1_ID}
      className={cn(
        "mx-auto w-full max-w-[68ch]",
        "px-[var(--space-8)] py-[var(--space-10)]",
        className,
      )}
    >
      {children && (
        <div className="mb-[var(--space-5)]">
          {children}
        </div>
      )}

      {hasTagline && (
        <p
          className={cn(
            // Bajada — Fraunces 500 sobre text-secondary, mas grande
            // que un parrafo y separada del cuerpo por space-8.
            "font-display font-medium",
            "text-[length:var(--text-xl)]",
            "leading-[var(--leading-snug)]",
            "text-[var(--text-secondary)]",
            "mb-[var(--space-8)]",
            // text-wrap pretty evita huerfanos al final de la bajada.
            "[text-wrap:pretty]",
          )}
        >
          {tagline}
        </p>
      )}

      {hasMarkdown && (
        /*
          Wrapper `.editorial-prose` aplica las clases `.prose` del
          handoff via Tailwind arbitrary variants en lugar de un
          @layer custom. Es la opcion mas mantenible: cada estilo es
          inline y se puede inspeccionar sin abrir un CSS global.

          Spacing entre bloques: `[&>*+*]:mt-[var(--space-5)]`
          (sibling combinator).

          line-height: el handoff §3 dice `--leading-relaxed (1.7)`
          pero el DS ya tiene `--leading-loose: 1.75` — diferencia
          0.05 invisible a ojo. Reusamos en vez de crear un token
          duplicado.
        */
        <div
          className={cn(
            // Cuerpo Inter, text-base, line-height loose.
            "text-[length:var(--text-base)]",
            "leading-[var(--leading-loose)]",
            "text-[var(--text-primary)]",
            // Espaciado entre bloques top-level.
            "[&>*+*]:mt-[var(--space-5)]",
          )}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[[rehypeSanitize, editorialSanitizeSchema]]}
            components={proseComponents}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      )}
    </section>
  );
}

/*
  Components mapping — convierte cada nodo del AST sanitizado en un
  elemento React con tokens del DS. Mantiene la jerarquia h1->h2
  (degradacion explicita) y aplica clases que matchean la tabla
  "Tokens exactos (clases .prose)" del handoff §3.

  Sin estados, sin efectos — todos los components son funciones
  puras. React.ComponentProps<"h2"> etc. en lugar de any para
  preservar tipado de children + atributos.
*/
type AnchorProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  children?: React.ReactNode;
};

function ExternalSafeAnchor({ href, children, ...rest }: AnchorProps) {
  // Links externos: protocolo absoluto detectado (http/https) o
  // protocol-relative (`//evil.com`). Los mailto: no llevan target=_blank
  // (mailto abre el cliente por default, no una nueva pestana).
  //
  // M1 fix: agregar `href.startsWith("//")` al check. Antes, un editor
  // que escribiera `[texto](//evil.com)` producia <a href="//evil.com">
  // SIN target=_blank y SIN rel="nofollow noopener noreferrer" —
  // navegacion same-tab al dominio externo + Referer header leakeado.
  // rehype-sanitize tampoco lo filtra (URL relativa al protocol = allowed).
  const isExternal =
    typeof href === "string" &&
    (/^https?:\/\//i.test(href) || href.startsWith("//"));
  return (
    <a
      href={href}
      {...(isExternal
        ? { target: "_blank", rel: "nofollow noopener noreferrer" }
        : {})}
      className={cn(
        "text-[var(--text-link)] hover:text-[var(--text-link-hover)]",
        "underline underline-offset-2",
        "decoration-1 hover:decoration-2",
        "transition-[text-decoration-thickness] duration-[var(--duration-fast)]",
      )}
      {...rest}
    >
      {children}
    </a>
  );
}

const proseComponents = {
  // Degradacion: h1 del autor -> h2 (un solo h1 por pagina en el
  // GeoHero). Misma clase que h2 para preservar la jerarquia visual.
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className={cn(
        "font-display font-semibold",
        "text-[length:var(--text-xl)]",
        "leading-[var(--leading-snug)]",
        // Override del margin-top base — h2 quiere mas aire (space-10).
        "mt-[var(--space-10)]",
      )}
      {...props}
    >
      {children}
    </h2>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className={cn(
        "font-display font-semibold",
        "text-[length:var(--text-xl)]",
        "leading-[var(--leading-snug)]",
        "mt-[var(--space-10)]",
      )}
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      className={cn(
        // h3 es Inter 700, mas chico que h2 para diferenciar la
        // jerarquia visualmente.
        "font-body font-bold",
        "text-[length:var(--text-md)]",
        "mt-[var(--space-8)]",
      )}
      {...props}
    >
      {children}
    </h3>
  ),
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props}>{children}</p>
  ),
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul
      className={cn(
        // Sangria + list-style none (usamos ::before via clase del item).
        "pl-[var(--space-6)] list-none",
      )}
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol
      className={cn(
        // Counter custom Fraunces 600 brand-600 via clase del item.
        "pl-[var(--space-6)] list-none [counter-reset:editorial]",
      )}
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => (
    <li
      className={cn(
        // Cada li puede ser de ul (bullet) o ol (counter). Distinguimos
        // via `:is(ul > *)` con `before:` content guion brand-400
        // 6x2px radius-pill. Ver clases.editorial-bullet en globals
        // si se prefiere extraer; por ahora inline arbitrary variant.
        "relative",
        // Bullet (ul) — guion brand-400, posicion absoluta.
        // Aplicado solo cuando el padre es <ul>.
        "[ul>&]:before:content-[''] [ul>&]:before:absolute",
        "[ul>&]:before:left-[calc(-1*var(--space-6))]",
        "[ul>&]:before:top-[calc(var(--leading-relaxed)*0.5em)]",
        "[ul>&]:before:w-[6px] [ul>&]:before:h-[2px]",
        "[ul>&]:before:bg-[var(--brand-400)]",
        "[ul>&]:before:rounded-full",
        // Counter (ol) — Fraunces 600, brand-600.
        "[ol>&]:before:[counter-increment:editorial]",
        "[ol>&]:before:content-[counter(editorial)'.']",
        "[ol>&]:before:absolute",
        "[ol>&]:before:left-[calc(-1*var(--space-6))]",
        "[ol>&]:before:font-display [ol>&]:before:font-semibold",
        "[ol>&]:before:text-[var(--brand-600)]",
        // Margen entre items hermanos.
        "[&+&]:mt-[var(--space-2)]",
      )}
      {...props}
    >
      {children}
    </li>
  ),
  a: ExternalSafeAnchor,
  strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong
      // weight 600 (no 700) — no rompe el ritmo de lectura.
      className={cn("font-semibold")}
      {...props}
    >
      {children}
    </strong>
  ),
  em: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <em className="italic" {...props}>
      {children}
    </em>
  ),
  blockquote: ({
    children,
    ...props
  }: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className={cn(
        "border-l-[3px] border-[var(--brand-100)]",
        "pl-[var(--space-5)]",
        "text-[var(--text-secondary)] italic",
      )}
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: (props: React.HTMLAttributes<HTMLHRElement>) => (
    <hr
      className="border-0 border-t border-[var(--border-subtle)]"
      {...props}
    />
  ),
};
