# ViajarPaís

Directorio nacional de turismo argentino. Este repositorio contiene el bootstrap de la **versión 0.1** del proyecto: solo esqueleto técnico (Next.js + Prisma + Better Auth + i18n). Las fichas, la geografía y la UI pública llegan en versiones posteriores.

## Stack

- **Next.js 16** (App Router, TypeScript estricto, React 19.2)
- **Tailwind v4**
- **Prisma 7** con `@prisma/adapter-neon` (Postgres en Neon)
- **Better Auth** (email + password, sin OAuth)
- **next-intl 4** (3 idiomas: `es` por defecto sin prefijo, `en`, `pt-BR`)
- **Husky + commitlint + lint-staged** (Conventional Commits)
- **GitHub Actions** para CI

Requiere **Node ≥ 22** (declarado en `engines` y verificado en CI). Node 20 quedó EOL el 30 abril 2026, así que el proyecto se mantiene en la línea 22 LTS.

## Setup local

```bash
# 1. Copiar variables de entorno
cp .env.example .env.local

# 2. Completar todas las variables en .env.local (ver sección abajo)

# 3. Instalar dependencias
npm install

# 4. Generar el cliente Prisma
npm run db:generate

# 5. Crear y aplicar la migración inicial (necesita la base creada en Neon)
#    Importante: la primera migración debe incluir las extensiones unaccent y pg_trgm.
#    Ver "Primera migración" más abajo.
npm run db:migrate

# 6. Sembrar el usuario admin de bootstrap
npm run db:seed

# 7. Levantar el dev server
npm run dev
```

Después de eso:

- `http://localhost:3006/` → landing en español (sin prefijo).
- `http://localhost:3006/en` → landing en inglés.
- `http://localhost:3006/pt-BR` → landing en portugués brasileño.
- `http://localhost:3006/admin/login` → login admin.
- `http://localhost:3006/admin/health` → health check (requiere sesión con rol `ADMIN`).

## Variables de entorno

Ver `.env.example` para la lista completa. Resumen:

| Variable | Para qué |
| --- | --- |
| `DATABASE_URL` | Conexión Neon **pooled** (con `-pooler` en el host). Usada por el runtime. |
| `DIRECT_URL` | Conexión Neon **directa** (sin pooler). Usada por el CLI de Prisma. |
| `BETTER_AUTH_SECRET` | Secreto de 32+ bytes. Generar con `openssl rand -base64 48`. |
| `BETTER_AUTH_URL` | URL del backend de auth. En dev: `http://localhost:3006`. |
| `NEXT_PUBLIC_SITE_URL` | URL pública del sitio. |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | URL pública de auth (la lee el cliente). |
| `BOOTSTRAP_ADMIN_EMAIL` | Email del admin que crea el seed. |
| `BOOTSTRAP_ADMIN_PASSWORD` | Password del admin que crea el seed. |

`.env.local` está ignorado por git. `.env.example` se versiona.

## Comandos principales

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Dev server con Turbopack en `http://localhost:3006`. |
| `npm run build` | Build de producción. |
| `npm run start` | Server de producción (después de `build`). |
| `npm run lint` | ESLint sobre todo el repo. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run db:generate` | Genera el cliente Prisma en `src/generated/prisma`. |
| `npm run db:migrate` | Crea/aplica migraciones en dev (usa `DIRECT_URL`). |
| `npm run db:deploy` | Aplica migraciones en prod. |
| `npm run db:seed` | Crea el admin de bootstrap usando la API oficial de Better Auth. |
| `npm run auth:generate` | Sincroniza modelos auth en `prisma/schema.prisma` (correr cuando cambien `additionalFields` o plugins). |

## Estructura de carpetas

```
src/
  app/
    [locale]/
      (public)/                    -- rutas públicas (landing, fichas en el futuro)
        layout.tsx
        page.tsx                   -- landing placeholder localizado
      (admin-auth)/                -- rutas admin abiertas (login)
        admin/login/page.tsx
      (admin)/                     -- rutas admin protegidas (gate por rol ADMIN)
        admin/
          layout.tsx               -- valida sesión + rol ADMIN
          health/page.tsx          -- /admin/health
      layout.tsx                   -- root layout con NextIntlClientProvider
    api/
      auth/[...all]/route.ts       -- handler de Better Auth
    globals.css
  components/
    ui/                            -- (vacío, se llena post-design system)
    public/
    admin/
  i18n/
    routing.ts                     -- locales, defaultLocale, localePrefix
    request.ts                     -- carga de mensajes por locale
  lib/
    db.ts                          -- cliente Prisma con adapter Neon (singleton)
    auth.ts                        -- config Better Auth (server)
    auth-client.ts                 -- cliente Better Auth
  server/
    actions/                       -- (vacío)
  generated/
    prisma/                        -- cliente Prisma (NO versionado)
  proxy.ts                         -- middleware de Next 16 (renombrado de middleware.ts)
