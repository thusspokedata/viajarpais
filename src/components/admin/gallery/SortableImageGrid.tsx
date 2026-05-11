"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Star,
  Edit,
  Trash,
} from "@/components/ui/icons";
import { Badge, cn } from "@/components/ui";
import {
  deleteImage,
  reorderImages,
  setImageAsPrimary,
} from "@/server/actions/images";
import type { EntityType } from "@/lib/images/dispatcher";
import { EditCaptionDialog } from "./EditCaptionDialog";

/*
  `<SortableImageGrid />` — grid del admin con drag & drop reorder,
  primary toggle, edit caption/altText y delete. Cada card es
  `<SortableImageCard />` usando `@dnd-kit/sortable`.

  Drag & drop con `@dnd-kit`:
  - `PointerSensor` para mouse + touch.
  - `KeyboardSensor` con `sortableKeyboardCoordinates` para teclado
    (Space para grab, flechas para mover, Enter para soltar). El
    handle muestra GripVertical pero TODA la card es draggable —
    `dnd-kit` maneja focus/grab correctamente.

  Estrategia: `rectSortingStrategy` para grids (no listas verticales).
  El `arrayMove` reordena el array local optimistically; después
  llamamos a `reorderImages` server action. Si falla, refrescamos
  para volver al estado del server.
*/

export type GalleryImage = {
  id: string;
  cloudinaryPublicId: string;
  /** URL del asset sin transformación. Cloudinary's original. */
  url: string;
  /**
   * URL del thumbnail con la transformación `c_fill,w_200,h_200,...`
   * aplicada — pre-construido en el Server Component padre con
   * `cloudinaryUrl(publicId, "thumbnail")`. El client component no
   * tiene acceso al server-only helper, por eso viene como prop.
   */
  thumbnailUrl: string;
  caption: string | null;
  altText: string | null;
  order: number;
  isPrimary: boolean;
};

export type SortableImageGridProps = {
  entityType: EntityType;
  entityId: string;
  images: GalleryImage[];
};

