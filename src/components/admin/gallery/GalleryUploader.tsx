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

  Flujo del upload (defensas post-audit interno + CodeRabbit aplicadas):
  1. Editor arrastra archivos a la dropzone (o click → file picker).
  2. Validación cliente: MIME en {jpeg,png,webp}, tamaño <= 5MB, no
     exceder `maxImages` contando IN-FLIGHT (CR#2).
  3. Por cada archivo válido, pool de 3 paralelos con
     `mapWithConcurrency` que NUNCA propaga rejection (M-C).
  4. Por upload:
     a. `getUploadSignature(...)` → server genera nonce single-use,
        lo persiste en DB, lo firma con la signature Cloudinary (H-1).
     b. POST a `https://api.cloudinary.com/v1_1/{cloud}/upload` con
        signature + file + nonce + preset, con `AbortController`
        timeout 60s (MAJ-1).
     c. `saveImageMetadata({..., nonce})` → server marca nonce como
        usado atómicamente + verifica que el asset realmente existe
        en Cloudinary (M-3).
  5. router.refresh() para que el grid muestre la nueva imagen.

  Tab close protection:
  - `beforeunload` listener activo mientras hay uploads en flight
    (MAJ-2). El editor ve diálogo del navegador antes de cerrar.

  Try/catch global en `runSingleUpload` (CR#3) — cualquier excepción
  no manejada cae en el catch externo y emite toast + error state.
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

/** Timeout para el fetch a Cloudinary. 60s cubre uploads ≤5MB hasta
 *  con conexiones lentas; conexiones más lentas que eso son edge case
 *  donde el editor probablemente prefiere un error claro a esperar
 *  indefinidamente. (MAJ-1) */
const UPLOAD_TIMEOUT_MS = 60_000;

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

  /*
    CR#2 + N3: in-flight uploads cuentan contra `maxImages`.

    Versión inicial (CR#2): `pending.filter(p => p.status !== "done"
    && p.status !== "error")`. Esto dejaba una ventana de race: un
    upload pasaba a `"done"` y "libera" su slot ANTES de que el
    `router.refresh()` post-batch repropague `images` con el nuevo
    row. Durante esa ventana (puede ser varios segundos si quedan
    uploads grandes en el batch), `slotsAvailable` sobre-estima y un
    drop concurrente del editor sobre-admite → orphan en Cloudinary.

    Fix N3 (CodeRabbit 3a pasada): contar `done` también como
    in-flight. El row sigue ocupando slot hasta que el
    `setTimeout(removePending, 800)` (línea ~215) lo saca. Como
    `router.refresh()` es sub-segundo cuando Vercel anda bien,
    típicamente el refresh con `images` actualizado llega ANTES que
    el timeout — el slot se libera con el server reflejando ya el
    nuevo row.

    Trade-off aceptado: ~800ms post-batch exitoso de "no available
    slots" momentáneo, vs el path del orphan que sería peor (uploads
    rebotando en server con cuota Cloudinary drenada). Sub-estimar
    slots es safe; sobre-estimar no.
  */
  const inFlightCount = pending.filter((p) => p.status !== "error").length;
  const slotsAvailable = Math.max(
    0,
    maxImages - images.length - inFlightCount,
  );
  const limitReached = slotsAvailable === 0;

  /*
    MAJ-2: warning del browser cuando el editor intenta cerrar tab o
    navegar mientras hay uploads en flight. El `event.preventDefault()`
    + `returnValue = ""` activa el diálogo "¿Querés salir de esta
    página?" que es la convención de Gmail/Docs/WP.
  */
  React.useEffect(() => {
    if (inFlightCount === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [inFlightCount]);

  function updatePending(id: string, status: PendingStatus, errorMessage?: string) {
    setPending((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status, errorMessage } : p)),
    );
  }
  function removePending(id: string) {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }

  async function runSingleUpload(file: File, p: PendingUpload) {
    /*
      CR#3 fix: try/catch global captura excepciones inesperadas en
      cualquier punto del flujo (server action que tira, JSON.parse,
      bug interno). Sin esto, una rejection no manejada propagaba al
      pool y abortaba el batch — `mapWithConcurrency` también está
      defendido (M-C) pero esta capa es la primera línea.
    */
    try {
      updatePending(p.id, "uploading");

      // 1. Pedir signature al server. Server crea nonce + lo persiste.
      const sig = await getUploadSignature({ entityType, entityId });
      if (!sig.ok) {
        updatePending(p.id, "error", sig.message);
        toast.error(`"${p.filename}": ${sig.message}`);
        return;
      }

      // 2. Subir a Cloudinary directamente.
      const form = new FormData();
      form.append("file", file);
      form.append("signature", sig.data.signature);
      form.append("timestamp", String(sig.data.timestamp));
      form.append("api_key", sig.data.apiKey);
      form.append("upload_preset", sig.data.uploadPreset);
      form.append("folder", sig.data.folder);
      // H-1: el nonce viaja como param firmado. Cloudinary lo verifica
      // con la signature server-side y rechaza si está manipulado.
      form.append("nonce", sig.data.nonce);

      /*
        MAJ-1: AbortController con timeout. Sin esto, una conexión
        TCP colgada bloquea el slot del pool indefinidamente — los
        archivos en queue quedan en "queued" forever y `router.refresh`
        nunca corre. 60s es generoso para 5MB con WiFi débil; lo más
        rápido posible para conexión muerta de verdad.
      */
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        UPLOAD_TIMEOUT_MS,
      );

      let cloudinaryResult: { public_id: string };
      try {
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${sig.data.cloudName}/upload`,
          { method: "POST", body: form, signal: controller.signal },
        );
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }
        cloudinaryResult = (await res.json()) as { public_id: string };
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          const message = "Timeout — la conexión es muy lenta. Reintentá.";
          updatePending(p.id, "error", message);
          toast.error(`"${p.filename}": ${message}`);
          return;
        }
        const message =
          err instanceof Error ? err.message : "Error subiendo a Cloudinary";
        updatePending(p.id, "error", message);
        toast.error(`"${p.filename}": ${message}`);
        return;
      } finally {
        clearTimeout(timeoutId);
      }

      /*
        3. Persistir el row en DB. NO mandamos `url` — la server
        action la re-deriva server-side desde `cloudinaryPublicId`
        (security audit C1). Mandamos el `nonce` para que el server
        lo marque como usado atómicamente (H-1) + valide que el asset
        realmente existe en Cloudinary via `cloudinary.api.resource`
        (M-3).
      */
      updatePending(p.id, "saving");
      const saved = await saveImageMetadata({
        entityType,
        entityId,
        cloudinaryPublicId: cloudinaryResult.public_id,
        nonce: sig.data.nonce,
      });
      if (!saved.ok) {
        updatePending(p.id, "error", saved.message);
        toast.error(`"${p.filename}": ${saved.message}`);
        return;
      }

      updatePending(p.id, "done");
      setTimeout(() => removePending(p.id), 800);
    } catch (err) {
      // Catch global de defense in depth — si un await dentro tira
      // algo no contemplado (e.g. fetch interno, parser), no rompemos
      // el pool. Solo el item actual queda en "error".
      const message =
        err instanceof Error
          ? err.message
          : "Error inesperado durante la subida.";
      updatePending(p.id, "error", message);
      toast.error(`"${p.filename}": ${message}`);
    }
  }

  async function uploadAll(files: File[], queued: PendingUpload[]) {
    /*
      Pool de concurrencia simple — corremos como mucho
      `UPLOAD_CONCURRENCY` uploads en paralelo. `mapWithConcurrency`
      garantiza que rejections individuales NO aborten el pool (M-C).
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
 * paralelo; cuando una termina, arranca la siguiente.
 *
 * M-C fix (CodeRabbit extiende CR#3): la promesa interna NUNCA
 * rechaza. Si la función `fn` provista rejecta, se atrapa con
 * `.catch` y se almacena el error en el slot — el pool sigue
 * procesando los items restantes. Sin esta defensa, una rejection
 * llegaba a `Promise.race(executing)` y abortaba el for loop, dejando
 * archivos sin procesar.
 *
 * El caller no inspecciona el return value en el uso actual (los
 * resultados se reflejan via `setPending` adentro de `fn`). El tipo
 * de return incluye `{error}` para que future callers puedan
 * inspeccionar si lo necesitan.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<Array<R | { error: unknown }>> {
  const results: Array<R | { error: unknown }> = new Array(items.length);
  const executing = new Set<Promise<unknown>>();

  for (let i = 0; i < items.length; i++) {
    const idx = i;
    const p = fn(items[idx], idx)
      .then((r) => {
        results[idx] = r;
      })
      .catch((err: unknown) => {
        // Nunca propagamos rejection al pool. El error queda
        // visible en el slot del array para que el caller pueda
        // inspeccionarlo si lo necesita.
        results[idx] = { error: err };
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
