"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Badge, Button, cn } from "@/components/ui";
import {
  publishListing,
  unpublishListing,
  archiveListing,
  restoreListing,
  verifyListing,
  unverifyListing,
} from "@/server/actions/listings/lifecycle";

type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type Tier = "FREE" | "PAID" | "FEATURED";

const STATUS_LABEL: Record<Status, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicada",
  ARCHIVED: "Archivada",
};

const TIER_LABEL: Record<Tier, string> = {
  FREE: "Free",
  PAID: "Paga",
  FEATURED: "Destacada",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function StatusSection({
  listingId,
  status,
  tier,
  verifiedAt,
  verifiedUntil,
  archivedAt,
}: {
  listingId: string;
  status: Status;
  tier: Tier;
  verifiedAt: string | null;
  verifiedUntil: string | null;
  archivedAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      /*
        Wrap en try/catch: aunque las lifecycle actions ahora devuelven
        `LifecycleResult` en vez de throw (ver `fix(db): lifecycle ...`),
        un fallo de red o una excepción inesperada del servidor todavía
        puede surgir. Sin este catch, el thrown error queda silencioso
        para el editor — la UI vuelve al estado idle como si nada hubiera
        pasado.
      */
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.message ?? "No se pudo completar la acción.");
          return;
        }
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Error inesperado. Probá de nuevo.",
        );
      }
    });
  }

  const isVerified = Boolean(verifiedAt);
  const verifiedClass = isVerified
    ? "border-[var(--verified-ring)] bg-[var(--verified-bg)] text-[var(--verified-fg)]"
    : "border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-secondary)]";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <StatusTile label="Estado" value={STATUS_LABEL[status]}>
          <Badge
            variant={
              status === "PUBLISHED"
                ? "success"
                : status === "ARCHIVED"
                  ? "default"
                  : "warning"
            }
            size="sm"
          >
            {STATUS_LABEL[status]}
          </Badge>
        </StatusTile>
        <StatusTile label="Tier" value={TIER_LABEL[tier]}>
          <Badge
            variant={
              tier === "FEATURED"
                ? "tier-featured"
                : tier === "PAID"
                  ? "tier-paid"
                  : "tier-free"
            }
            size="sm"
          >
            {TIER_LABEL[tier]}
          </Badge>
        </StatusTile>
        <StatusTile label="Verificación" value={isVerified ? "Activa" : "Sin verificar"}>
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 h-6 rounded-[var(--radius-pill)] border text-[var(--text-xs)] font-medium",
              verifiedClass,
            )}
          >
            <ShieldCheck className="h-3 w-3" />
            {isVerified ? "Verificada" : "Sin verificar"}
          </span>
        </StatusTile>
      </div>

      {isVerified && verifiedUntil ? (
        <p className="text-[var(--text-xs)] text-[var(--text-muted)]">
          Verificación válida hasta el <strong>{formatDate(verifiedUntil)}</strong>.
        </p>
      ) : null}
      {status === "ARCHIVED" && archivedAt ? (
        <p className="text-[var(--text-xs)] text-[var(--text-muted)]">
          Archivada el <strong>{formatDate(archivedAt)}</strong>.
        </p>
      ) : null}

      {error ? (
        <div className="text-[var(--text-xs)] text-[var(--danger-fg)]">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => run(() => publishListing(listingId))}
          >
            Publicar
          </Button>
        ) : null}
        {status === "PUBLISHED" ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => run(() => unpublishListing(listingId))}
          >
            Volver a borrador
          </Button>
        ) : null}
        {status !== "ARCHIVED" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run(() => archiveListing(listingId))}
          >
            Archivar
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => run(() => restoreListing(listingId))}
          >
            Restaurar como borrador
          </Button>
        )}
        {status === "PUBLISHED" && !isVerified ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => run(() => verifyListing(listingId))}
          >
            Marcar como verificada
          </Button>
        ) : null}
        {isVerified ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run(() => unverifyListing(listingId))}
          >
            Quitar verificación
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function StatusTile({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[var(--border-subtle)] rounded-[var(--radius-md)] bg-[var(--surface-canvas)] p-3 flex flex-col gap-1.5">
      <span className="text-[10px] font-display uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
        {label}
      </span>
      <span className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
        {value}
      </span>
      <span className="mt-1">{children}</span>
    </div>
  );
}
