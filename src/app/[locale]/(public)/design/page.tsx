import type { Metadata } from "next";
import {
  Button,
  Input,
  Label,
  Textarea,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  FeaturedBadge,
  VerifiedBadge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Separator,
  Avatar,
  AvatarFallback,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  EmptyState,
  TooltipProvider,
} from "@/components/ui";
import { Map, Search, Plus } from "@/components/ui/icons";
import { ListingCard } from "@/components/public/ListingCard";
import { RegionFilter } from "@/components/public/RegionFilter";
import { SearchBar } from "@/components/public/SearchBar";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { ListingsLayout } from "@/components/public/ListingsLayout";
import { AdminShell } from "@/components/admin/AdminShell";
import { ListingForm } from "@/components/admin/ListingForm";

export const metadata: Metadata = {
  title: "Design System — ViajarPaís",
  robots: { index: false, follow: false },
};

const MOCK = [
  {
    tier: "featured" as const,
    name: "Hostería Lago Escondido",
    category: "Alojamiento",
    province: "Río Negro",
    locality: "Bariloche",
    description:
      "Cabañas de montaña a orillas del lago, con desayuno incluido y vista panorámica al cerro Catedral. Ideal para familias y parejas en busca de tranquilidad patagónica.",
    verifiedAt: "2026-01-15",
    expiresAt: "2027-01-15",
    galleryUrls: ["", "", ""],
  },
  {
    tier: "paid" as const,
    name: "Bodega del Limay",
    category: "Gastronomía",
    province: "Mendoza",
    locality: "Luján de Cuyo",
    description:
      "Bodega boutique con cata de Malbec de altura y cocina de autor de inspiración cuyana.",
    verifiedAt: "2025-11-20",
    expiresAt: "2026-06-20",
    galleryUrls: ["", "", ""],
  },
  {
    tier: "free" as const,
    name: "Quebrada de Humahuaca",
    category: "Sitio de interés",
    province: "Jujuy",
    locality: "Humahuaca",
    description:
      "Patrimonio de la Humanidad. Ruta cultural con paradas en Tilcara, Purmamarca y Uquía.",
    verifiedAt: "2025-04-10",
    expiresAt: "2025-12-10",
  },
];

