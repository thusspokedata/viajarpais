<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Convenciones para agentes (Claude Code, Claude design)

Este archivo es la fuente de verdad de las convenciones del proyecto ViajarPaís.
Cualquier agente trabajando en el repo debe leerlo al inicio de cada sesión y
respetar estas reglas sin excepción.

## Workflow de trabajo en el repo

- **NO usar git worktrees.** Trabajá directo en el repo principal con `git checkout`.
  Si necesitás estar en una branch distinta a la del usuario, coordiná en chat —
  no bifurques el filesystem. La razón es la experiencia del usuario, no técnica.
- Una branch por tarea. Naming: `feature/<scope>-<descripción>`,
  `fix/<scope>-<descripción>`, `chore/<descripción>`.
- Conventional Commits estricto. Scopes esperados: `admin`, `public`, `db`, `auth`,
  `geo`, `i18n`, `ci`, `infra`, `deps`, `repo`, `ui`.
- Commits granulares — no un commit gigante final.
- Firmar commits con `-S` (el usuario tiene Bitwarden configurado para eso).
- **NUNCA** agregar `Co-Authored-By: Claude` al commit.
- Squash merge contra `main` con linear history forzada.
- PRs contra `main` siempre — `main` está protegida.
- NO mergees vos los PRs — el usuario revisa y mergea.

## Stack del proyecto

- Next.js 16 (App Router) con `src/`
- TypeScript estricto
- Tailwind v4 con `@theme inline` en `src/app/globals.css`
- React 19.2
- next-intl 4 (locales: `es` default sin prefijo, `en`, `pt-BR`)
- Better Auth + Prisma 7 + Neon (branch dev en region Frankfurt)
- Radix Primitives + Tailwind v4 custom (NO shadcn)
- Tipografía: Fraunces (display) + Inter (body) via `next/font/google`

## Manejo de paquetes

- **npm únicamente.** No usar pnpm, yarn ni bun. El lockfile es `package-lock.json`.
- Si listás comandos en docs o mensajes, usá `npm install` / `npm run X`.

## Archivos sensibles que NO se rompen

- `src/app/[locale]/layout.tsx`: tiene lógica de next-intl
  (`NextIntlClientProvider`, `setRequestLocale`, validación con `hasLocale`).
  Solo se agrega cosa, nunca se reescribe la estructura existente.
- `src/lib/db.ts`: tiene `import "server-only"`. NO lo importes desde scripts CLI
  (seed, fetchers). Para CLI, instanciar cliente Prisma local con disconnect
  garantizado.
- `src/lib/auth.ts`: idem, runtime de Next. Para uso CLI, replicar inicialización
  local.
- `prisma/schema.prisma`: cambios al schema requieren migración explícita y
  revisión.

## Internacionalización

- Tres idiomas: `es` (default sin prefijo URL), `en`, `pt-BR`.
- `pt-BR` es case-sensitive en URL.
- Toda string visible al usuario va a `messages/{locale}.json`. NO hardcodear
  textos en componentes salvo placeholders explícitos para diseño.
- Topónimos NO se traducen. Mendoza es Mendoza en cualquier idioma.

## Privacidad y seguridad

- Nunca commitear secretos. Push protection está activado en GitHub.
- Variables sensibles SOLO en `.env.local` (gitignored). `.env.example` versionado
  con valores vacíos.
- Validar variables críticas con fail-fast en producción (ej. `trustedOrigins`).

## Calidad de código

- Lint y typecheck deben pasar antes de cada commit (pre-commit hook + CI).
- CI corre lint + typecheck + build en cada PR.
- CodeRabbit revisa cada PR — leer sus comentarios antes de mergear.
- CodeQL escanea código en cada push.

## Git ignore importante

- `src/generated/` — código autogenerado de Prisma, NO commitear.
- `.env*.local` — secretos.
- `.claude/` — workspace de Claude Code, NO commitear.
- `.next/` — build output.

## Cuando recomiendes subagentes

- Solo proponelos cuando agreguen valor real (research de APIs cambiantes,
  validación de versiones, áreas con poca documentación pública).
- Máximo 3-4 por tarea. Más es señal de sobre-diseño.
- Cuando el usuario use shadcn-style copy-paste (ej. trayendo un componente
  específico de shadcn al repo de Radix custom), está OK — no es contradicción
  con "no shadcn", es importar piezas puntuales.

## Decisiones cerradas que no se reabren

