-- v0.3-geo-c follow-up: partial unique constraints en `isPrimary = true`
-- por entity, para los 5 image models.
--
-- Hasta este commit, la garantía "exactamente una imagen primary por
-- entity" vivía SOLO en la server action `setImageAsPrimary` (que usa
-- una transacción para bajar todas y subir una). El comentario del
-- schema original lo declaraba "decisión cerrada — atomicity en server
-- action".
--
-- La auditoría interna de v0.3-geo-c demostró que esa garantía NO
-- aplica para el camino de auto-primary on first upload: en
-- `saveImageMetadata`, el chequeo `currentCount === 0` corre fuera
-- de transacción. Con pool de concurrencia 3 en el cliente
-- (`GalleryUploader.tsx`), tres uploads simultáneos en un entity vacío
-- pueden ver count=0 todos y crear N rows con `isPrimary=true`.
--
-- Fix definitivo: partial unique a nivel DB. Postgres rechaza la
-- segunda inserción con conflict (P2002). El server action lo cazará
-- y el cliente puede reintentar (el reintento ya verá count > 0 y
-- asignará isPrimary=false).
--
-- `setImageAsPrimary` sigue siendo necesario porque baja TODAS a
-- false antes de subir una a true — el constraint no permite "swap
-- atómico" sin esa secuencia. La transacción ya está implementada.

CREATE UNIQUE INDEX "RegionImage_regionId_primary_key"
  ON "RegionImage" ("regionId")
  WHERE "isPrimary" = true;

CREATE UNIQUE INDEX "ProvinceImage_provinceId_primary_key"
  ON "ProvinceImage" ("provinceId")
  WHERE "isPrimary" = true;

CREATE UNIQUE INDEX "DepartmentImage_departmentId_primary_key"
  ON "DepartmentImage" ("departmentId")
  WHERE "isPrimary" = true;

CREATE UNIQUE INDEX "LocalityImage_localityId_primary_key"
  ON "LocalityImage" ("localityId")
  WHERE "isPrimary" = true;

CREATE UNIQUE INDEX "ListingImage_listingId_primary_key"
  ON "ListingImage" ("listingId")
  WHERE "isPrimary" = true;
