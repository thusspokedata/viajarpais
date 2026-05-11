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
- URLs públicas: 2 niveles geo (provincia/localidad), departamento solo en DB y
  filtros admin.
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

## Sanitización de Markdown del editor (deuda crítica hacia v0.4)

Los campos `descriptionEs/En/PtBr` y `taglineEs/En/PtBr` aceptan
Markdown del editor (admin) y se persisten **sin sanitizar** en
v0.3-geo-b. Zod solo valida longitud (max 5000 / 120). DeepL preserva
HTML del input por defecto, así que las traducciones EN/PT-BR pueden
contener cualquier cosa que el editor haya puesto en ES.

**La sanitización es OBLIGATORIA en v0.4 cuando este contenido se
renderice como HTML en `/[locale]/...` público.** Sin sanitización
antes del render, cualquiera con rol EDITOR/ADMIN podría inyectar
`<script>` o eventos JS y ejecutar XSS en cualquier visitante.

**Libs recomendadas** (elegir una en v0.4):

- `marked` (parse Markdown → HTML) + `isomorphic-dompurify` (sanitiza
  HTML server-side con allowlist). Ventaja: API simple, dos pasos
  claros, fácil de testear.
- `react-markdown` + `rehype-sanitize` con el schema default (sin
  `rehype-raw`). Ventaja: React-native, sin HTML intermedio.

**NUNCA usar `rehype-raw` ni `dangerouslySetInnerHTML` sin un
sanitizer interpuesto.** El repo hoy tiene 0 hits de
`dangerouslySetInnerHTML` (grep confirmado); cualquier hit nuevo debe
pasar por code review con foco en sanitización.

**TODOs inline** marcados con `// XSS: ...` en los sitios donde el
contenido se persiste sin sanitizar:

- `src/server/actions/translations/index.ts` — `markTranslationManuallyEdited`.
- `src/server/actions/geo/update.ts` — `performGeoUpdate` antes de
  `runAutoTranslation`.
- `src/server/actions/listings/update.ts` — antes de `runAutoTranslation`.
- `src/server/actions/listings/create.ts` — antes de `runAutoTranslation`.
- `src/lib/translations/orchestrator.ts` — `translateOne` antes de
  persistir el output de DeepL.

Si el contenido se renderea como HTML/Markdown en cualquier path
antes de v0.4, **bloquear el PR** y agregar el pipeline de sanitización
primero.

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

## Cuando dudes, preguntá

No asumas decisiones de producto. Si encontrás una ambigüedad o una contradicción
entre constraints, decilo en chat antes de codear.