- Slugs de regiones: `cuyo`, `noa`, `nea`, `centro`, `pampeana`, `patagonia`.
- Slug de CABA: `caba` (no `ciudad-de-buenos-aires`).
- **URLs públicas — 4 niveles geo** (revisado v0.4-a, reemplaza la
  decisión original de 2 niveles): las URLs públicas usan **los 4
  niveles geográficos** `/{region}/{province}/{department}/{locality}`.
  El cambio se hizo porque Claude Design diseñó 4 páginas
  geográficas en el handoff de v0.4-a y producto confirmó que vale
  el costo extra de URLs más largas + el SEO con `BreadcrumbList` +
  `AdministrativeArea` JSON-LD. Department ahora tiene página propia
  con contenido editorial cargable desde admin — no es solo un
  nivel intermedio en DB.
  - Region: `code` (e.g. `/cuyo`).
  - Province/Department/Locality: `slug` (e.g. `/cuyo/mendoza/las-heras/uspallata`).
  - Las páginas resuelven la cadena completa para evitar URLs
    ambiguas (department.slug es `@@unique([provinceId, slug])`, no
    global; locality.slug también).
- Mapeo provincia → región: ver `prisma/seed.ts`.
- Filtro de localidades de Georef: incluir `Localidad simple`,
  `Localidad compuesta`, `Componente de localidad compuesta`. Excluir `Entidad`.
- Slug colisiones de localidades: fail-fast con detalle, no auto-resolver con
  sufijo numérico. Override manual via `LOCALITY_SLUG_OVERRIDES` cuando haga
  falta.
- **Slug de Listings**: vacío en form → autogenera de `name`; si colisiona,
  agrega sufijo de localidad (`cabanas-don-pedro` → `cabanas-don-pedro-uspallata`);
  si la versión con localidad también colisiona, fail explícito (editor escribe
  a mano). Editor escribe a mano → valida formato + unicidad, NO autogenera
  alternativa.
- **Listing crítico para re-verificación**: el cambio de `name`, `address`,
  `provinceId`, `departmentId`, `localityId` o `categories` en una ficha
  verificada resetea `verifiedAt` y `verifiedUntil` pero **preserva
  `verifiedById`** — el banner de re-verificación se dispara via
  `verifiedById !== null && verifiedAt === null`.
- **`Listing.createdById ON DELETE RESTRICT`**: borrar un usuario que creó
  fichas requiere reasignación previa de las fichas a otro user. Hoy NO existe
  UI ni server action para reasignar; hasta que exista una `reassignListings`,
  el cleanup de cuentas se hace via SQL manual. Decisión consciente para
  preservar autoría editorial.
- **Cloudinary cleanup en hard-delete de Listing**: cuando se implemente
  `hardDeleteListing` (v0.2.b o posterior), ANTES del `prisma.listing.delete()`
  hay que iterar `ListingImage.cloudinaryPublicId` y llamar
  `cloudinary.uploader.destroy()` por cada uno. La cascade de Prisma borra los
  rows pero los assets en el CDN quedan huérfanos. Hay un TODO inline en
  `src/server/actions/listings/lifecycle.ts` apuntando acá.
- **v0.2.a NO es infraestructura durmiente**: el CRUD de fichas es un sistema
  activo conectado al contenido geográfico. Las páginas de localidad listan
  fichas adentro y las fichas linkean a sus padres geográficos vía
  breadcrumbs. Bugs en v0.2.a se pisan al renderizar contenido público.

## i18n del contenido editorial (roadmap, NO implementado todavía)

El admin UI queda en `es` por defecto. Pero el **contenido** que el editor
carga (descripción de listings, regiones, provincias, departamentos,
localidades, meta description) sí se traduce a `en` y `pt-BR` con el
siguiente flow:

- **Modelo**: traducción automática al guardar con DeepL.
- **Fuente de verdad**: `es` siempre. NO detección automática, NO permitir
  elegir otro idioma de origen.
- **Flujo**: el editor escribe en español. Al guardar (create o update), el
  server action dispara DeepL síncrono (1-3 segundos). Las 3 versiones se
  guardan en DB. Botón "Guardar" muestra estado loading "Guardando y
  generando traducciones…".
- **Si DeepL falla**: el guardado en español sí se completa, las traducciones
  quedan en estado `NONE`, y aparece toast amarillo + warning en el admin
  para reintentar.
- **Re-edición del español**: las traducciones automáticas se regeneran,
  excepto las marcadas `REVIEWED` que se preservan con banner "el texto base
  cambió desde la última revisión".

### Schema previsto (a aplicar a `Listing`, `Region`, `Province`, `Department`, `Locality` cuando llegue el PR)

