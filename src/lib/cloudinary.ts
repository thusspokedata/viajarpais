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

/*
  Variants de transformación nombrados — preset declarativo de los
  tamaños/crops que usa el frontend. Centralizado para que la decisión
  de "qué transformación corresponde a qué contexto" viva en un solo
  lugar y se pueda evolucionar (e.g. agregar AVIF prefetch) sin tocar
  el sitio del consumer.

  Todos incluyen `f_auto,q_auto` — Cloudinary decide formato y calidad
  según el navegador del usuario (AVIF/WebP/JPEG fallback, calidad
  adaptativa según ancho de banda detectado).
*/
const CLOUDINARY_VARIANTS = {
  /**
   * Sin transformación — el master tal cual se subió. Lo usamos para
   * la columna `url` que se persiste server-side desde el `publicId`:
   * el cliente NO controla este campo (defense in depth contra
   * arbitrary URL injection).
   */
  original: "",
  thumbnail: "c_fill,w_200,h_200,f_auto,q_auto",
  card: "c_fill,w_600,h_400,f_auto,q_auto",
  hero: "c_limit,w_1920,h_1080,f_auto,q_auto",
  full: "c_limit,w_2400,f_auto,q_auto",
  og: "c_fill,w_1200,h_630,f_auto,q_auto",
} as const;

export type CloudinaryVariant = keyof typeof CLOUDINARY_VARIANTS;

/**
 * Construye el URL público de un asset con una transformación
 * pre-definida. String-building puro — no hace request a Cloudinary.
 *
 * Usar `cloudinaryUrl(publicId, "thumbnail")` para grids del admin,
 * `"card"` para listings públicos, `"hero"` para hero images,
 * `"full"` para lightbox/zoom, `"og"` para Open Graph.
 *
 * El `cloud_name` lo lee de la config inicializada en module-load
 * (que extrajo el dato de `CLOUDINARY_URL`). Si quisiéramos servir
 * desde un CDN custom (e.g. `cdn.viajarpais.com.ar` con CNAME a
 * Cloudinary), se cambia esta función — el consumer no se entera.
 */
export function cloudinaryUrl(
  publicId: string,
  variant: CloudinaryVariant,
): string {
  const cloudName = cloudinary.config().cloud_name;
  if (!cloudName) {
    // Defensa: no debería pasar porque el module-load ya validó
    // CLOUDINARY_URL, pero TS no puede inferir que `cloud_name` esté
    // siempre seteado después del config sin assertion.
    throw new Error("cloudinary.config().cloud_name not set");
  }
  const transformation = CLOUDINARY_VARIANTS[variant];
  // Para `original`, omitimos el segmento de transformación —
  // `image/upload/{publicId}` directamente sirve el master.
  const path = transformation
    ? `${transformation}/${publicId}`
    : publicId;
  return `https://res.cloudinary.com/${cloudName}/image/upload/${path}`;
}

/**
 * Helper para servidor-side: devuelve el `cloud_name` configurado.
 * Útil para construir URLs sin pasar por `cloudinaryUrl` (e.g. cuando
 * se valida que un URL pertenece a nuestra cuenta).
 */
export function getCloudName(): string {
  const cloudName = cloudinary.config().cloud_name;
  if (!cloudName) {
    throw new Error("cloudinary.config().cloud_name not set");
  }
  return cloudName;
}

export type UploadSignatureResult = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  uploadPreset: string;
  folder: string;
  /**
   * Nonce único single-use generado server-side. El cliente debe
   * incluirlo en el FormData del upload a Cloudinary (queda firmado
   * dentro de la signature) y enviarlo a `saveImageMetadata` para
   * que el server lo marque como usado. Sin esto, un atacante con
   * la signature cacheada puede subir N archivos al folder firmado
   * durante la ventana de validez (1h).
   */
  nonce: string;
};

/**
 * Genera una signature firmada server-side para que el cliente pueda
 * hacer upload directo a Cloudinary sin pasar el binario por nuestro
 * servidor. Patrón canónico de Cloudinary para uploads desde browser.
 *
 * Flujo (server action que invoca esto + cliente):
 *
 * 1. Cliente solicita signature via server action que llama a esto.
 * 2. Cliente hace `POST https://api.cloudinary.com/v1_1/{cloud_name}
 *    /upload` con `FormData` que incluye file + timestamp + signature
 *    + api_key + upload_preset + folder.
 * 3. Cloudinary verifica la signature y procesa el upload.
 * 4. Cloudinary responde con `{ public_id, secure_url, width, height,
 *    bytes, format }`.
 * 5. Cliente llama a otra server action para persistir el row en DB.
 *
 * El preset debe estar configurado en el dashboard de Cloudinary con
 * `Signing Mode = Signed` — eso aplica restricciones server-side de
 * Cloudinary (formatos permitidos, tamaño max, folder, etc.) además
 * de las validaciones de cliente.
 *
 * La signature firma SOLO `{ timestamp, folder, upload_preset }` —
 * cualquier otro parámetro que el cliente intente agregar (e.g. otro
 * `upload_preset` o folder distinto) hace que Cloudinary rechace por
 * mismatch.
 *
 * Trade-off de orphans: si el cliente termina exitoso el paso 2-3 pero
 * cierra el browser antes del paso 5, queda una foto en Cloudinary
 * sin row de DB (orphan). Documentado en AGENTS.md como deuda; cleanup
 * job futuro.
 */
export async function getUploadSignature(
  folder: string,
  nonce: string,
): Promise<UploadSignatureResult> {
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!uploadPreset) {
    throw new Error(
      "CLOUDINARY_UPLOAD_PRESET no está configurado. Ver AGENTS.md.",
    );
  }
  const config = cloudinary.config();
  const cloudName = config.cloud_name;
  const apiKey = config.api_key;
  const apiSecret = config.api_secret;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "cloudinary.config() incompleta — verificar CLOUDINARY_URL.",
    );
  }

  // Cloudinary recomienda timestamps en segundos. Una signature solo
  // es válida por ~1 hora desde su timestamp (el usuario también
  // baja `timestamp_validity` del preset a 120s en el dashboard).
  const timestamp = Math.floor(Date.now() / 1000);

  /*
    Firmamos `nonce` como parámetro custom. Cloudinary verifica que
    todos los parámetros del FormData del cliente coinciden con la
    signature. Esto sirve dos propósitos:
    - Cliente no puede manipular el nonce que envía a Cloudinary sin
      invalidar la signature.
    - El nonce queda asociado server-side al upload Cloudinary que
      `saveImageMetadata` después va a validar.
  */
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder,
      upload_preset: uploadPreset,
      nonce,
    },
    apiSecret,
  );

  return {
    signature,
    timestamp,
    apiKey,
    cloudName,
    uploadPreset,
    folder,
    nonce,
  };
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
