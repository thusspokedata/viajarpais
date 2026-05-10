import Link from "next/link";
import { ChevronRight } from "@/components/ui/icons";
import { listRegionsWithStats } from "@/server/data/geo/regions";

/*
  /admin/geo — landing del modulo geografico.

  Muestra las 6 regiones con stats (provincias, departamentos,
  localidades, fichas adentro). Cada card linkea a la edicion de la
  region.

  Acceso a otros niveles via la sidebar admin (NO implementada en
  v0.3-geo-a — el editor entra escribiendo /admin/geo/provinces, etc.,
  o navegando desde el landing). El AdminShell con sidebar persistente
  llega cuando se polish el chrome admin.
*/
export default async function GeoLandingPage() {
  const regions = await listRegionsWithStats();

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      <header>
        <h1 className="font-display text-[var(--text-2xl)] sm:text-[var(--text-3xl)] font-semibold tracking-[var(--tracking-tight)] text-[var(--text-primary)]">
          Geografía
        </h1>
        <p className="text-[var(--text-sm)] text-[var(--text-secondary)] mt-1">
          Contenido editorial de las 6 regiones, 24 provincias, ~530
          departamentos y ~3.350 localidades. Empezá por la región y
          bajá nivel por nivel.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        <SubNavLink href="/admin/geo/provinces" label="Provincias" />
        <SubNavLink href="/admin/geo/departments" label="Departamentos" />
        <SubNavLink href="/admin/geo/localities" label="Localidades" />
      </nav>

      <section>
        <h2 className="font-display text-[var(--text-xl)] font-semibold text-[var(--text-primary)] mb-3">
          Regiones
        </h2>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {regions.map((r) => (
            <li key={r.code}>
              <Link
                href={`/admin/geo/regions/${r.code}`}
                className="group block border border-[var(--border-subtle)] rounded-[var(--radius-lg)] bg-[var(--surface-base)] p-4 hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-[var(--text-md)] font-semibold text-[var(--text-primary)]">
                      {r.nameEs}
                    </h3>
                    <p className="text-[var(--text-xs)] text-[var(--text-muted)] font-mono mt-0.5">
                      {r.code}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] shrink-0" />
                </div>

                {r.taglineEs ? (
                  <p className="mt-2 text-[var(--text-sm)] text-[var(--text-secondary)] line-clamp-2">
                    {r.taglineEs}
                  </p>
                ) : (
                  <p className="mt-2 text-[var(--text-xs)] text-[var(--text-muted)] italic">
                    Sin tagline. Click para editar.
                  </p>
                )}

                <dl className="mt-3 grid grid-cols-4 gap-2 text-[var(--text-xs)]">
                  <Stat label="Prov." value={r.counts.provinces} />
                  <Stat label="Deptos" value={r.counts.departments} />
                  <Stat label="Locs." value={r.counts.localities} />
                  <Stat label="Fichas" value={r.counts.listings} />
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SubNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-base)] text-[var(--text-sm)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] transition-colors"
    >
      {label}
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] font-display uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
        {label}
      </dt>
      <dd className="font-mono text-[var(--text-sm)] text-[var(--text-primary)]">
        {value.toLocaleString("es-AR")}
      </dd>
    </div>
  );
}
