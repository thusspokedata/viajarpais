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
- Slug colisiones: fail-fast con detalle, no auto-resolver con sufijo numérico.
  Override manual via `LOCALITY_SLUG_OVERRIDES` cuando haga falta.

## Cuando dudes, preguntá

No asumas decisiones de producto. Si encontrás una ambigüedad o una contradicción
entre constraints, decilo en chat antes de codear.
