import * as React from "react";
import { MapPin, ChevronLeft } from "@/components/ui/icons";
import { Button, EmptyState } from "@/components/ui";
import { Link } from "@/i18n/navigation";

/*
  <PublicEmptyState /> — pattern v0.4-a §6 del handoff.

  Composicion del <EmptyState /> existente (no es un componente
  nuevo desde cero). Se monta cuando un nivel geografico existe
  pero NO tiene tagline ni description ni galeria ni fichas ni
  sub-niveles con fichas.

  Diferencias contra la variante admin del mismo EmptyState:
  - size="lg" (es el contenido principal de la pagina, no un caso
    secundario).
  - Icono MapPin (lugar generico).
  - Sin CTA "Crear primera ficha" (eso es admin-only). En su lugar
    botones de navegacion al padre/abuelo: "Volver a {padre}"
    (secondary) + "Explorar {abuelo}" (ghost).
  - Tono honesto: "Todavia estamos construyendo esta pagina" en
    lugar del operativo "No hay nada cargado todavia".

  La pagina compone los textos (i18n + interpolacion del name de
  padre/abuelo) y los pasa como props. PublicEmptyState NO conoce
  i18n — toda la UX la maneja el caller. Esta separacion permite
  que la pagina decida copy contextual segun nivel (region vs
  locality) sin que el componente arbitre.

  Server Component — EmptyState es client pero la composicion
  no requiere estado en el wrapper.
*/

export interface PublicEmptyStateProps {
  /**
   * Titulo principal. Ej. "Todavia estamos construyendo esta pagina".
   */
  title: string;
  /**
   * Descripcion editorial. Pasada ya interpolada con name del nivel
   * y level label apropiado.
   */
  description?: string;
  /**
   * Navegacion al padre directo. Si no se pasa, NO se renderiza
   * el boton "Volver a ..." (caso region sin padre — no aplica,
   * region siempre tiene padre conceptual via home).
   */
  parent?: {
    name: string;
    href: string;
    /** Texto del boton, ej. "Volver a Mendoza". Compuesto por la pagina. */
    label: string;
  };
  /**
   * Navegacion al abuelo. Opcional. Para region/province a menudo
   * no aplica (region no tiene abuelo geografico, province podria
   * apuntar al region).
   */
  grandparent?: {
    name: string;
    href: string;
    label: string;
  };
  className?: string;
}

export function PublicEmptyState({
  title,
  description,
  parent,
  grandparent,
  className,
}: PublicEmptyStateProps) {
  return (
    <EmptyState
      size="lg"
      icon={<MapPin className="h-6 w-6" />}
      title={title}
      description={description}
      action={
        (parent || grandparent) && (
          <div className="flex flex-wrap items-center justify-center gap-[var(--space-2)]">
            {parent && (
              <Button asChild variant="secondary">
                <Link
                  href={parent.href}
                  aria-label={`Volver a ${parent.name}`}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  <span>{parent.label}</span>
                </Link>
              </Button>
            )}
            {grandparent && (
              <Button asChild variant="ghost">
                <Link
                  href={grandparent.href}
                  aria-label={`Explorar ${grandparent.name}`}
                >
                  <span>{grandparent.label}</span>
                </Link>
              </Button>
            )}
          </div>
        )
      }
      className={className}
    />
  );
}