```prisma
enum TranslationSource {
  NONE        // sin traducir todavía
  MACHINE     // generada por DeepL
  REVIEWED    // generada por DeepL pero validada por un editor
  HUMAN       // editor escribió manualmente (caso futuro)
}

descriptionEs               String                                  // fuente de verdad
descriptionEn               String?
descriptionPtBr             String?
descriptionEnSource         TranslationSource @default(NONE)
descriptionPtBrSource       TranslationSource @default(NONE)
descriptionEnTranslatedAt   DateTime?
descriptionPtBrTranslatedAt DateTime?
```

Mismo patrón para `metaDescription`. Otros campos (`name`, `address`,
contacto, redes) NO se traducen — son topónimos o datos puros.

### Manejo de cuota DeepL

- DeepL Free Plan: 500k caracteres/mes. API key en `.env.local` como
  `DEEPL_API_KEY`. Endpoint detectado por sufijo `:fx` (free) vs no-sufijo
  (pro).
- Tabla `TranslationUsage` con caracteres consumidos por mes.
- Al **80%**: alerta por email vía Resend (`RESEND_API_KEY`).
- Al **100%**: traducciones se pausan, las fichas nuevas guardan solo en
  español con flag `pending_quota_exceeded`, banner global en admin.

Variables de entorno previstas (ya en `.env.example` con valor vacío):
`DEEPL_API_KEY`, `RESEND_API_KEY`.

## Sanitización de Markdown del editor — APLICADO en v0.4-a

Aplicado en el commit `feat(ui): editorialContent con react-markdown
sanitizado` (PR v0.4-a). Lib elegida: **`react-markdown` +
`rehype-sanitize`** (descartado el path original `marked` +
`DOMPurify` porque agregaba un paso por HTML intermedio innecesario).

Implementación:
- `EditorialContent` (`src/components/public/EditorialContent.tsx`)
  renderiza `descriptionEs/En/PtBr` con un schema explícito de
  `rehype-sanitize` aplicado sobre el AST hast — ANTES del render
  React. Sin paso por HTML stringificado.
- Schema strictly allowlist: `p, h1, h2, h3, ul, ol, li, a, strong,
  em, blockquote, br, hr`. Atributos en `<a>`: solo `href`, `title`,
  `rel` (allowlist `nofollow|noopener|noreferrer`) y `target`
  (allowlist `_blank`). Protocolos `href`: `http`, `https`, `mailto`.
- Helper `markdownToPlainText` en `src/lib/public/sanitizeMarkdown.ts`
  para extraer plain-text de markdown en metadata (OG description,
  JSON-LD). NO es sanitization de seguridad — strip de sintaxis
  visual para meta.
- Cero `dangerouslySetInnerHTML` en el render del contenido editorial.
  Único uso de `dangerouslySetInnerHTML` en el proyecto: `<JsonLd>`
  para emitir scripts JSON-LD, con escape `</script>` defendido por
  `safeJsonStringify`.

Los `// XSS: ...` TODOs en server actions ya no son bloqueantes: el
contenido editorial se persiste como-es y la sanitización pasa en el
render. Se pueden remover en cleanup futuro.

## Backlog técnico de v0.3-geo-b (DeepL)

Decisiones cerradas que NO entraron en este PR pero quedan listas para
el próximo:

- **Cron diario de retry de traducciones pendientes** (VPS-side):
  endpoint protegido `/api/cron/retry-translations` con header
  `Authorization: Bearer $CRON_SECRET`. Variable de entorno nueva
  `CRON_SECRET` (`openssl rand -hex 32`). El cron de la VPS dispara
  un `curl -X POST` cada 6am UTC y el endpoint itera todos los rows
  con `*PendingRetry = true` invocando `runRetryPending` por entity
  type. Tira logs estructurados para monitoreo. Se implementa cuando
  llegue el deploy a VPS.

- **Alertas por email al cruzar 80% de cuota DeepL**: el helper
  `src/lib/deepl.ts` ya loguea `console.warn` cuando un incremento
  cruza el threshold del 80%. Cuando esté la cuenta Resend con
  dominio verificado (`RESEND_API_KEY` ya prevista en `.env.example`),
  ese log se convierte en email al admin con el porcentaje exacto y
  el mes en curso. La función `getQuotaStatus()` ya expone el
  `isNearLimit` listo para usar.

- **Banner global "Cuota agotada" en admin**: hoy la cuota agotada se
  comunica solo via toast amarillo al editor que está guardando. El
  próximo PR puede mostrar un banner persistente en `/admin` cuando
  `getQuotaStatus().isExceeded === true`, con copy + link a docs y
  fecha estimada del reset (primer día del mes siguiente).