messages/
  es.json
  en.json
  pt-BR.json
prisma/
  schema.prisma                    -- schema Prisma 7 (sin url en datasource)
  seed.ts                          -- seed del admin bootstrap
  data/                            -- (vacío, para JSON de seed futuros)
  migrations/                      -- migraciones (creadas por `db:migrate`)
prisma.config.ts                   -- configuración del CLI de Prisma 7
.github/
  workflows/ci.yml                 -- lint + typecheck + build en cada PR
  PULL_REQUEST_TEMPLATE.md
.husky/
  pre-commit                       -- corre lint-staged
  commit-msg                       -- valida commitlint
```

> **Nota sobre `proxy.ts`**: Next.js 16 renombró `middleware.ts` a `proxy.ts` y la export pasó de `middleware` a `proxy`. El archivo vive en `src/proxy.ts` (junto a `src/app/`), no en la raíz, porque la app está dentro de `src/`.

## Primera migración (extensiones SQL)

La migración inicial **tiene que** habilitar las extensiones `unaccent` y `pg_trgm` antes de crear las tablas. El flujo es:

```bash
# 1. Crear la migración sin aplicarla
npx prisma migrate dev --name init --create-only

# 2. Editar prisma/migrations/<timestamp>_init/migration.sql y agregar al inicio:
#    CREATE EXTENSION IF NOT EXISTS unaccent;
#    CREATE EXTENSION IF NOT EXISTS pg_trgm;

# 3. Aplicar
npx prisma migrate dev
```

> En Prisma 7 el bloque `datasource` ya no lleva `url`. La conexión se configura en `prisma.config.ts` (que apunta a `DIRECT_URL`).

## i18n

- Locales soportados: `es` (por defecto, sin prefijo), `en`, `pt-BR`.
- Estrategia: `localePrefix: "as-needed"`.
- Sin auto-detección por `Accept-Language`. El switcher es manual.
- `pt-BR` es **case-sensitive** en la URL: `/pt-BR` funciona, `/pt-br` da 404.

Los mensajes viven en `messages/{locale}.json`.

## Roles

Tres roles soportados por Better Auth:

- `ADMIN` — acceso total al panel.
- `EDITOR` — para editores de contenido (sin uso en v0.1).
- `MERCHANT` — comerciantes con su ficha (default para signups; sin signup público en v0.1).

El rol no se puede setear desde el cliente (`input: false` en la config). El seed crea al admin y luego promueve el rol a `ADMIN` con un `prisma.user.update` directo.

## CI

`.github/workflows/ci.yml` corre en cada PR a `main`:

1. `npm ci`
2. `npm run db:generate` (necesario para que `lint` y `typecheck` resuelvan los tipos generados)
3. `npm run lint`
4. `npm run typecheck`
5. `npm run build`

Las migraciones de Prisma **no** corren en CI: se aplican manualmente con `direct connection` en cada entorno.

## Branch protection (aplicar a mano)

Configurar en GitHub → Settings → Branches → Branch protection rules para `main`:

- Require a pull request before merging
- Require approvals: 1
- Dismiss stale pull request approvals when new commits are pushed
- Require status checks to pass before merging → seleccionar **CI / validate**
- Require branches to be up to date before merging
- Require conversation resolution before merging
- Require linear history (recomendado)
- Restrict who can push to matching branches: solo `thusspokedata` (o el equipo cuando exista)
- Do not allow bypassing the above settings

Estas reglas se aplican manualmente desde la UI de GitHub, no desde código.

## Convenciones de commits

Conventional Commits estricto. Scopes válidos:

`admin`, `public`, `db`, `auth`, `geo`, `i18n`, `ci`, `infra`, `deps`, `repo`

Ejemplos válidos:

- `feat(auth): add password reset flow`
- `fix(db): correct slug uniqueness on Locality`
- `chore(deps): bump next to 16.3.0`

Commits que no cumplan son rechazados por commitlint vía hook `commit-msg`.
