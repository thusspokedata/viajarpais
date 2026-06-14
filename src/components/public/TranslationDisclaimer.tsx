"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Languages } from "@/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { cn } from "@/components/ui";

/*
  <TranslationDisclaimer /> — pattern v0.4-a §5 del handoff.

  Pill inline al inicio del EditorialContent que comunica al lector
  que el texto fue traducido automaticamente con DeepL. SOLO se
  renderiza cuando:

    locale !== "es"  &&  (descriptionSource === "MACHINE"
                          ||  taglineSource === "MACHINE")

  Si ambos sources son REVIEWED o HUMAN, no aparece. Si solo el
  tagline esta MACHINE pero la description ya fue revisada, aparece
  porque parte del contenido sigue siendo automatica — es la forma
  honesta (decision cerrada con PM).

  Por que es Client Component (difiere del handoff que sugiere Server):
  - El tooltip "?" usa Radix Tooltip que necesita estado de
    open/close + handlers. Radix Tooltip no funciona en server
    components.
  - Alternativa: spliteralo en outer pill server + inner tooltip
    client. Lo descartamos por simplicidad — el componente es de
    ~60 lineas y un leaf, el costo de JS extra es trivial.
  - El handoff dice "Server Component (el locale es server-known)"
    explicando POR QUE seria server — locale como prop ya viene del
    server. Pero pasarlo como prop a un client component logra lo
    mismo, sin perder server-side rendering del contenido (solo
    el handler de tooltip queda en client).

  No usa TooltipProvider envolvente — Radix Tooltip funciona con
  defaults razonables sin Provider. La pagina admin si usa Provider
  porque tiene muchos tooltips; aca solo uno.

  Decision cerrada del PM (commit 4 del PR):
  - "Translated automatically" etc. en mayuscula al principio (weight 600).
  - "— original text in Spanish" en text-muted (parte secundaria).
  - Tooltip con explicacion completa de DeepL + nota sobre revisiones
    editoriales para regiones/provincias principales.

  Tokens (todos existentes):
  - Contenedor pill: bg surface-sunken, border subtle, radius-pill.
  - Padding: 7px (top/bottom), 12px (right), 10px (left, da espacio
    al icono).
  - Texto: text-sm, text-secondary base, text-primary weight 600
    para el grito "Translated automatically", text-muted para el
    origen "original text in Spanish".
  - Icono Languages 16px, text-muted.
  - "?" circulo 18px borde border-strong, cursor:help.
  - Tooltip content: neutral-900 bg + text-inverse, max-w-xs,
    shadow-elevated (ya viene del TooltipContent compartido).
*/

export type TranslationSource = "NONE" | "MACHINE" | "REVIEWED" | "HUMAN";

export interface TranslationDisclaimerProps {
  locale: "es" | "en" | "pt-BR";
  /**
   * Source del campo `description*` del nivel. Null si el nivel no
   * tiene description editorial cargada todavia.
   */
  descriptionSource?: TranslationSource | null;
  /**
   * Source del campo `tagline*` del nivel. Null si no hay tagline.
   */
  taglineSource?: TranslationSource | null;
  className?: string;
}

export function TranslationDisclaimer({
  locale,
  descriptionSource,
  taglineSource,
  className,
}: TranslationDisclaimerProps) {
  // Hooks SIEMPRE primero — React no acepta llamadas condicionales.
  // useTranslations en locale es no rompe (el hook funciona), solo
  // no emitimos UI porque el guard returns null.
  const t = useTranslations("Public.translationDisclaimer");

  // Visibility en el componente: cleaner que en el loader porque
  // consolida la regla en un solo lugar y es facil de testear.
  if (locale === "es") return null;
  const anyMachine =
    descriptionSource === "MACHINE" || taglineSource === "MACHINE";
  if (!anyMachine) return null;

  return (
    <div
      role="note"
      className={cn(
        "inline-flex items-center gap-[var(--space-2)]",
        "bg-[var(--surface-sunken)]",
        "border border-[var(--border-subtle)]",
        "rounded-full",
        // Padding: 7px y 12px (right) / 10px (left para el icono)
        "pl-[10px] pr-[12px] py-[7px]",
        // text-sm Inter
        "text-[length:var(--text-sm)]",
        "text-[var(--text-secondary)]",
        className,
      )}
    >
      <Languages
        aria-hidden="true"
        className="h-4 w-4 text-[var(--text-muted)] shrink-0"
      />
      <span>
        <span className="font-semibold text-[var(--text-primary)]">
          {t("leadStrong")}
        </span>
        <span className="text-[var(--text-muted)]">{t("leadMuted")}</span>
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={t("tooltipQuestion")}
            className={cn(
              "inline-flex items-center justify-center",
              "h-[18px] w-[18px] rounded-full",
              "border border-[var(--border-strong)]",
              "text-[length:var(--text-xs)] font-semibold",
              "text-[var(--text-muted)]",
              "cursor-help",
              "transition-colors duration-[var(--duration-fast)]",
              "hover:text-[var(--text-primary)] hover:border-[var(--text-primary)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
              "focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-[var(--surface-canvas)]",
            )}
          >
            ?
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          className="max-w-[280px] leading-[var(--leading-normal)]"
        >
          {t("tooltipBody")}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
