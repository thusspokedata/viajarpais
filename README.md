# ViajarPaís

**Directorio nacional de turismo argentino.** Sucede a *turiscuyo* (que cubría solo
Cuyo) y se expande a todo el país. Es un **directorio**, no un medio editorial: el
valor está en fichas de lugares/servicios verificadas y organizadas por geografía,
no en artículos.

Sitio en producción: **https://viajarpais.com.ar**

> **Para quien recién llega:** este README es el mapa de alto nivel — qué es,
> qué está hecho, qué falta y cómo arrancar. Las **convenciones de trabajo y las
> decisiones técnicas cerradas** viven en [`AGENTS.md`](AGENTS.md), que es la
> fuente de verdad y conviene leer antes de tocar código.

---

## Índice

- [Qué hace la app](#qué-hace-la-app)
- [Estado del proyecto](#estado-del-proyecto) ← empezá acá
- [Stack](#stack)
- [Setup local](#setup-local)
- [Variables de entorno](#variables-de-entorno)
- [Comandos](#comandos)
- [Estructura del repo](#estructura-del-repo)
- [Conceptos clave del dominio](#conceptos-clave-del-dominio)
- [Deploy e infraestructura](#deploy-e-infraestructura)
- [Cómo contribuir](#cómo-contribuir)
- [Roadmap](#roadmap)

---

## Qué hace la app

Dos mundos en un mismo repo:

- **Público** (`/`): landing + navegación geográfica en 4 niveles
  (`/{región}/{provincia}/{departamento}/{localidad}`). Cada nivel tiene su
  página con contenido editorial, foto de portada, galería y las fichas que
  contiene. Multiidioma (`es` / `en` / `pt-BR`).
- **Admin** (`/admin`): panel protegido por rol donde se cargan y verifican las
  fichas, se edita el contenido editorial de cada nivel geográfico y se
  gestionan las imágenes. El contenido se escribe en español y se traduce
  automáticamente a inglés y portugués.

---

## Estado del proyecto

El versionado del roadmap va por hitos `v0.x` (distinto del `version` en
`package.json`, que sigue en `0.1.0`). Resumen honesto de qué está realmente
implementado hoy:

### ✅ Hecho y funcionando

| Área | Detalle |
| --- | --- |
| **Base técnica** (v0.1) | Next.js 16 App Router, Prisma 7 + Neon, Better Auth (email/password), next-intl (3 idiomas), CI, deploy automático a la Pi. |
| **Auth + roles** | Login admin, 3 roles (`ADMIN` / `EDITOR` / `MERCHANT`), gate por rol en el layout admin y en cada server action. Sin signup público. |
| **CRUD de fichas** (v0.2) | Alta/edición/baja de listings en `/admin/listings` con tabla, filtros, paginación. Form con autosave, categorías, cascada de ubicación, horarios, tiers de pago y estados. Slug autogenerado con sufijo de localidad ante colisión. |
| **Verificación de fichas** | Sistema `verifiedAt` / `verifiedUntil` / `verifiedById`. Tocar campos críticos (nombre, dirección, geo, categorías) resetea la verificación y dispara el banner de re-verificación. |
| **Geografía 4 niveles** (v0.3) | Modelos Region → Province → Department → Locality, sembrados desde [Georef](https://www.argentina.gob.ar/datos/georef). Admin de geo en `/admin/geo` con edición de contenido editorial por nivel. |
| **i18n de contenido con DeepL** (v0.3) | Al guardar contenido en español, se traduce automático a `en` / `pt-BR`. Estados de traducción (`NONE` / `MACHINE` / `REVIEWED` / `HUMAN`), control de cuota mensual, panel de traducciones, retry tracking. |
| **Páginas públicas geo** (v0.4) | Las 4 páginas geográficas renderizadas: hero con foto, galería (lightbox), contenido editorial sanitizado, breadcrumbs, listado de fichas, JSON-LD (`BreadcrumbList` + `AdministrativeArea`) para SEO. |
| **Imágenes (Cloudinary)** (v0.4) | Upload directo del cliente con firma del server (nonce single-use), galería con drag & drop para reordenar, caption/altText, imagen primaria. 5 modelos de imagen (uno por nivel geo + listings). |
| **Design system** | `src/components/ui` (Radix + Tailwind v4 custom, **no shadcn**): Button, Card, Dialog, Select, Tabs, Tooltip, etc. Página de referencia viva en `/design`. |
| **Sanitización de markdown** | Contenido editorial renderizado con `react-markdown` + `rehype-sanitize` (allowlist estricta). Cero `dangerouslySetInnerHTML` salvo el JSON-LD escapado. |
| **Analítica** | Umami (self-hosted) integrado vía `UmamiAnalytics`. |

### 🚧 Parcial / preparado pero no terminado

- **Búsqueda**: la `SearchBar` está en la UI y la DB tiene `unaccent` + `pg_trgm`
  habilitados, pero la búsqueda full-text end-to-end todavía no está conectada.
- **Monetización**: los tiers (`FREE` / `PAID` / `FEATURED`) y los enums de pago
  (`PaymentStatus`, `PaymentMethod`) ya están en el schema y afectan el orden de
  las fichas, pero **no hay flujo de pago** (ninguna pasarela instalada).
- **Traducciones**: el flujo DeepL funciona; faltan las alertas por email al
  cruzar cuota (Resend está previsto en env pero sin implementar) y el cron de
  retry de traducciones pendientes.

### ❌ Todavía no existe

- Página pública de **detalle de una ficha** (hoy las fichas se listan dentro de
  la localidad, pero no tienen URL propia).
- Signup / gestión pública de comerciantes (rol `MERCHANT`).
- Affiliates.

Ver [Roadmap](#roadmap) para lo planeado y el backlog detallado en `AGENTS.md`.

---

## Stack

- **Next.js 16** (App Router, `src/`, Turbopack) · **React 19.2** · **TypeScript estricto**
- **Tailwind v4** con `@theme inline` en `src/app/globals.css`
- **Prisma 7** + `@prisma/adapter-neon` (Postgres en **Neon**, región Frankfurt)
- **Better Auth** (email + password, sin OAuth)
- **next-intl 4** — `es` (default, sin prefijo), `en`, `pt-BR`
- **Radix Primitives** + Tailwind custom (**no shadcn**)
- **Cloudinary** (imágenes) · **deepl-node** (traducción) · **Umami** (analítica)
- **react-hook-form** + **zod 4** · **@dnd-kit** (drag & drop) · **sonner** (toasts)
- Tipografías: Fraunces (display) + Inter (body) vía `next/font/google`
- **npm únicamente** (lockfile `package-lock.json`) · **Node ≥ 22**

---

## Setup local

> ⚠️ **Neon solo acepta conexiones desde la Pi/producción**, no desde cualquier
> IP. Para desarrollo local necesitás tu propia base Postgres (una branch de Neon
> propia, o Postgres local/Docker). Pedile al equipo una connection string de dev
> o creá una branch en Neon.

```bash
# 1. Variables de entorno
cp .env.example .env.local
#    Completar .env.local (ver tabla abajo). Cloudinary/DeepL/Resend son
#    opcionales para arrancar: sin ellas el core anda, esas features degradan.

# 2. Dependencias
npm install            # corre `prisma generate` en postinstall

# 3. Migraciones (crea el schema en tu base)
npm run db:deploy      # aplica las migraciones existentes
#    (para crear migraciones nuevas en dev: npm run db:migrate)

# 4. Seed
npm run db:seed              # usuario admin de bootstrap
npm run db:seed:categories   # categorías de fichas
npm run db:seed:geo          # geografía (regiones/provincias/deptos/localidades)

# 5. Dev server
npm run dev            # http://localhost:3006
```

Rutas para probar:

- `http://localhost:3006/` → landing (es) · `/en` · `/pt-BR`
- `http://localhost:3006/cuyo/mendoza/las-heras/uspallata` → página geo (4 niveles)
- `http://localhost:3006/admin/login` → login admin
- `http://localhost:3006/design` → design system

---

## Variables de entorno

Lista completa comentada en `.env.example`. Resumen:

| Variable | Para qué | ¿Requerida? |
| --- | --- | --- |
| `DATABASE_URL` | Neon **pooled** (host con `-pooler`). Runtime. | Sí |
| `DIRECT_URL` | Neon **directa** (sin pooler). CLI de Prisma / migraciones. | Sí |
| `BETTER_AUTH_SECRET` | Secreto 32+ bytes (`openssl rand -base64 48`). | Sí |
| `BETTER_AUTH_URL` | URL del backend de auth. Dev: `http://localhost:3006`. | Sí |
| `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_BETTER_AUTH_URL` | URLs públicas (las lee el cliente). | Sí |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | Admin que crea el seed. | Sí (para seed) |
| `CLOUDINARY_URL` / `CLOUDINARY_UPLOAD_PRESET` | Subida de imágenes. | Para imágenes |
| `DEEPL_API_KEY` | Traducción automática es→en/pt-BR. | Para i18n de contenido |
| `RESEND_API_KEY` | Alertas por email (cuota DeepL). | Previsto, sin uso aún |
| `NEXT_PUBLIC_UMAMI_*` | Analítica Umami. | Opcional |

`.env.local` está en `.gitignore`. `.env.example` se versiona con valores vacíos.
**Nunca commitear secretos** — push protection está activo en GitHub.

---

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) en `:3006`. |
| `npm run build` / `start` | Build y server de producción. |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit`. Ambos deben pasar antes de commitear (hook + CI). |
| `npm run db:generate` | Genera el cliente Prisma en `src/generated/prisma` (no se versiona). |
| `npm run db:migrate` | Crea/aplica migraciones en dev (usa `DIRECT_URL`). |
| `npm run db:deploy` | Aplica migraciones existentes (prod / setup). |
| `npm run db:seed` · `:categories` · `:geo` | Seeds: admin · categorías · geografía. |
| `npm run georef:fetch` | Baja datos de Georef a `prisma/data/*.json` (`--refresh` para regenerar). |
| `npm run auth:generate` | Re-sincroniza modelos de Better Auth en el schema (al cambiar `additionalFields`/plugins). |

---

## Estructura del repo

```
src/
  app/
    [locale]/
      (public)/                      -- sitio público
        page.tsx                     -- landing
        [region]/…/[locality]/       -- 4 niveles geográficos
        design/                      -- design system vivo
      (admin-auth)/                  -- login, access-denied (abiertas)
      (admin)/admin/                 -- panel protegido (gate rol ADMIN)
        geo/                         -- edición geográfica + contenido editorial
        listings/                    -- CRUD de fichas
        health/                      -- diagnóstico DB (con sesión)
      layout.tsx                     -- root: NextIntlClientProvider, fuentes
    api/
      auth/[...all]/route.ts         -- Better Auth
      health/route.ts                -- liveness probe (NO toca la DB)
  components/
    ui/                              -- design system (Radix + Tailwind custom)
    public/                          -- componentes del sitio público
    admin/                           -- componentes del panel
  lib/                               -- db, auth, deepl, cloudinary, helpers
  server/
    actions/                         -- mutaciones (listings, geo, images, translations)
    data/                            -- loaders de lectura (geo, listings)
  i18n/                              -- routing + carga de mensajes
  generated/prisma/                  -- cliente Prisma (NO versionado)
  proxy.ts                           -- middleware de Next 16 (antes middleware.ts)
messages/ {es,en,pt-BR}.json         -- strings de UI
prisma/
  schema.prisma                      -- modelos + enums
  migrations/                        -- historial de migraciones
  data/                              -- JSON de seed (geo)
  seed.ts                            -- seeds (admin / categorías / geo)
```

> **`proxy.ts`**: Next 16 renombró `middleware.ts` → `proxy.ts` (export `proxy`).
> Este Next tiene bastantes breaking changes vs. lo conocido — hay guías en
> `node_modules/next/dist/docs/` que conviene consultar antes de escribir código.

---

## Conceptos clave del dominio

Leer esto ahorra sorpresas. El detalle y las decisiones cerradas están en `AGENTS.md`.

- **URLs geográficas = 4 niveles.** `/{region}/{province}/{department}/{locality}`.
  Region por `code` (`/cuyo`), el resto por `slug`. CABA es `caba`. Los slugs de
  department y locality son únicos **por padre**, no globales.
- **Topónimos no se traducen.** Mendoza es Mendoza en cualquier idioma. Solo se
  traduce el contenido editorial (descripciones, meta).
- **Fuente de verdad del contenido = español.** Las traducciones a `en`/`pt-BR`
  se generan con DeepL al guardar; las marcadas `REVIEWED`/`HUMAN` no se pisan.
- **Verificación de fichas.** Una ficha verificada muestra un badge; editar sus
  campos críticos la "desverifica" hasta que un editor la revalide.
- **Imágenes van a Cloudinary**, no al repo ni a la DB (solo se guardan
  metadatos + `cloudinaryPublicId`). Upload directo del cliente con firma del
  server.
- **Todo lo visible al usuario va a `messages/{locale}.json`.** No hardcodear
  strings salvo placeholders de diseño.

---

## Deploy e infraestructura

- **Producción**: corre en la Raspberry Pi `nextcloud` vía **Docker Compose**
  (`docker-compose.yml`), puerto 3006, detrás de un reverse proxy en un VPS
  (túnel WireGuard).
- **CD**: un **self-hosted runner** hace `up -d --build` en **cada push a `main`**
  (`.github/workflows/deploy.yml`). Copia `app.env` (secrets, solo viven en la Pi)
  antes del build. O sea: **mergear a `main` = deployar**.
- **DB**: Neon (Postgres, Frankfurt). El compute escala a cero tras ~5 min de
  inactividad — por eso el healthcheck del contenedor apunta a `/api/health`
  (que **no** toca la DB) y no a la home.
- **CI** (`.github/workflows/ci.yml`, en cada PR): `db:generate` → `lint` →
  `typecheck` → `build`. Las migraciones **no** corren en CI. CodeRabbit + CodeQL
  revisan cada PR.

---

## Cómo contribuir

Reglas completas en [`AGENTS.md`](AGENTS.md). Lo esencial:

- **Sin git worktrees.** Trabajá directo en el repo con `git checkout`. Una branch
  por tarea: `feature/<scope>-<desc>`, `fix/<scope>-<desc>`, `chore/<desc>`.
- **Conventional Commits estricto** (los valida commitlint en un hook). Scopes:
  `admin`, `public`, `db`, `auth`, `geo`, `i18n`, `ci`, `infra`, `deps`, `repo`, `ui`.
  Ej: `feat(admin): agregar filtro por tier a la tabla de fichas`.
- **PRs contra `main`** (protegida, squash merge, historia lineal). CI en verde +
  revisión antes de mergear. Recordá que mergear a `main` **deploya a producción**.
- `lint` + `typecheck` tienen que pasar antes de cada commit (hay pre-commit hook).
- Ante una **ambigüedad de producto**, preguntá en el chat/PR antes de codear — no
  asumas decisiones de negocio.

---

## Roadmap

Lo pensado, a grandes rasgos (el backlog técnico fino está en `AGENTS.md`):

**Producto**
- Página pública de **detalle de ficha** (hoy solo se listan dentro de la localidad).
- **Búsqueda** full-text real (la DB ya tiene `unaccent` + `pg_trgm`).
- **Monetización**: completar el flujo de fichas pagas (`FREE`/`PAID`/`FEATURED`
  ya existen en el schema) — falta la pasarela de pago — y **affiliates** en
  paralelo (ambos conviven en cada ficha).
- **Interactividad del público**: scroll-storytelling, filtros como pieza central
  (es un directorio) y micro-interacciones.

**Plataforma / operación**
- **Crons** (VPS): retry de traducciones DeepL pendientes, limpieza de
  `UploadSignatureNonce` y de imágenes huérfanas en Cloudinary.
- **Resend**: alertas por email al cruzar 80 % / 100 % de la cuota de DeepL.
- **Rate limiting** en las server actions de imágenes.
- **i18n del admin UI** (hoy el panel es solo en español; el *contenido* sí es
  multiidioma).
- Preparación para **multi-tenant** (scope por ownership para el rol `MERCHANT`).