- **Regeneración masiva ante glossary/style change**: cuando exista
  configuración de glossary DeepL (terminología custom de turismo
  argentino), agregar acción "Re-traducir todo" en cada nivel que
  invoque `runForceRetranslate` para todos los rows. Hoy es lo
  suficientemente raro como para hacerse vía script ad-hoc.

- **Disclaimer en UI pública (v0.4)**: cuando las páginas públicas
  rendericen contenido en EN o PT-BR con `source = MACHINE`, mostrar
  al pie del texto: "Translated automatically — original text in
  Spanish" (o equivalente localizado). Si el source es `REVIEWED` o
  `HUMAN`, NO mostrar disclaimer — el contenido pasó por un humano.

- **Tagline en Listing**: el form de fichas todavía NO expone un
  campo de tagline (solo descripción). Cuando se agregue, el
  orchestrator ya está preparado — traduce `taglineEs` si cambia,
  mismo guard de `MACHINE/NONE` vs `REVIEWED/HUMAN`.

- **Sync de `initialUpdatedAtRef` post panel action** (M1 — data
  integrity audit v0.3-geo-b): las server actions del panel
  (`forceRetranslateField`, `markTranslationManuallyEdited`,
  `retryPendingTranslations` en `src/server/actions/translations/index.ts`)
  bumpean `updatedAt` del entity vía `applyTranslationUpdate`, pero
  el main form (EditorialContentForm / ListingFormShell) mantiene su
  `initialUpdatedAtRef` stale. Próximo submit/autosave del main form
  falla CAS con P2025 → editor queda atascado hasta refrescar
  manualmente. Fix: las server actions del panel devuelven el nuevo
  `updatedAt`, el panel lo propaga al form via callback/context. O
  alternativa: `router.refresh()` en el cliente post-acción.

- **DeepL retry filtering ciego** (M2 — data integrity audit
  v0.3-geo-b): `src/lib/deepl.ts:185-210` reintenta cualquier error
  que no sea `QuotaExceededError`/`AuthorizationError`. Si DeepL
  devuelve `InvalidInputError` (lang no soportado, payload
  malformado), gasta 13s de delays sin razón. Fix: filtrar por
  `TooManyRequestsError` / `ConnectionError` / 5xx / timeouts;
  devolver `INVALID_INPUT` para el resto. ~10 líneas.

- **Sequential DeepL calls bloquean UI ~3-8s** (M3 — data integrity
  audit v0.3-geo-b): `runTranslationsForFields` itera (campo × idioma)
  con `await` secuencial. Listing con tagline + description × EN +
  PT-BR = 4 calls × 1-2s = 4-8s de wall time bloqueando al editor.
  Fix: `Promise.all` por idioma manteniendo el `respectSourceGuard`
  por par independiente. Alternativa: fire-and-forget post-response
  (queue, edge function) para no bloquear UI.

- **`getCurrentMonth` usa UTC, no Argentina time** (N6 — data
  integrity audit v0.3-geo-b): `src/lib/deepl.ts:81-86` calcula el
  mes con `getUTCMonth()`. En Argentina (UTC-3), un editor guardando
  el 31 a las 22:00 ART está en UTC-3 → `getUTCMonth()` devuelve el
  mes siguiente (01:00 UTC del día 1). La cuota "salta" 3h antes de
  medianoche local. Es comportamiento deliberado para evitar drift
  entre regiones del runtime, pero documentar en runbook admin para
  no sorprender cuando el reset aparece "antes de tiempo".

- **Empty DeepL response treated as success** (CodeRabbit Minor
  deferred en v0.3-geo-b): `src/lib/deepl.ts:184`. Si DeepL devolviera
  un `TextResult` con `text=""` para un input no vacío, el código
  actual aceptaría la traducción vacía como exitosa e incrementaría
  cuota. Probabilidad real ~0 — DeepL no devuelve vacío para input
  no vacío en uso documentado. Si se detecta caso en producción,
  evaluar entre tres caminos antes de elegir: (a) retry con backoff
  (riesgo de 13s de delays ante evento raro), (b) skip + marcar
  pending (más conservador), (c) persistir con flag `requiresReview`
  (visible para el editor). No optar por "4 líneas defensivas" sin
  decidir la semántica.

## Cleanup periódico de `UploadSignatureNonce` (deuda activa)

La tabla `UploadSignatureNonce` se llena con un row por cada call a
`getUploadSignature`. Rows con `usedAt != null` ya cumplieron su
función (single-use) y rows con `usedAt = null` y `createdAt > 24h`
son signatures que el cliente nunca consumió (típico: editor cierra
la tab post-getSignature). Sin cleanup, la tabla crece sin techo.

Mitigación futura: cron daily que ejecuta:

