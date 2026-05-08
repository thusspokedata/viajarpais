# ViajarPaís — UI Design System

Sistema de componentes y tokens del directorio nacional de turismo argentino.
Esta carpeta contiene los **primitivos**. Los **patterns compuestos** viven en
`src/components/public/` y `src/components/admin/`.

Para ver todo en vivo abrí **`/_design`** en tu navegador local con `npm run dev`.

---

## Filosofía visual

Editorial institucional con alma utilitaria.

- **Confianza** como posicionamiento → tipografía display seria (Fraunces),
  paleta sobria, sello "Verificado" tratado como denominación de origen, no
  como sticker de oferta.
- **Doble naturaleza público + admin** resuelta con un único set de tokens
  + una variable de densidad (`data-density="comfortable" | "compact"`).
- **Tres tiers de listing** distinguidos por **composición** (espacio +
  tipo + tamaño de imagen), no por color saturado. Nunca parece publicidad.

---

## Stack

- Tailwind v4 (`@theme inline` en `src/app/globals.css`).
- Radix Primitives para accesibilidad (Dialog, DropdownMenu, Select, Tabs,
  Tooltip, Separator, Avatar, Label, Slot).
- `class-variance-authority` + `clsx` + `tailwind-merge` para variantes.
- `lucide-react` para el set genérico de iconos.
- Fuentes: **Fraunces** (display) + **Inter** (body / UI), cargadas con
  `next/font/google` en `src/app/[locale]/layout.tsx`.

---

## Tokens semánticos

Todos los tokens viven en `src/app/globals.css`. Tabla rápida:

| Grupo       | Token                          | Cuándo usar                                                |
|-------------|--------------------------------|------------------------------------------------------------|
| Surface     | `--surface-canvas`             | Fondo de la página                                         |
|             | `--surface-base`               | Cards, panels, header                                      |
|             | `--surface-raised`             | Popovers, dialogs (encima del contenido)                   |
|             | `--surface-sunken`             | Hover de items, zebra de tablas, inputs en hover           |
|             | `--surface-overlay`            | Overlay detrás de un Dialog                                |
| Text        | `--text-primary`               | Headings, body principal                                   |
|             | `--text-secondary`             | Subtítulos, body secundario                                |
|             | `--text-muted`                 | Eyebrow, captions, hints                                   |
|             | `--text-inverse`               | Texto sobre fondo oscuro (tooltips, primary button)        |
|             | `--text-link` / `-hover`       | Enlaces                                                    |
| Border      | `--border-subtle`              | Líneas de separación discretas, cards                      |
|             | `--border-default`             | Borde de inputs, cards interactivas                        |
|             | `--border-strong`              | Hover de inputs, separadores enfáticos                     |
| Brand       | `--brand-primary` / `-hover`   | Buttons primary, foco, acentos de marca                    |
|             | `--brand-muted` / `-fg`        | Item activo en sidebar, fondos chip de marca               |
| Feedback    | `--success-fg` + `-bg`         | Confirmaciones                                             |
|             | `--warning-fg` + `-bg`         | Avisos, verificación expirando                             |
|             | `--danger-fg` + `-bg`          | Errores, destructive actions                               |
|             | `--info-fg` + `-bg`            | Información neutra                                         |
| Tier        | `--tier-free-*`                | Composición de cards tier `free`                           |
|             | `--tier-paid-*`                | Composición de cards tier `paid` (strip cream)             |
|             | `--tier-featured-*`            | Composición de cards tier `featured` (acento gold)         |
| Verified    | `--verified-fg` + `-bg` + `-ring` | Sello institucional (NO usar como success genérico)     |

> **Regla:** si dudás entre semántico y literal, optá por semántico. Los
> únicos literales aceptados son los `--brand-50…900`, `--neutral-0…950`,
> `--featured-*` y `--verified-*` porque son los valores de marca puros.

---

## Reglas de uso

### Tiers de listing

Aplicar **siempre** vía la variante de `<Card variant="tier-free|tier-paid|tier-featured">`
o usando directo `<ListingCard tier="…">`. Diferenciación por composición:

- **free** → 1 imagen `aspect-16/9`, descripción 2 líneas, sin galería extra.
- **paid** → 1 imagen + strip cream lateral en card + galería de 3 thumbs
  pequeños debajo de la descripción.
- **featured** → imagen `aspect-16/10` más alta, padding mayor (`p-6`),
  descripción 3 líneas, badge "Selección" tipográfico (no ⭐ amarillo
  estridente), galería más grande, ocupa 2 columnas en grid xl.

### Badge Verificado