export default function DesignSystemPage() {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[var(--surface-canvas)]">
        <header className="border-b border-[var(--border-subtle)] bg-[var(--surface-base)]">
          <div className="mx-auto max-w-6xl px-6 py-8">
            <div className="text-[10px] font-display uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
              Internal · /design
            </div>
            <h1 className="mt-1 font-display text-[var(--text-4xl)] font-semibold tracking-[var(--tracking-tight)]">
              ViajarPaís Design System
            </h1>
            <p className="mt-2 max-w-2xl text-[var(--text-md)] text-[var(--text-secondary)]">
              Referencia viva de tokens, primitivos y patterns. Esta página es la
              fuente de verdad para armar páginas. No indexada, no enlazada desde nav.
            </p>
            <nav className="mt-5 flex flex-wrap gap-3 text-[var(--text-sm)]">
              <a className="text-[var(--text-link)] hover:underline" href="#tokens">Tokens</a>
              <a className="text-[var(--text-link)] hover:underline" href="#primitives">Primitivos</a>
              <a className="text-[var(--text-link)] hover:underline" href="#patterns">Patterns</a>
              <a className="text-[var(--text-link)] hover:underline" href="#motion">Motion</a>
              <a className="text-[var(--text-link)] hover:underline" href="#combinations">Reglas</a>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-10 flex flex-col gap-16">
          {/* TOKENS */}
          <section id="tokens" className="scroll-mt-20">
            <SectionTitle eyebrow="01" title="Tokens" />
            <Subsection title="Paleta — Brand">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {["50","100","200","400","500","600","700","900"].map((s) => (
                  <Swatch key={s} name={`brand-${s}`} cssVar={`--brand-${s}`} />
                ))}
              </div>
            </Subsection>
            <Subsection title="Paleta — Semánticos">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Swatch name="surface-base" cssVar="--surface-base" />
                <Swatch name="surface-canvas" cssVar="--surface-canvas" />
                <Swatch name="surface-sunken" cssVar="--surface-sunken" />
                <Swatch name="text-primary" cssVar="--text-primary" />
                <Swatch name="text-secondary" cssVar="--text-secondary" />
                <Swatch name="text-muted" cssVar="--text-muted" />
                <Swatch name="border-subtle" cssVar="--border-subtle" />
                <Swatch name="border-default" cssVar="--border-default" />
                <Swatch name="brand-primary" cssVar="--brand-primary" />
                <Swatch name="success-fg" cssVar="--success-fg" />
                <Swatch name="warning-fg" cssVar="--warning-fg" />
                <Swatch name="danger-fg" cssVar="--danger-fg" />
                <Swatch name="verified-fg" cssVar="--verified-fg" />
                <Swatch name="featured-fg" cssVar="--featured-fg" />
              </div>
            </Subsection>
            <Subsection title="Tipografía">
              <div className="flex flex-col gap-4">
                <TypeRow size="text-5xl" label="Display 60 / Fraunces 600">
                  <span className="font-display text-[var(--text-5xl)] tracking-[var(--tracking-tight)] font-semibold">
                    Confianza editorial
                  </span>
                </TypeRow>
                <TypeRow size="text-3xl" label="Heading 36 / Fraunces 600">
                  <span className="font-display text-[var(--text-3xl)] tracking-[var(--tracking-tight)] font-semibold">
                    Quebrada de Humahuaca
                  </span>
                </TypeRow>
                <TypeRow size="text-xl" label="Subhead 24 / Fraunces 500">
                  <span className="font-display text-[var(--text-xl)] font-medium">
                    Patrimonio de la Humanidad
                  </span>
                </TypeRow>
                <TypeRow size="text-base" label="Body 16 / Inter 400">
                  <p className="text-[var(--text-base)] leading-[var(--leading-normal)] max-w-prose">
                    El cuerpo del directorio se compone en Inter 400 a 16px con leading
                    1.55. Es el tamaño base del sitio público; el admin baja a 14px por
                    densidad.
                  </p>
                </TypeRow>
                <TypeRow size="text-xs caps" label="Eyebrow / display caps">
                  <span className="font-display uppercase tracking-[var(--tracking-caps)] text-[var(--text-xs)] text-[var(--text-muted)]">
                    Verificación · 12 meses
                  </span>
                </TypeRow>
              </div>
            </Subsection>
            <Subsection title="Espaciado">
              <div className="flex items-end gap-4 flex-wrap">
                {[1,2,3,4,5,6,8,10,12,16].map((n) => (
                  <div key={n} className="flex flex-col items-center gap-1.5">
                    <div className="bg-[var(--brand-primary)]" style={{ width: `var(--space-${n})`, height: `var(--space-${n})` }} />
                    <span className="text-[var(--text-xs)] font-mono text-[var(--text-muted)]">{n}</span>
                  </div>
                ))}
              </div>
            </Subsection>
            <Subsection title="Radios">
              <div className="flex items-center gap-3 flex-wrap">
                {["xs","sm","md","lg","xl","2xl","pill"].map((r) => (
                  <div key={r} className="flex flex-col items-center gap-1.5">
                    <div
                      className="h-14 w-14 bg-[var(--neutral-150)] border border-[var(--border-default)]"
                      style={{ borderRadius: `var(--radius-${r})` }}
                    />
                    <span className="text-[var(--text-xs)] font-mono text-[var(--text-muted)]">{r}</span>
                  </div>
                ))}
              </div>
            </Subsection>
            <Subsection title="Sombras">
              <div className="grid grid-cols-3 gap-4">
                {["subtle","default","elevated"].map((s) => (
                  <div key={s} className="flex flex-col items-center gap-2">
                    <div
                      className="h-20 w-full bg-[var(--surface-base)] rounded-[var(--radius-md)]"
                      style={{ boxShadow: `var(--shadow-${s})` }}
                    />
                    <span className="text-[var(--text-xs)] font-mono text-[var(--text-muted)]">shadow-{s}</span>
                  </div>
                ))}
              </div>
            </Subsection>
            <Subsection title="Motion">
              <div className="flex flex-wrap gap-3 text-[var(--text-xs)] font-mono text-[var(--text-secondary)]">
                {["instant 80ms","fast 140ms","base 220ms","slow 360ms","slower 560ms"].map((d) => (
                  <code key={d} className="px-2 py-1 rounded bg-[var(--surface-sunken)]">{d}</code>
                ))}
                <span className="px-2 py-1">·</span>
                {["standard","emphasized","decelerate","accelerate","spring"].map((e) => (
                  <code key={e} className="px-2 py-1 rounded bg-[var(--surface-sunken)]">ease-{e}</code>
                ))}
              </div>
            </Subsection>
          </section>

          {/* PRIMITIVES */}
          <section id="primitives" className="scroll-mt-20">
            <SectionTitle eyebrow="02" title="Primitivos" />

            <Subsection title="Button">
              <div className="flex flex-wrap gap-3 items-center">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Eliminar</Button>
                <Button variant="link">Link</Button>
                <Button loading>Cargando</Button>
                <Button disabled>Disabled</Button>
              </div>
              <div className="flex flex-wrap gap-3 items-center mt-3">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
                <Button leadingIcon={<Plus className="h-4 w-4" />}>Con icono</Button>
              </div>
            </Subsection>

            <Subsection title="Input / Label / Textarea / Select">
              <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
                <div className="flex flex-col gap-1.5">
                  <Label requiredMark hint="120 max">Nombre</Label>
                  <Input placeholder="Ej. Hostería Lago Escondido" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Búsqueda</Label>
                  <Input placeholder="Buscar…" leadingIcon={<Search className="h-4 w-4" />} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Email (inválido)</Label>
                  <Input invalid defaultValue="no-es-email" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Categoría</Label>
                  <Select defaultValue="aloj">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aloj">Alojamiento</SelectItem>
                      <SelectItem value="gas">Gastronomía</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <Label>Descripción</Label>
                  <Textarea placeholder="Texto largo…" rows={3} />
                </div>
              </div>
            </Subsection>

            <Subsection title="Badges">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge>Default</Badge>
                <Badge variant="info">Info</Badge>
                <Badge variant="success">Aprobado</Badge>
                <Badge variant="warning">Pendiente</Badge>
                <Badge variant="danger">Bloqueado</Badge>
                <Badge variant="tier-free">Listado</Badge>
                <Badge variant="tier-paid">Miembro</Badge>
                <FeaturedBadge />
              </div>
              <div className="flex flex-wrap gap-3 items-center mt-4">
                <VerifiedBadge verifiedAt="2026-01-15" expiresAt="2027-01-15" />
                <VerifiedBadge verifiedAt="2025-08-15" expiresAt="2026-06-30" />
                <VerifiedBadge verifiedAt="2024-01-15" expiresAt="2025-01-15" />
                <span className="text-[var(--text-xs)] text-[var(--text-muted)]">activo · expirando · vencido</span>
              </div>
            </Subsection>

            <Subsection title="Card / Avatar / Skeleton / Separator / Tabs / EmptyState">
              <div className="grid md:grid-cols-2 gap-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Card estándar</CardTitle>
                    <CardDescription>Contenedor base de superficie elevada.</CardDescription>
                  </CardHeader>
                  <CardContent className="text-[var(--text-sm)] text-[var(--text-secondary)]">
                    El cuerpo de la card. Para listings usar variantes tier-*.
                  </CardContent>
                  <CardFooter>
                    <Avatar><AvatarFallback>CS</AvatarFallback></Avatar>
                    <span className="text-[var(--text-sm)]">Camila Soria</span>
                  </CardFooter>
                </Card>
                <Card className="p-5">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-6 w-3/4 mb-3" />
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-4 w-5/6" />
                </Card>
              </div>
              {/* asChild: la Card se renderiza COMO su hijo (acá un <a>), sin
                  <div> envoltorio extra. Ejercita ese camino para que el leak
                  de atributo (`aschild`) y el wiring del Slot no regresen. */}
              <Card asChild variant="interactive" className="mt-5 block p-5">
                <a href="#primitives">
                  <CardTitle>Card asChild · link</CardTitle>
                  <CardDescription>
                    Toda la card es un &lt;a&gt; — un solo elemento, sin div envoltorio.
                  </CardDescription>
                </a>
              </Card>
              <Separator className="my-5" />
              <Tabs defaultValue="t1">
                <TabsList>
                  <TabsTrigger value="t1">Resumen</TabsTrigger>
                  <TabsTrigger value="t2">Imágenes</TabsTrigger>
                  <TabsTrigger value="t3">Verificación</TabsTrigger>
                </TabsList>
                <TabsContent value="t1" className="text-[var(--text-sm)] text-[var(--text-secondary)]">
                  Contenido de la primera tab.
                </TabsContent>
                <TabsContent value="t2" className="text-[var(--text-sm)] text-[var(--text-secondary)]">
                  Contenido de la segunda tab.
                </TabsContent>
                <TabsContent value="t3" className="text-[var(--text-sm)] text-[var(--text-secondary)]">
                  Contenido de la tercera tab.
                </TabsContent>
              </Tabs>
              <Separator className="my-5" />
              <EmptyState
                icon={<Map className="h-6 w-6" />}
                title="Sin fichas todavía"
                description="Cuando empieces a cargar fichas verificadas, van a aparecer acá."
                action={<Button leadingIcon={<Plus className="h-4 w-4" />}>Crear primera ficha</Button>}
              />
            </Subsection>
          </section>

          {/* PATTERNS */}
          <section id="patterns" className="scroll-mt-20">
            <SectionTitle eyebrow="03" title="Patterns" />

            <Subsection title="ListingCard — los 3 tiers (composición, no color)">
              <div className="grid md:grid-cols-3 gap-5">
                {MOCK.map((m, i) => (
                  <ListingCard key={i} {...m} />
                ))}
              </div>
            </Subsection>

            <Subsection title="RegionFilter">
              <RegionFilter />
            </Subsection>

            <Subsection title="SearchBar">
              <div className="max-w-xl">
                <SearchBar />
              </div>
            </Subsection>

            <Subsection title="PublicHeader / PublicFooter">
              <Card className="overflow-hidden">
                <PublicHeader />
                <div className="h-32 bg-[var(--surface-canvas)] grid place-items-center text-[var(--text-muted)] text-[var(--text-sm)]">
                  Página de ejemplo
                </div>
                <PublicFooter className="mt-0" />
              </Card>
            </Subsection>

            <Subsection title="ListingsLayout (público completo)">
              <Card className="overflow-hidden">
                <ListingsLayout listings={MOCK} total={142} />
              </Card>
            </Subsection>

            <Subsection title="AdminShell + ListingForm">
              <Card className="overflow-hidden h-[720px]">
                <div className="h-full overflow-auto">
                  <AdminShell pageTitle="Nueva ficha" activeId="fichas">
                    <ListingForm />
                  </AdminShell>
                </div>
              </Card>
            </Subsection>
          </section>

          {/* MOTION */}
          <section id="motion" className="scroll-mt-20">
            <SectionTitle eyebrow="04" title="Motion" />
            <p className="text-[var(--text-secondary)] max-w-prose">
              Las animaciones del sistema están definidas como tokens en globals.css y
              respetan <code className="font-mono text-[var(--text-xs)] bg-[var(--surface-sunken)] px-1 rounded">prefers-reduced-motion</code>.
              Para verlas en vivo: hover sobre cards, abrir un select, focus en
              inputs. La micro-interacción del badge Verificado vive directo en el
              componente y se dispara con hover (escala del shield + tooltip).
            </p>
          </section>

          {/* COMBINATIONS */}
          <section id="combinations" className="scroll-mt-20">
            <SectionTitle eyebrow="05" title="Reglas de combinación" />
            <ul className="flex flex-col gap-3 text-[var(--text-sm)] text-[var(--text-secondary)] max-w-prose leading-[var(--leading-normal)]">
              <li><strong className="text-[var(--text-primary)]">Button primary:</strong> una sola por pantalla. La acción que el usuario más probablemente quiere hacer.</li>
              <li><strong className="text-[var(--text-primary)]">Button destructive:</strong> solo dentro de un Dialog de confirmación, nunca como CTA suelta.</li>
              <li><strong className="text-[var(--text-primary)]">Card vs Dialog:</strong> Card si el contenido convive con la página; Dialog si pausa el flujo y exige decisión.</li>
              <li><strong className="text-[var(--text-primary)]">Tier badges:</strong> SOLO sobre ListingCard. Si aparecen fuera, pierden significado.</li>
              <li><strong className="text-[var(--text-primary)]">VerifiedBadge:</strong> en la esquina superior derecha de la imagen del listing. En la ficha individual, junto al nombre del lugar.</li>
              <li><strong className="text-[var(--text-primary)]">Densidad:</strong> público es <code>data-density=&quot;comfortable&quot;</code> (default). Admin es <code>data-density=&quot;compact&quot;</code> seteado por AdminShell — todo lo de adentro se reduce solo.</li>
            </ul>
          </section>
        </main>
      </div>
    </TooltipProvider>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="border-b border-[var(--border-subtle)] pb-3 mb-6">
      <div className="text-[10px] font-display uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
        {eyebrow}
      </div>
      <h2 className="font-display text-[var(--text-3xl)] font-semibold tracking-[var(--tracking-tight)] mt-1">
        {title}
      </h2>
    </div>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h3 className="font-display text-[var(--text-md)] font-semibold mb-4 text-[var(--text-primary)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Swatch({ name, cssVar }: { name: string; cssVar: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-16 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)]"
        style={{ background: `var(${cssVar})` }}
      />
      <code className="text-[10px] font-mono text-[var(--text-muted)]">{name}</code>
    </div>
  );
}

function TypeRow({ size, label, children }: { size: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid md:grid-cols-[140px_1fr] gap-3 items-baseline">
      <div className="text-[10px] font-mono uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
        {size} <span className="block normal-case tracking-normal opacity-70">{label}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}
