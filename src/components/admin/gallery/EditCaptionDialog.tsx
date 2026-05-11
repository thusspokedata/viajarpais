"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from "@/components/ui";
import { updateImage } from "@/server/actions/images";
import type { EntityType } from "@/lib/images/dispatcher";
import type { GalleryImage } from "./SortableImageGrid";

/*
  Modal de edición de `caption` + `altText`. Se abre desde
  `<SortableImageCard />` al cliquear el botón de edit.

  Patrón:
  - `image === null` → modal cerrado.
  - `image` provisto → modal abierto, drafts inicializados con los
    valores actuales. Cancelar resetea; Guardar manda solo los campos
    que cambiaron.

  Convención de `caption` vs `altText`:
  - `caption`: descripción visible al usuario en el frontend (debajo
    de la imagen en hero/lightbox).
  - `altText`: accesibilidad y SEO (alt en `<img>`). Si está vacío, el
    fallback en el cliente usa `caption`.
*/

export type EditCaptionDialogProps = {
  image: GalleryImage | null;
  entityType: EntityType;
  open: boolean;
  onClose: () => void;
};

const MAX_CAPTION = 200;
const MAX_ALT = 200;

export function EditCaptionDialog({
  image,
  entityType,
  open,
  onClose,
}: EditCaptionDialogProps) {
  if (!image) return null;
  /*
    React 19 desaconseja accesos a `ref.current` durante render. En vez
    del pattern "useRef para trackear cambios de prop + setState
    condicional", aprovechamos `key={image.id}` para que el dialog
    interno se re-monte cada vez que el editor abre el modal sobre
    una imagen distinta. `useState` con función inicial pone los
    drafts en sus valores nuevos sin lógica de sincronización extra.
  */
  return (
    <EditCaptionDialogInner
      key={image.id}
      image={image}
      entityType={entityType}
      open={open}
      onClose={onClose}
    />
  );
}

type InnerProps = {
  image: GalleryImage;
  entityType: EntityType;
  open: boolean;
  onClose: () => void;
};

function EditCaptionDialogInner({
  image,
  entityType,
  open,
  onClose,
}: InnerProps) {
  const router = useRouter();
  const [caption, setCaption] = React.useState(image.caption ?? "");
  const [altText, setAltText] = React.useState(image.altText ?? "");
  const [submitting, startTransition] = React.useTransition();

  const captionChanged = (image.caption ?? "") !== caption;
  const altChanged = (image.altText ?? "") !== altText;
  const hasChanges = captionChanged || altChanged;

  function handleSave() {
    if (!image || !hasChanges) {
      onClose();
      return;
    }
    startTransition(async () => {
      const res = await updateImage({
        imageId: image.id,
        entityType,
        caption: captionChanged ? (caption.trim() === "" ? null : caption) : undefined,
        altText: altChanged ? (altText.trim() === "" ? null : altText) : undefined,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Cambios guardados.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar imagen</DialogTitle>
          <DialogDescription>
            El caption es el texto visible al usuario en la galería. El alt
            text es para accesibilidad y SEO; si lo dejás vacío se usa el
            caption como fallback.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-3">
          <label className="flex flex-col gap-1">
            <span className="text-[var(--text-xs)] font-display uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
              Caption
            </span>
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={MAX_CAPTION}
              placeholder="Atardecer en el Cerro de la Gloria"
            />
            <span className="text-[var(--text-xs)] text-[var(--text-muted)] self-end">
              {caption.length} / {MAX_CAPTION}
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[var(--text-xs)] font-display uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
              Alt text
            </span>
            <Textarea
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              maxLength={MAX_ALT}
              rows={3}
              placeholder="Vista panorámica del Cerro de la Gloria al atardecer, con la cordillera de los Andes al fondo."
            />
            <span className="text-[var(--text-xs)] text-[var(--text-muted)] self-end">
              {altText.length} / {MAX_ALT}
            </span>
          </label>
        </div>

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="secondary" disabled={submitting}>
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={submitting || !hasChanges}>
            {submitting ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
