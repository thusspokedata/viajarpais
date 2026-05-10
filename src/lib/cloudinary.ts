import "server-only";
import { v2 as cloudinary, type UploadApiOptions } from "cloudinary";

/*
  Helper server-only para Cloudinary. Usado por server actions del admin
  geo (delete de imagenes en v0.3-geo-a) y por el upload firmado del
  cliente (v0.3-geo-c).

  Inicialización: el SDK detecta `CLOUDINARY_URL` automáticamente. La
  llamada a `cloudinary.config({ secure: true })` fuerza HTTPS en URLs
  generadas y dispara la lectura del env eagerly.
*/
if (!process.env.CLOUDINARY_URL) {
  throw new Error("CLOUDINARY_URL is not set");
}

cloudinary.config({ secure: true });

export type DeleteResult = { ok: boolean; alreadyDeleted?: boolean };

/**
 * Borra un asset de Cloudinary. Idempotente: si el asset ya no existe,
 * Cloudinary devuelve `{ result: "not found" }` y reportamos
 * `alreadyDeleted: true` (no es error).
 *
 * `invalidate: true` purga el cache del CDN — sin esto, el URL viejo
 * podría seguir sirviéndose desde Akamai/Fastly por horas.
 */
export async function deleteAsset(publicId: string): Promise<DeleteResult> {
  try {
    const res = await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: "image",
    });
    if (res.result === "ok") return { ok: true };
    if (res.result === "not found") return { ok: true, alreadyDeleted: true };
    return { ok: false };
  } catch (err) {
    console.error("[cloudinary.deleteAsset]", publicId, err);
    return { ok: false };
  }
}

export type BuildUrlTransforms = {
  width?: number;
  height?: number;
  crop?: "fill" | "fit" | "scale" | "thumb";
  quality?: "auto" | number;
  format?: "auto" | "webp" | "avif" | "jpg";
};

/**
 * Construye el URL público de un asset con transformaciones opcionales.
 * Es string-building puro (no hace request a Cloudinary).
 *
 * Defaults razonables para thumbs admin: `q_auto` + `f_auto` (Cloudinary
 * decide formato y calidad según el navegador) + `c_fill` para preservar
 * aspect ratio.
 */
export function buildUrl(publicId: string, t: BuildUrlTransforms = {}): string {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      {
        width: t.width,
        height: t.height,
        crop: t.crop ?? "fill",
        quality: t.quality ?? "auto",
        fetch_format: t.format ?? "auto",
      },
    ],
  });
}

export type UploadFromUrlOptions = {
  folder: string;
  publicId?: string;
  tags?: string[];
};

export type UploadFromUrlResult = {
  publicId: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
};

/**
 * Sube una imagen a Cloudinary tomando el binario desde un URL externo.
 * Cloudinary fetcha la imagen desde sus servers (no consume bandwidth
 * del nuestro).
 *
 * En v0.3-geo-a esta función está disponible pero no se invoca desde
 * ningún lado — la UI de upload llega en v0.3-geo-c. La incluimos ahora
 * para tener la firma estable y poder probar la conexión con
 * `CLOUDINARY_URL` apenas se configure el endpoint.
 */
export async function uploadFromUrl(
  url: string,
  options: UploadFromUrlOptions,
): Promise<UploadFromUrlResult> {
  const opts: UploadApiOptions = {
    folder: options.folder,
    public_id: options.publicId,
    tags: options.tags,
    resource_type: "image",
    overwrite: false,
  };
  const res = await cloudinary.uploader.upload(url, opts);
  return {
    publicId: res.public_id,
    url: res.secure_url,
    width: res.width,
    height: res.height,
    format: res.format,
    bytes: res.bytes,
  };
}
