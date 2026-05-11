"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Upload, AlertTriangle, Close } from "@/components/ui/icons";
import { cn } from "@/components/ui";
import {
  getUploadSignature,
  saveImageMetadata,
} from "@/server/actions/images";
import type { EntityType } from "@/lib/images/dispatcher";
import { SortableImageGrid, type GalleryImage } from "./SortableImageGrid";

/*
  `<GalleryUploader />` — componente cliente principal de la galería
  del admin. Single source of truth para subir, listar, reordenar,
  marcar primary, editar metadata y borrar imágenes de un entity.

  Flujo del upload:
  1. Editor arrastra archivos a la dropzone (o click → file picker).
  2. Validación cliente: MIME en {jpeg,png,webp}, tamaño <= 5MB, no
     exceder `maxImages`.
  3. Por cada archivo válido, pool de 3 paralelos:
     a. `getUploadSignature(entityType, entityId)` server action.
     b. POST a `https://api.cloudinary.com/v1_1/{cloud}/upload` con
        signature + file + preset.
     c. `saveImageMetadata(...)` server action persiste el row.
  4. Si Cloudinary OK pero saveMetadata falla → orphan en Cloudinary
     (documentado en AGENTS.md, cleanup job futuro).
  5. router.refresh() para que el grid muestre la nueva imagen.

  El grid (drag, primary, captions, delete) es responsabilidad de
  `<SortableImageGrid />`.
*/

export type GalleryUploaderProps = {
  entityType: EntityType;
  entityId: string;
  images: GalleryImage[];
  maxImages: number;
};

const ACCEPTED_MIME = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const UPLOAD_CONCURRENCY = 3;

type PendingStatus = "queued" | "uploading" | "saving" | "done" | "error";

type PendingUpload = {
  id: string; // local cuid, NO el de DB hasta saveMetadata
  filename: string;
  status: PendingStatus;
  errorMessage?: string;
};

