import Link from "next/link";
import { ShieldCheck } from "@/components/ui/icons";
import { Badge, EmptyState } from "@/components/ui";

type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type Tier = "FREE" | "PAID" | "FEATURED";

const STATUS_LABEL: Record<Status, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicada",
  ARCHIVED: "Archivada",
};

const STATUS_VARIANT: Record<Status, "warning" | "success" | "default"> = {
  DRAFT: "warning",
  PUBLISHED: "success",
  ARCHIVED: "default",
};

const TIER_LABEL: Record<Tier, string> = {
  FREE: "Free",
  PAID: "Paga",
  FEATURED: "Destacada",
};

export type ListingRow = {
  id: string;
  name: string;
  slug: string;
  status: Status;
  tier: Tier;
  verifiedAt: Date | null;
  verifiedUntil: Date | null;
  updatedAt: Date;
  locality: { id: string; name: string };
  province: { id: string; name: string };
  categories: {
    isPrimary: boolean;
    category: { id: string; slug: string; nameEs: string; nameSingularEs: string };
  }[];
};

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `hace ${sec} s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} d`;
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ListingsTable({ items }: { items: ListingRow[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No hay fichas que coincidan con estos filtros"
        description="Probá ajustar los filtros, o creá una nueva ficha."
      />
    );
  }

  return (
    <div className="border border-[var(--border-subtle)] rounded-[var(--radius-lg)] overflow-hidden bg-[var(--surface-base)]">
      <table className="w-full text-[var(--text-sm)]">
        <thead className="bg-[var(--surface-sunken)] text-[var(--text-secondary)]">
          <tr>
            <Th>Nombre</Th>
            <Th>Categoría</Th>
            <Th>Localidad</Th>
            <Th>Estado</Th>
            <Th>Tier</Th>
            <Th>Verificada</Th>
            <Th>Última edición</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const primary = row.categories.find((c) => c.isPrimary);
            return (
              <tr
                key={row.id}
                className="border-t border-[var(--border-subtle)] hover:bg-[var(--surface-sunken)]/50"
              >
                <Td>
                  <Link
                    href={`/admin/listings/${row.id}`}
                    className="font-medium text-[var(--text-primary)] hover:text-[var(--text-link)]"
                  >
                    {row.name}
                  </Link>
                  <div className="text-[var(--text-xs)] text-[var(--text-muted)] font-mono mt-0.5">
                    /{row.slug}
                  </div>
                </Td>
                <Td>
                  {primary ? (
                    <span className="text-[var(--text-secondary)]">
                      {primary.category.nameSingularEs}
                    </span>
                  ) : (
                    <span className="text-[var(--text-muted)]">—</span>
                  )}
                </Td>
                <Td>
                  <div className="text-[var(--text-secondary)]">
                    {row.locality.name}
                  </div>
                  <div className="text-[var(--text-xs)] text-[var(--text-muted)]">
                    {row.province.name}
                  </div>
                </Td>
                <Td>
                  <Badge variant={STATUS_VARIANT[row.status]} size="sm">
                    {STATUS_LABEL[row.status]}
                  </Badge>
                </Td>
                <Td>
                  <Badge
                    variant={
                      row.tier === "FEATURED"
                        ? "tier-featured"
                        : row.tier === "PAID"
                          ? "tier-paid"
                          : "tier-free"
                    }
                    size="sm"
                  >
                    {TIER_LABEL[row.tier]}
                  </Badge>
                </Td>
                <Td>
                  {row.verifiedAt ? (
                    <div className="inline-flex items-center gap-1 text-[var(--verified-fg)]">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span className="text-[var(--text-xs)]">
                        {row.verifiedUntil
                          ? `Vence ${formatDate(row.verifiedUntil)}`
                          : "Verificada"}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
                      Sin verificar
                    </span>
                  )}
                </Td>
                <Td className="text-[var(--text-muted)] text-[var(--text-xs)]">
                  {formatRelative(row.updatedAt)}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left font-medium px-4 py-2.5 text-[10px] font-display uppercase tracking-[var(--tracking-caps)]">
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-top ${className ?? ""}`}>{children}</td>;
}