export function SortableImageGrid({
  entityType,
  entityId,
  images: serverImages,
}: SortableImageGridProps) {
  const router = useRouter();

  /*
    Reorder optimista sin "ref-as-state". El render por default usa el
    orden del server. Durante un drag, guardamos un override en
    `optimisticOrder`. Si el server confirma (refresh trae nuevo
    orden), el override coincide visualmente con server y limpiarlo es
    no-op visual. Si el server rechaza, llamamos a `router.refresh()`
    y el `optimisticOrder` queda stale por una fracción de segundo,
    pero el siguiente render recibe `serverImages` con el orden
    original — visualmente vuelve al estado pre-drag.

    Patrón idiomatic React 19: state derivado via `??`, sin
    `useEffect`/ref para sincronizar con props.
  */
  const [optimisticOrder, setOptimisticOrder] = React.useState<string[] | null>(
    null,
  );

  const serverOrder = React.useMemo(
    () => serverImages.map((i) => i.id),
    [serverImages],
  );

  const localOrder = optimisticOrder ?? serverOrder;

  const orderedImages = React.useMemo(() => {
    const byId = new Map(serverImages.map((i) => [i.id, i]));
    return localOrder
      .map((id) => byId.get(id))
      .filter((i): i is GalleryImage => Boolean(i));
  }, [localOrder, serverImages]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Pequeño delay para que un click simple (sin drag) no inicie
      // un drag — el editor debe poder cliquear botones de la card.
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const [editing, setEditing] = React.useState<GalleryImage | null>(null);
  const [pending, startTransition] = React.useTransition();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localOrder.indexOf(String(active.id));
    const newIndex = localOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(localOrder, oldIndex, newIndex);
    setOptimisticOrder(next);

    startTransition(async () => {
      const res = await reorderImages({
        entityType,
        entityId,
        orderedImageIds: next,
      });
      if (!res.ok) {
        toast.error(res.message);
        // Rollback visual: limpiar el override y pedir state del server.
        setOptimisticOrder(null);
        router.refresh();
        return;
      }
      // Éxito: refrescar para que el server traiga el nuevo orden
      // canónico. El optimistic se vuelve consistente con server.
      router.refresh();
    });
  }

  function handleSetPrimary(imageId: string) {
    startTransition(async () => {
      const res = await setImageAsPrimary({ imageId, entityType });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete(imageId: string) {
    const ok = window.confirm(
      "¿Eliminar esta imagen? También se borra de Cloudinary.",
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteImage({ imageId, entityType });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Imagen eliminada.");
      router.refresh();
    });
  }

  if (orderedImages.length === 0) {
    return (
      <div className="text-[var(--text-sm)] text-[var(--text-muted)] italic px-4 py-6 text-center border border-dashed border-[var(--border-subtle)] rounded-[var(--radius-lg)]">
        Todavía no hay imágenes para este lugar.
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={localOrder} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {orderedImages.map((img) => (
              <SortableImageCard
                key={img.id}
                image={img}
                onSetPrimary={() => handleSetPrimary(img.id)}
                onEdit={() => setEditing(img)}
                onDelete={() => handleDelete(img.id)}
                disabled={pending}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <EditCaptionDialog
        image={editing}
        entityType={entityType}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

// ===========================================================
// SortableImageCard — una card por imagen, draggable + actions
// ===========================================================

type SortableImageCardProps = {
  image: GalleryImage;
  onSetPrimary: () => void;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
};

function SortableImageCard({
  image,
  onSetPrimary,
  onEdit,
  onDelete,
  disabled,
}: SortableImageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex flex-col gap-2 p-2",
        "rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-base)]",
        isDragging && "shadow-[var(--shadow-elevated)]",
      )}
    >
      {/*
        Thumbnail. Usamos `<img>` plain (no `next/image`) apuntando
        directamente al `thumbnailUrl` con transformación Cloudinary
        ya aplicada (`c_fill,w_200,h_200,f_auto,q_auto`). Beneficios:
        - Cloudinary CDN sirve el asset; Next no necesita configurar
          `remotePatterns` ni proxyear vía su image optimizer.
        - `f_auto,q_auto` ya negocia formato/calidad por navegador.
        - El `thumbnailUrl` viene pre-construido del Server Component
          padre porque `cloudinaryUrl` es server-only.

        M6: Preview admin con `aspect-square` forzado para consistencia
        visual del grid (200×200 crops uniformes). El master subido a
        Cloudinary preserva el aspect ratio original (decisión cerrada
        de v0.3-geo-c — "respetar original" se refiere al master, no
        al preview admin). Las variants públicas (`card`, `hero`,
        `full`) usan `c_limit` que SÍ respeta el aspect ratio real;
        solo `thumbnail` y `og` aplican `c_fill` por su propósito
        específico (admin grid + Open Graph requieren tamaño fijo).
      */}
      <div className="relative aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-[var(--surface-sunken)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.thumbnailUrl}
          alt={image.altText ?? image.caption ?? "Imagen sin descripción"}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
        {image.isPrimary ? (
          <Badge
            variant="success"
            size="sm"
            className="absolute top-1.5 left-1.5"
          >
            Principal
          </Badge>
        ) : null}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Reordenar (arrastrá o usá las flechas)"
          className={cn(
            "absolute top-1.5 right-1.5 p-1 rounded-[var(--radius-sm)]",
            "bg-[var(--surface-overlay)]/80 text-[var(--text-on-overlay)]",
            "cursor-grab active:cursor-grabbing touch-none",
            "focus:outline-none focus-visible:shadow-[var(--shadow-focus)]",
            // M5: handle visible siempre en breakpoints táctiles (mobile
            // y tablet) — sin hover en touch, el affordance del drag se
            // perdía. Desktop (md+) mantiene el comportamiento original
            // de aparecer en hover/focus para no saturar el grid.
            "opacity-100 transition-opacity",
            "md:opacity-0 md:group-hover:opacity-100",
            "group-focus-within:opacity-100",
          )}
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <div className="flex flex-col gap-1 px-0.5">
        {image.caption ? (
          <p className="text-[var(--text-xs)] text-[var(--text-secondary)] line-clamp-2">
            {image.caption}
          </p>
        ) : (
          <p className="text-[var(--text-xs)] italic text-[var(--text-muted)]">
            Sin caption
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 pt-0.5">
        {!image.isPrimary ? (
          <button
            type="button"
            onClick={onSetPrimary}
            disabled={disabled}
            aria-label="Marcar como principal"
            className={cn(
              "p-1.5 rounded-[var(--radius-sm)]",
              "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "focus:outline-none focus-visible:shadow-[var(--shadow-focus)]",
            )}
            title="Marcar como principal"
          >
            <Star className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          aria-label="Editar caption y alt text"
          className={cn(
            "p-1.5 rounded-[var(--radius-sm)]",
            "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "focus:outline-none focus-visible:shadow-[var(--shadow-focus)]",
          )}
          title="Editar caption y alt text"
        >
          <Edit className="h-3.5 w-3.5" aria-hidden />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          aria-label="Eliminar imagen"
          className={cn(
            "p-1.5 rounded-[var(--radius-sm)]",
            "text-[var(--text-muted)] hover:text-[var(--danger-fg)] hover:bg-[var(--danger-bg)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "focus:outline-none focus-visible:shadow-[var(--shadow-focus)]",
          )}
          title="Eliminar"
        >
          <Trash className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </li>
  );
}