export function GalleryUploader({
  entityType,
  entityId,
  images,
  maxImages,
}: GalleryUploaderProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<PendingUpload[]>([]);

  const slotsAvailable = Math.max(0, maxImages - images.length);
  const limitReached = slotsAvailable === 0;

  /*
    Helpers de upload declarados ANTES del `onDrop` para que la
    referencia desde el callback no sea "access-before-declared". TS
    hoistea pero el linter de React 19 quiere orden topográfico
    explícito.
  */

  function updatePending(id: string, status: PendingStatus, errorMessage?: string) {
    setPending((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status, errorMessage } : p)),
    );
  }
  function removePending(id: string) {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }

  async function runSingleUpload(file: File, p: PendingUpload) {
    updatePending(p.id, "uploading");

    // 1. Pedir signature al server.
    const sig = await getUploadSignature({ entityType, entityId });
    if (!sig.ok) {
      updatePending(p.id, "error", sig.message);
      toast.error(`"${p.filename}": ${sig.message}`);
      return;
    }

    // 2. Subir a Cloudinary directamente. Si falla, NO persistimos
    //    nada en DB.
    const form = new FormData();
    form.append("file", file);
    form.append("signature", sig.data.signature);
    form.append("timestamp", String(sig.data.timestamp));
    form.append("api_key", sig.data.apiKey);
    form.append("upload_preset", sig.data.uploadPreset);
    form.append("folder", sig.data.folder);

    let cloudinaryResult: { public_id: string };
    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.data.cloudName}/upload`,
        { method: "POST", body: form },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      cloudinaryResult = (await res.json()) as { public_id: string };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error subiendo a Cloudinary";
      updatePending(p.id, "error", message);
      toast.error(`"${p.filename}": ${message}`);
      return;
    }

    /*
      3. Persistir el row en DB. NO mandamos `url` — la server action
      la re-deriva server-side desde `cloudinaryPublicId` para
      defenderse contra URL injection (CodeRabbit/security audit
      cerró este vector en C1 de v0.3-geo-c).
    */
    updatePending(p.id, "saving");
    const saved = await saveImageMetadata({
      entityType,
      entityId,
      cloudinaryPublicId: cloudinaryResult.public_id,
    });
    if (!saved.ok) {
      updatePending(p.id, "error", saved.message);
      toast.error(`"${p.filename}": ${saved.message}`);
      // Orphan: la imagen ya está en Cloudinary pero no en DB. Cleanup
      // job futuro la barrerá — documentado en AGENTS.md.
      return;
    }

    updatePending(p.id, "done");
    // Remover del array de pendientes después de un breve delay para
    // que el editor vea el "Listo" antes de que desaparezca.
    setTimeout(() => removePending(p.id), 800);
  }

  async function uploadAll(files: File[], queued: PendingUpload[]) {
    /*
      Pool de concurrencia simple — corremos como mucho
      `UPLOAD_CONCURRENCY` uploads en paralelo. Sin librería: cada
      upload arranca al consumir un slot del pool y libera cuando
      termina. Para 3-15 archivos típicos del editor alcanza.

      Parámetro local renombrado `queued` para no shadow el state
      `pending` del componente.
    */
    await mapWithConcurrency(files, UPLOAD_CONCURRENCY, async (file, idx) => {
      const p = queued[idx];
      await runSingleUpload(file, p);
    });
    // Refresh para que el grid muestre las imágenes recién creadas.
    router.refresh();
  }

  const onDrop = React.useCallback(
    (accepted: File[], rejected: ReadonlyArray<{ file: File; errors: ReadonlyArray<{ code: string; message: string }> }>) => {
      /*
        `rejected` viene de `react-dropzone` cuando un archivo no
        matchea el `accept` o excede `maxSize`. Mostramos un toast por
        cada rechazo con la razón específica — el editor sabe qué
        archivo falló y por qué (en vez de un mensaje genérico).
      */
      for (const r of rejected) {
        const reason = r.errors[0]?.code;
        let message: string;
        switch (reason) {
          case "file-invalid-type":
            message = `"${r.file.name}": formato no soportado. Solo JPG, PNG o WebP.`;
            break;
          case "file-too-large":
            message = `"${r.file.name}": supera 5MB. Reducí el tamaño antes de subir.`;
            break;
          default:
            message = `"${r.file.name}": ${r.errors[0]?.message ?? "rechazado"}.`;
        }
        toast.error(message);
      }

      if (accepted.length === 0) return;

      // Trim al disponible. Si el editor arrastró más de los slots
      // libres, le decimos cuántos no van.
      let filesToUpload = accepted;
      if (accepted.length > slotsAvailable) {
        const dropped = accepted.length - slotsAvailable;
        filesToUpload = accepted.slice(0, slotsAvailable);
        toast.warning(
          `Máximo ${maxImages} imágenes para este nivel. ${dropped} archivo${dropped === 1 ? "" : "s"} no se subieron.`,
        );
      }

      const newPending: PendingUpload[] = filesToUpload.map((f) => ({
        id: cryptoRandomId(),
        filename: f.name,
        status: "queued",
      }));
      setPending((prev) => [...prev, ...newPending]);

      void uploadAll(filesToUpload, newPending);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entityType, entityId, slotsAvailable, maxImages],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_MIME,
    maxSize: MAX_FILE_SIZE_BYTES,
    multiple: true,
    disabled: limitReached,
  });

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="font-display text-[var(--text-lg)] font-semibold text-[var(--text-primary)]">
          Imágenes
        </h2>
        <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">
          {images.length} / {maxImages} cargadas · arrastrá archivos o hacé
          click para seleccionar. Formatos: JPG, PNG, WebP. Máx 5MB por
          archivo.
        </p>
      </header>

      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 px-6 py-10",
          "rounded-[var(--radius-lg)] border-2 border-dashed",
          "transition-colors cursor-pointer",
          "focus:outline-none focus-visible:shadow-[var(--shadow-focus)]",
          limitReached
            ? "border-[var(--border-subtle)] bg-[var(--surface-sunken)]/30 cursor-not-allowed"
            : isDragActive
              ? "border-[var(--accent-fg)] bg-[var(--accent-bg)]/30"
              : "border-[var(--border-subtle)] hover:border-[var(--accent-fg)] bg-[var(--surface-base)]",
        )}
      >
        <input {...getInputProps()} />
        {limitReached ? (
          <>
            <AlertTriangle className="h-6 w-6 text-[var(--text-muted)]" aria-hidden />
            <p className="text-[var(--text-sm)] text-[var(--text-muted)] text-center">
              Alcanzaste el máximo de {maxImages} imágenes. Borrá alguna para
              subir nuevas.
            </p>
          </>
        ) : (
          <>
            <Upload
              className={cn(
                "h-6 w-6",
                isDragActive
                  ? "text-[var(--accent-fg)]"
                  : "text-[var(--text-muted)]",
              )}
              aria-hidden
            />
            <p className="text-[var(--text-sm)] text-[var(--text-secondary)] text-center">
              {isDragActive
                ? "Soltá los archivos para empezar"
                : "Arrastrá archivos acá o hacé click para abrir el selector"}
            </p>
          </>
        )}
      </div>

      {pending.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {pending.map((p) => (
            <li
              key={p.id}
              className={cn(
                "flex items-center justify-between gap-2 px-3 py-2 rounded-[var(--radius-md)] text-[var(--text-sm)]",
                p.status === "error"
                  ? "border border-[var(--danger-fg)]/40 bg-[var(--danger-bg)] text-[var(--danger-fg)]"
                  : p.status === "done"
                    ? "border border-[var(--success-fg)]/30 bg-[var(--success-bg)] text-[var(--success-fg)]"
                    : "border border-[var(--border-subtle)] bg-[var(--surface-sunken)] text-[var(--text-secondary)]",
              )}
            >
              <span className="truncate">
                <span className="font-medium">{p.filename}</span>{" "}
                <span className="text-[var(--text-xs)]">
                  · {labelForStatus(p.status)}
                  {p.errorMessage ? ` — ${p.errorMessage}` : ""}
                </span>
              </span>
              {p.status === "error" ? (
                <button
                  type="button"
                  onClick={() => removePending(p.id)}
                  className="text-[var(--danger-fg)] hover:opacity-80"
                  aria-label="Descartar mensaje"
                >
                  <Close className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <SortableImageGrid
        entityType={entityType}
        entityId={entityId}
        images={images}
      />
    </section>
  );
}

function labelForStatus(s: PendingStatus): string {
  switch (s) {
    case "queued":
      return "en cola";
    case "uploading":
      return "subiendo a Cloudinary";
    case "saving":
      return "guardando metadatos";
    case "done":
      return "listo ✓";
    case "error":
      return "error";
  }
}

/**
 * Devuelve un ID local pseudo-único para tracking de uploads en flight.
 * NO se persiste en DB — el ID real lo asigna `saveImageMetadata`.
 * Usamos `crypto.randomUUID()` si está disponible (todos los browsers
 * modernos + Node 19+), fallback a `Math.random` por seguridad.
 */
function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Pool de concurrencia. Corre como mucho `concurrency` promesas en
 * paralelo; cuando una termina, arranca la siguiente. Mantiene el
 * orden de resultados via índices, pero acá no usamos el return value.
 *
 * Para 3-15 uploads concurrentes típicos del editor:
 * - concurrency=3 satura el bandwidth típico sin overhead.
 * - concurrency>3 no mejora throughput (limitado por el upload del
 *   usuario, no por Cloudinary).
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const executing = new Set<Promise<unknown>>();

  for (let i = 0; i < items.length; i++) {
    const idx = i;
    const p = fn(items[idx], idx).then((r) => {
      results[idx] = r;
    });
    executing.add(p);
    void p.finally(() => executing.delete(p));

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
  return results;
}
