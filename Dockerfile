# viajarpais — Next.js 16 (App Router) en arm64 (Raspberry Pi 4).
# El build corre nativamente en la Pi, asi que el binary target de
# Prisma ("native") resuelve a debian-openssl-arm64 sin cross-compile.
FROM node:22-bookworm-slim AS base
ENV HUSKY=0 \
    NEXT_TELEMETRY_DISABLED=1
# Prisma engine necesita openssl; ca-certificates para el TLS a Neon.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- deps: install con lockfile congelado (corre postinstall: prisma generate) ---
FROM base AS deps
COPY package.json package-lock.json .npmrc ./
COPY prisma ./prisma
RUN npm ci

# --- build: next build con las NEXT_PUBLIC_* horneadas en el bundle ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_BETTER_AUTH_URL
ENV NODE_ENV=production \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_BETTER_AUTH_URL=$NEXT_PUBLIC_BETTER_AUTH_URL \
    DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder \
    DIRECT_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
# El client de Prisma se genera en src/generated/prisma (output custom del
# schema), fuera de node_modules — hay que generarlo con el source ya
# presente, sino next build no resuelve '@/generated/prisma/client'.
RUN npx prisma generate
# Placeholders SOLO para que next build pueda cargar los modulos de las
# paginas admin (Better Auth y Cloudinary se instancian al import y exigen
# estas vars). NO se usan en runtime: el stage `runner` es un FROM aparte
# que solo COPIA archivos, no hereda este ENV; los valores reales entran
# por env_file (app.env). Ningun secreto real queda en la imagen final.
ENV BETTER_AUTH_SECRET=build_only_placeholder_secret_not_used_at_runtime \
    CLOUDINARY_URL=cloudinary://000000000000000:placeholder_build_secret_x@placeholder \
    CLOUDINARY_UPLOAD_PRESET=placeholder \
    DEEPL_API_KEY=placeholder \
    RESEND_API_KEY=placeholder
RUN npm run build

# --- runner: sirve la app ya compilada ---
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3006
# Bind a 0.0.0.0 a proposito: el reverse proxy del VPS la alcanza por el tunel.
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3006"]