```sql
DELETE FROM "UploadSignatureNonce"
WHERE "createdAt" < NOW() - INTERVAL '24 hours';
```

No se implementa ahora porque (a) el cron VPS-side todavía no existe
(ver backlog v0.3-geo-b), (b) volumen actual es despreciable. Se hace
junto con el cleanup de orphans Cloudinary y el cron de retry de
DeepL.

## Sanitización de caption/altText de imágenes (extensión de Markdown)

La sección "Sanitización de Markdown del editor (deuda crítica hacia
v0.4)" cubre `descriptionEs/En/PtBr` y `taglineEs/En/PtBr`. EXTENSIÓN
post-CodeRabbit + audit interno v0.3-geo-c: los campos `caption` y
`altText` de las 5 image models (`RegionImage`, `ProvinceImage`,
`DepartmentImage`, `LocalityImage`, `ListingImage`) también requieren
sanitización antes del render público en v0.4.

**Defense in depth aplicada en v0.3-geo-c** (CodeRabbit Pro P3):
`SaveMetadataPayloadSchema` y `UpdateImagePayloadSchema` ya rechazan
en el zod refinement:

- Control chars `\x00-\x1F\x7F` (newline injection en logs, ruptura
  de headers HTTP si se reflejan, JSON malformado en tooltips admin).
- Bidi unicode `\u202A-\u202E\u2066-\u2069` (Trojan Source: texto que
  se ve inocuo en admin pero se renderea distinto público).

Schema reusable `sanitizedShortText` en
`src/server/actions/images/index.ts`. Datos sucios NUNCA entran al
store — el catch es upfront en el server action, no esperamos al
render para escapar.

**Estado v0.4-a** (render público implementado):
- En el render público de las 4 páginas geográficas, `caption` se
  pasa por `alt`/`caption` del lightbox (texto inerte, sin
  interpretación HTML). `altText` va al `<img alt>` (Next/React lo
  escapa automáticamente). No hay `dangerouslySetInnerHTML` para
  estos campos.
- Las 200 chars siguen permitiendo `<script>` / `<` en el string —
  el riesgo XSS NO se materializa porque ningún render del público
  pasa estos valores por innerHTML.
- Si v0.4-b o posterior agrega un componente que **sí** los renderea
  como HTML (formato rich-text en caption, OG image alt con markup,
  etc.), aplicar el mismo pipeline `react-markdown + rehype-sanitize`
  del editorial — o `escapeHtml` simple para uso en atributos.

**TODO futuro**: si se decide formato rich-text en captions,
extender `editorialSanitizeSchema` y reusar `EditorialContent` para
captions con un schema más restrictivo (sin headings, sin
blockquote — solo `p, strong, em, a, br`).

## Rate limiting en server actions de imágenes (backlog)

Las 6 server actions de imágenes (`getUploadSignature`,
`saveImageMetadata`, `updateImage`, `setImageAsPrimary`,
`reorderImages`, `deleteImage`) no tienen rate limit. Un EDITOR
malicioso podría:
- Drenar la cuota Cloudinary con N `getUploadSignature` + uploads
  rápidos. Mitigado parcialmente por nonce single-use + bajada de
  `timestamp_validity` del preset Cloudinary a 120s, pero un loop
  agresivo todavía puede hacer daño.
- Cuando llegue Resend integration, drenar la cuota DeepL.

Fix futuro: middleware o wrapper `withRateLimit(userId, action,
{ limit, window })` con `@upstash/ratelimit` (compatible con Vercel
serverless single-region). ~30 invocaciones/min por usuario por
action es razonable para uso editorial real.

## Revalidación pública de imágenes — APLICADO en v0.4-a

Aplicado en el commit `refactor(admin): buildAdminPaths ->
buildAllPaths + updateTag granular` (PR v0.4-a).

Implementación:
- `src/lib/public/buildAllPaths.ts` (compartido). Resuelve la cadena
  de slugs (region.code + province.slug + department.slug +
  locality.slug) via Prisma lookup y devuelve:
  - `paths`: 1 admin path + 3 públicos (es/en/pt-BR).
  - `tags`: 1 tag formato `{level}:{slug}` que matchea el formato
    del `geoLoader.ts`.
- Las server actions de imágenes (5 callsites) y de translations
  (3 callsites) usan un helper local `revalidateForEntity` que
  delega a `buildAllPaths` y dispara `revalidatePath` + `updateTag`.
- `updateTag` (Next 16): variante para read-your-own-writes desde
  Server Actions. `revalidateTag` cambió firma en Next 16 a requerir
  `profile: CacheLifeConfig` explícito — para nuestro caso (admin
  mutation invalidando data cache público), `updateTag` es el
  match exacto.

