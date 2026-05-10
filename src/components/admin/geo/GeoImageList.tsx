"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Trash } from "@/components/ui/icons";
import { Button, EmptyState, cn } from "@/components/ui";

export type GeoImage = {
  id: string;
  url: string;
  caption: string | null;
  altText: string | null;
  isPrimary: boolean;
  order: number;
};

export type DeleteImageAction = (
  imageId: string,
) => Promise<{ ok: boolean; message?: string }>;

/*
  GeoImageList — read-only en v0.3-geo-a.

  Lista las imágenes existentes de un nivel geográfico (Region,
  Province, Department, Locality) con previews y un botón de Eliminar
  por cada una. NO incluye:
  - Botón de upload (la UI de upload llega en v0.3-geo-c).
  - Drag & drop para reordenar.
  - Edición de caption / altText.
  - Toggle primary.

  En v0.3-geo-a el editor no puede subir imágenes desde la UI — la
  lista habitualmente va a estar vacía. Pero si por API directa o
  seed se cargan imágenes, este componente las muestra con la opción
  de borrarlas.
*/
export function GeoImageList({
  images,
  deleteAction,
  emptyMessage = "Todavía no hay imágenes para este lugar.",
}: {
  images: GeoImage[];
  deleteAction: DeleteImageAction;
  emptyMessage?: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function handleDelete(imageId: string) {
    if (
      !confirm(
        "¿Eliminar esta imagen? Se borra del CDN y no se puede recuperar.",
      )
    ) {
      return;
    }
    setError(null);
    setPendingId(imageId);
    startTransition(async () => {
      try {
        const res = await deleteAction(imageId);
        if (!res.ok) {
          setError(res.message ?? "No se pudo eliminar la imagen.");
        } else {
          router.refresh();
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error inesperado al eliminar.",
        );
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[var(--text-xs)] text-[var(--text-muted)] leading-[var(--leading-normal)]">
        La gestión de imágenes (subir, ordenar, marcar como destacada,
        editar captions) llega en v0.3-geo-c. Por ahora podés ver y
        eliminar las que ya están cargadas.
      </p>

      {error ? (
        <div
          role="alert"
          className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--danger-fg)]/40 bg-[var(--danger-bg)] text-[var(--danger-fg)] text-[var(--text-xs)]"
        >
          {error}
        </div>
      ) : null}

      {images.length === 0 ? (
        <EmptyState title="Sin imágenes" description={emptyMessage} />
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {images.map((img) => {
            const isDeleting = pendingId === img.id && isPending;
            return (
              <li
                key={img.id}
                className={cn(
                  "border border-[var(--border-subtle)] rounded-[var(--radius-md)] bg-[var(--surface-base)] overflow-hidden",
                  isDeleting && "opacity-50",
                )}
              >
                <div className="relative aspect-[4/3] bg-[var(--surface-sunken)]">
                  <Image
                    src={img.url}
                    alt={img.altText ?? img.caption ?? "Imagen"}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    unoptimized
                  />
                  {img.isPrimary ? (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--brand-primary)] text-[var(--brand-primary-fg)] text-[10px] font-display uppercase tracking-[var(--tracking-caps)]">
                      Destacada
                    </span>
                  ) : null}
                </div>
                <div className="p-3 flex flex-col gap-2">
                  {img.caption ? (
                    <p className="text-[var(--text-xs)] text-[var(--text-secondary)] line-clamp-2">
                      {img.caption}
                    </p>
                  ) : (
                    <p className="text-[var(--text-xs)] text-[var(--text-muted)] italic">
                      Sin caption
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isDeleting}
                    onClick={() => handleDelete(img.id)}
                    leadingIcon={<Trash className="h-3.5 w-3.5" />}
                    className="self-start"
                  >
                    {isDeleting ? "Eliminando…" : "Eliminar"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