Es el **activo de marca crítico**. Tres estados, ya cubiertos por
`<VerifiedBadge>`:

- `active` (vence en > 60 días) → verde institucional pleno.
- `expiring` (vence en ≤ 60 días) → ámbar sutil.
- `expired` → monocromatizado a gris (NO se elimina; señala "se está
  renovando"). Tooltip dice "Verificación vencida — en proceso de renovación".

El tooltip muestra fecha de verificación, fecha de vencimiento, y barra de
vigencia restante. Hover dispara escala del shield (spring easing).

**Posición convenida:**
- En `ListingCard`: esquina superior derecha de la imagen.
- En la ficha individual: línea junto al nombre del lugar.
- Nunca: en CTAs, banners, headers.

### Button

| Cuándo                          | Variante       |
|---------------------------------|----------------|
| Acción principal (1 por pantalla)| `primary`     |
| Acción al lado del primary       | `secondary`   |
| Toolbar / row action / terciaria | `ghost`       |
| Eliminar / cancelar irreversible | `destructive` (solo dentro de Dialog) |
| Acción que se siente como link   | `link`        |

### Card vs Dialog

- **Card**: contenido que convive con el resto de la página. No bloquea.
- **Dialog**: contenido que pausa el flujo y requiere decisión explícita
  (confirmaciones, formularios largos en context modal, settings).

---

## Sistema de motion

**Principios:**
1. Animar solo cuando comunica algo: aparición, jerarquía, feedback de acción.
2. Nunca animar a costa de la performance percibida (no hay animaciones de
   entrada > 360ms en UI normal).
3. Respetar siempre `prefers-reduced-motion` (definido global en globals.css
   con un wildcard que reduce duraciones a 0.01ms).

**Tokens:**

| Duration   | Valor   | Uso                                                |
|------------|---------|----------------------------------------------------|
| `--duration-instant` | 80ms  | Hover de iconos, micro-feedback                    |
| `--duration-fast`    | 140ms | Hover de buttons, color transitions, dropdowns     |
| `--duration-base`    | 220ms | Cards lift, tabs indicator, dialog enter           |
| `--duration-slow`    | 360ms | Page transitions, banner reveals                   |
| `--duration-slower`  | 560ms | Image zoom on card hover                           |

| Easing                | Cuándo                                         |
|-----------------------|------------------------------------------------|
| `--ease-standard`     | Default. Hover, color, border.                 |
| `--ease-emphasized`   | Entrada de dialog/modal/sheet (acentúa entrada)|
| `--ease-decelerate`   | Aparición de contenido (skeleton → real)       |
| `--ease-accelerate`   | Salida (rara vez; las salidas suelen ser fade) |
| `--ease-spring`       | Micro-interacciones jugadas (badge Verificado, FAB) |

**Animaciones predefinidas (clases utility):**

- `.vp-fade-in` — fade + traslación 4px.
- `.vp-scale-in` — opacity + scale 0.96→1 (Dialogs).
- `.vp-reveal` — reveal-down (Dropdowns, Selects).
- `.vp-shimmer` — shimmer loop (Skeletons).

---

## Cómo extender

### Agregar un primitivo nuevo

1. Crear `src/components/ui/MiPrimitivo.tsx` con `"use client"` arriba si usa
   estado o Radix.
2. Estilar **únicamente** con tokens (`var(--…)` o las utilidades Tailwind
   que mapean a `@theme inline`). NO hardcodear hex / px.
3. Si tiene variantes, usar `cva` (ver `Button.tsx`).
4. Agregar `forwardRef` y `displayName`.
5. Re-exportar desde `src/components/ui/index.ts`.
6. Agregar una sección en `/_design` con todas las variantes y estados.

### Agregar una variante a un primitivo existente

1. Sumar la variante al schema `cva` del componente.
2. Agregarla en `/_design`.
3. Documentar acá en este README cuándo usarla.

### Activar dark mode (futuro)

Todo el sistema ya es semántico. Cuando llegue el momento:

1. En `globals.css`, completar el bloque `:root[data-theme="dark"]` con los
   nuevos valores de cada token semántico (surface, text, border…).
2. Agregar un `ThemeToggle` en el header que setee el atributo en `<html>`.
3. Verificar contraste WCAG y revisar el badge Verificado (que mantenga su
   peso institucional en dark).

No hay que tocar componentes.

---

## Referencias

- **Showcase visual** → `src/app/[locale]/(public)/_design/page.tsx` →
  abrir en `http://localhost:3006/_design`.
- **Mockup standalone** → `design-system.html` en la raíz (preview rápida sin
  levantar Next).