Listing: solo admin path + tag `listing:{id}` (no hay página detail
pública en v0.4-a). Cuando v0.4-b agregue la página de ficha, se
extiende `buildAllPaths` para emitir las 3 públicas también.

## Audit trail por imagen (resuelto en v0.3-geo-c follow-up)

Las 5 server actions mutadoras de imágenes (`saveImageMetadata`,
`updateImage`, `setImageAsPrimary`, `reorderImages`, `deleteImage`)
emiten `console.info("[image-action]", { action, actor, imageId,
entityType, entityId, result: "success", timestamp, ...extra })` en
el success path via helper local `logImageAction`. Mismo shape en
las 5 actions para grep/parseo consistente.

Los logs quedan en Vercel por 30 días en plan Free. Buscar con
`grep "\\[image-action\\]"` o filtros estructurados. Suficiente para
trazabilidad operacional con volumen actual (1-3 editores).

Long-term (cuando >1 editor justifique investigaciones formales de
incidentes con búsqueda/diff retroactivo): tabla `AuditLog(id,
actorId, action, target, payload, createdAt)` consultable desde
admin. No prioritario hasta entonces.

## Restore-de-backup operacional (caso edge de migraciones de imágenes)

Si en algún momento se restaura un backup de producción a un nuevo
ambiente y se aplican las migraciones en orden, la migración
`20260511150000_add_partial_unique_constraints_for_image_primary`
puede fallar si el backup contiene duplicates de `isPrimary=true`
en alguna de las 5 image tables. CodeRabbit lo señaló como Major
Heavy lift; reproducirlo requiere ese caso operacional específico.

En ese caso:

1. Antes de aplicar `20260511150000_*`, ejecutar manualmente el
   contenido SQL de
   `20260512100000_defensive_backfill_image_primaries/migration.sql`
   contra la DB para demote duplicates.
2. `prisma migrate resolve --applied
   20260512100000_defensive_backfill_image_primaries` para que
   Prisma lo registre como aplicado sin re-ejecutarlo.
3. `prisma migrate deploy` para aplicar las migraciones restantes
   en orden normal.

No es problema en deploys normales:
- Entornos nuevos (preview, staging) se crean sin datos → no hay
  duplicates al aplicar `20260511150000`.
- Entornos activos (main DB) ya tienen ambas migraciones aplicadas
  successfully.
- Reorganizar el orden de timestamps generaría drift entre la
  branch y los ambientes con migraciones ya aplicadas — más riesgo
  que el caso edge que evita.

## Tenant scope check en server actions de imágenes (deuda activa)

`updateImage`, `setImageAsPrimary` y `deleteImage` reciben `{imageId,
entityType}` pero NO un `entityId`. `findImageById` solo verifica que
la imagen exista en la tabla del `entityType`, no que pertenezca al
entity específico que el editor está editando en su UI.

Hoy es OK: el modelo de confianza es "EDITOR/ADMIN es full-trust
sobre todo el contenido editorial". Sin embargo, si v0.5+ introduce
ownership multi-tenant (e.g. rol MERCHANT con scope a su propia
ficha, o "EDITOR de Cuyo" solo edita Cuyo), las 3 actions permiten
bypass sin parche retroactivo.

**Fix futuro**: agregar `entityId` al payload de las 3 actions y
verificar `img.parentId === entityId` después del `findImageById`.
`reorderImages` ya implementa exactamente esa verificación y sirve
de referencia (líneas 415-433 de `src/server/actions/images/index.ts`).

## Notas técnicas menores de imágenes

- **`setImageAsPrimary` P2025 no mapeado a IMAGE_NOT_FOUND**:
  `src/server/actions/images/index.ts` — si la imagen se borra entre
  `findImageById` y la transacción, P2025 escapa al `throw err`
  implícito (error 500). Fix chico: catch + return `IMAGE_NOT_FOUND`.
  No urgente.

- **`ListingImage.orderBy` sin tiebreaker `createdAt`**: las 4
  entities geo usan `orderBy: [{ order: "asc" }, { createdAt: "asc" }]`,
  Listing usa solo `{ order: "asc" }` en `getListingForEdit`. Si dos
  rows empatan `order` (no debería pasar tras la transacción de
  reorder, pero podría con seed/race), Listing no tiene orden
  determinístico. Agregar el tiebreaker en `getListingForEdit` para
  consistencia con geo.

