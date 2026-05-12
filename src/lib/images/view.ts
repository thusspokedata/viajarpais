import "server-only";
import { cloudinaryUrl } from "@/lib/cloudinary";
import type { ImageRow } from "./dispatcher";
import type { GalleryImage } from "@/components/admin/gallery/SortableImageGrid";

/*
  Helper que mapea un row de cualquier modelo de imagen (RegionImage,
  ProvinceImage, ...) al shape `GalleryImage` que consume el client
  component. Pre-construye `thumbnailUrl` server-side porque
  `cloudinaryUrl` es server-only.

  El order de salida es por `order ASC` — usar `findMany` con
  `orderBy: { order: "asc" }` en el caller. Acá no reordenamos.
*/
export function imagesToGalleryView(images: ImageRow[]): GalleryImage[] {
  return images.map((img) => ({
    id: img.id,
    cloudinaryPublicId: img.cloudinaryPublicId,
    url: img.url,
    thumbnailUrl: cloudinaryUrl(img.cloudinaryPublicId, "thumbnail"),
    caption: img.caption,
    altText: img.altText,
    order: img.order,
    isPrimary: img.isPrimary,
  }));
}
