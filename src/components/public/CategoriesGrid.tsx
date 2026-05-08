import { Link } from "@/i18n/navigation";
import {
  Bed,
  UtensilsCrossed,
  Mountain,
  Compass,
  Briefcase,
  CalendarDays,
  MapPin,
  Bus,
  ShoppingBag,
  Waves,
  Layers,
} from "@/components/ui/icons";
import { Card } from "@/components/ui";

export type CategoryCardData = {
  slug: string;
  name: string;
};

export interface CategoriesGridProps {
  categories: CategoryCardData[];
}

const ICON_BY_SLUG: Record<string, React.ComponentType<{ className?: string }>> = {
  alojamientos: Bed,
  restaurantes: UtensilsCrossed,
  excursiones: Mountain,
  "guias-habilitados": Compass,
  agencias: Briefcase,
  eventos: CalendarDays,
  "sitios-de-interes": MapPin,
  terminales: Bus,
  "tiendas-artesanales": ShoppingBag,
  "spas-termas": Waves,
};

export function CategoriesGrid({ categories }: CategoriesGridProps) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {categories.map((c) => {
        const Icon = ICON_BY_SLUG[c.slug] ?? Layers;
        return (
          <Link
            key={c.slug}
            href={`/categoria/${c.slug}`}
            className="group block focus:outline-none focus-visible:[&>*]:shadow-[var(--shadow-focus)]"
          >
            <Card
              variant="interactive"
              className="p-5 h-full flex flex-col items-start gap-3"
            >
              <span
                aria-hidden
                className="grid place-items-center h-10 w-10 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] text-[var(--text-secondary)] transition-colors group-hover:bg-[var(--brand-muted)] group-hover:text-[var(--brand-muted-fg)]"
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="font-display text-[var(--text-md)] sm:text-[var(--text-lg)] font-semibold leading-[var(--leading-tight)] tracking-[var(--tracking-tight)] text-[var(--text-primary)]">
                {c.name}
              </span>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