- **Helper Cloudinary `cloudName` en `cloudinaryUrl` vs
  `getCloudName`**: ambos leen de `cloudinary.config()`. Si en el
  futuro se sirve desde CDN custom (e.g. `cdn.viajarpais.com.ar`
  con CNAME a Cloudinary), tocar ambas funciones simultáneamente.

## Next.js security update (Mayo 2026) — APLICADO en PR #13

Aplicado vía Dependabot PR #13 mergeado post v0.3-geo-c. Bump
`next` 16.2.5 → 16.2.6 cubre 13 advisories de mayo 2026 + 6 fixes
adicionales del follow-up release: middleware/proxy bypass × 4
(incluido fix incompleto), SSRF en WebSocket upgrades, DoS Cache
Components, DoS Server Components, XSS en CSP nonces +
`beforeInteractive`, DoS Image Optimization, cache poisoning RSC.

Defense in depth del proyecto (role gate en cada server action +
zod validation por endpoint) ya cubría el principal vector
"middleware bypass". El patch cierra el resto.

Smoke local + CI verde sobre 16.2.6 antes del merge. Sin breaking
changes que requirieran ajustes de código.

Referencias: <https://vercel.com/changelog/next-js-may-2026-security-release>

## Cleanup de orphans en Cloudinary (deuda de v0.3-geo-c)

El flujo de upload directo del cliente tiene DOS puntos de falla
que generan orphans:

**Orphan tipo A — Upload OK, save metadata falla**: si el cliente
sube exitosamente a Cloudinary (pasos 2-3 del flujo) pero el
`saveImageMetadata` (paso 5) falla o el usuario cierra el browser
antes, queda una foto en Cloudinary sin row de DB.

**Orphan tipo B — Cloudinary OK, DB delete falla**: en `deleteImage`,
borramos Cloudinary primero y DB después. Si la transacción DB falla
con un error no-P2025 (deadlock, conexión perdida, etc.), el asset
Cloudinary YA está borrado pero el row DB sobrevive apuntando a void.
Resultado: imagen rota en el grid del admin (404 visual). El editor
puede reintentar `deleteImage` — el segundo intento encuentra el row,
llama `deleteAsset` (idempotente, devuelve "not found" OK), y borra
el row exitosamente. Pero si la causa raíz del fallo es persistente
(deadlock recurrente), el row sobrevive como "stale". Hay `console.error`
estructurado con `imageId`, `cloudinaryPublicId`, `entityType`,
`entityId` y mensaje del error para identificación manual.

**Orphan tipo C — Cascade FK al borrar entity completa**: si en el
futuro se agrega "borrar Region" o "borrar Province" desde admin
(no existe hoy), la cascade FK en DB borra los `*Image` rows pero
los assets Cloudinary sobreviven huérfanos. Mismo para Listing
(documentado independientemente en sección "Cloudinary cleanup en
hard-delete de Listing").

Mitigación futura: job de cleanup periódico (cron daily) que:

1. Liste todos los assets en Cloudinary con prefix `regions/`,
   `provinces/`, `departments/`, `localities/`, `listings/`.
2. Para cada uno, chequee si existe un row en la tabla
   correspondiente con ese `cloudinaryPublicId`.
3. Si no existe Y el asset tiene más de N horas de antigüedad
   (e.g. 24h para dar margen a uploads en flight), borrarlo de
   Cloudinary.
4. Inverso para orphan tipo B: liste rows con `cloudinaryPublicId`
   no encontrado en Cloudinary (`deleteAsset` devuelve "not found"
   sin error) y márquelos para limpieza del admin.

No se implementa en v0.3-geo-c porque (a) el riesgo es bajo con
volumen actual del editor, (b) requiere el endpoint VPS-side cron
ya documentado en el backlog de v0.3-geo-b. Se hace junto con ese
endpoint.

## Upload preset firmado para uploads directos del cliente

`CLOUDINARY_UPLOAD_PRESET` es un nombre de preset configurado por
cada developer en su cuenta Cloudinary (Settings → Upload presets).
Modo: `Signing Mode = Signed`. Restricciones recomendadas del lado
de Cloudinary (complementan la validación cliente en `<GalleryUploader />`):

- Formats: `jpg, png, webp` (excluye `gif`, `mp4`, `pdf`).
- Max bytes: `5_242_880` (5MB).
- Folder: dejar vacío en el preset — el folder lo manda el cliente
  via signature firmada por server (`regions/{code}`,
  `provinces/{code}`, ..., `listings/{id}`).
- Use filename: false (Cloudinary asigna public_id aleatorio).
- Unique filename: true.

Cada entorno (preview, staging, prod) puede tener su propio preset.
En CI usamos un placeholder porque `next build` no invoca uploads
reales.

## Backlog v0.4-b — follow-ups del audit de v0.4-a

Items detectados por las 3 auditorías internas del PR v0.4-a
(security review + data integrity + product correctness) que
quedaron deferred con justificación. Se aplican en v0.4-b o un
PR específico cuando llegue el momento.

### Cloudinary 404 fallback en imágenes públicas (HIGH H5 deferred)

Cuando Cloudinary devuelve 404 para una imagen (asset borrado
manualmente, race con cleanup, CDN cache issue), `GeoHero` y
`PlaceCard` muestran el ícono de imagen rota de next/image en
lugar del fallback tipográfico/placeholder documentado en el
handoff §"Casos edge".

Solución: client wrapper con `onError` sobre next/image que
re-renderea la variante sin foto (placeholder/tipográfico) al
detectar fallo de carga. Aplicable a `HeroPhotoImage` y al
`<Image>` del `PlaceCard`.

Defer porque (a) requiere Cloudinary respondiendo 404, raro en
operación normal mientras el editor no borre assets manualmente,
(b) se hace junto con el "cleanup de orphans Cloudinary"
(documentado en este mismo archivo) — ambos comparten el patrón
de detectar/manejar inconsistencias DB ↔ CDN.

### Optimizaciones de performance pública (MAJOR M2-M4 deferred)

Tres optimizaciones sin impacto correctness inmediato pero con
mejora medible cuando el volumen crezca:

**M2 — Cache tags no incluyen locale.** El `unstable_cache` parts
incluye locale (correcto — cada locale cachea separado), pero el
tag por nivel es uniforme (ej. `region:cuyo` sin locale). Combinado
con `expandLocalePaths` en `buildAllPaths` se hace doble trabajo:
el tag invalida las 3 versiones del locale + los 3 paths
expandidos también. Considerar simplificar `buildAllPaths` para
emitir solo admin paths + tags, dejando la invalidación de las 3
versiones públicas vía tag exclusivamente.

**M3 — `take 30 → slice 24` rompe promesa "FEATURED arriba" con
>30 PUBLISHED.** `loadListingsForLevel` toma 30 con orderBy
`updatedAt desc`, luego sort en memoria por tier+verified+
updatedAt y slice 24. Si una provincia tiene 10 FEATURED viejos
+ 25 PAID + 100 FREE recientes, los FREE recientes ocupan los
primeros 30 y desplazan FEATUREDs del ranking final.

Fix: 2 queries (`tier IN ('FEATURED','PAID')` con take 24 + FREE
para rellenar si quedan slots), o `$queryRaw` con `CASE WHEN
tier=...`. Trivial hoy (entidades chicas), no urgente.

**M4 — Province query usa `findFirst` con relation filter.**
`loadProvinceNode` usa `findFirst({ where: { slug, region: { code } } })`
que genera JOIN. `Province.slug` es @unique global — más eficiente
`findUnique({ where: { slug } })` + validar `province.region.code
=== regionCode` en código. ~10ms más rápido por request.

### Validación Zod de empty string → null en form admin (follow-up M5)

`pickLocalizedField` en geoLoader usa `??` (nullish) para distinguir
"no traducido" (null) de "vacío intencional" (`""`). El form admin
de v0.3 devuelve `null` para vacíos en la práctica, pero no hay
validación Zod explícita que enforce eso. Si cambia el form en
v0.5+ (e.g. tag input que devuelve `""` al limpiar), el operador
nullish empezaría a confundir los dos casos.

Fix: agregar `.transform((s) => (s === "" ? null : s))` en el
schema Zod de campos editoriales del form admin, o equivalente en
`GeoEditorialContentSchema`.

### DeepL fallback edge case — decisión pendiente del PM

Locality con `descriptionEs` cargado pero `descriptionEn = null` y
`descriptionEnSource = NONE` (DeepL no procesó todavía o falló).
En `/en/...` se muestra el español como fallback SIN
`TranslationDisclaimer` (porque source es NONE, no MACHINE).

Opciones para v0.4-b o cuando el PM decida:
- **A (actual):** muestra ES sin disclaimer. Visitante ve texto
  en idioma "incorrecto" sin saber por qué.
- **B:** muestra ES con disclaimer adaptado "Original in Spanish
  — translation pending" / "Original em espanhol — tradução
  pendente". Más honesto, pero requiere extender
  TranslationDisclaimer con variant "pending" (~10 líneas).

NO se aplicó en v0.4-a porque la decisión es de producto, no
técnica.

## Cuando dudes, preguntá

No asumas decisiones de producto. Si encontrás una ambigüedad o una contradicción
entre constraints, decilo en chat antes de codear.
