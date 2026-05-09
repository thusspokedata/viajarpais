import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui";

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * Página servida cuando un usuario logueado intenta acceder a una sección
 * del admin sin el rol requerido (típicamente MERCHANT yendo a
 * `/admin/listings`). El layout `(admin)` redirige acá.
 *
 * Esta page vive en el route group `(admin-auth)`, NO en `(admin)`, así
 * que NO hereda el `requireRole` del layout admin. Razón: si estuviera
 * adentro del layout gateado, el redirect causaría un loop infinito
 * (MERCHANT → access-denied → layout valida → redirige a access-denied).
 */
export default async function AccessDeniedPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const homeHref = locale === "es" ? "/" : `/${locale}`;

  return (
    <div className="mx-auto max-w-md flex flex-col items-center text-center gap-6 py-12">
      <span
        aria-hidden
        className="grid place-items-center h-14 w-14 rounded-[var(--radius-pill)] bg-[var(--warning-bg)] text-[var(--warning-fg)]"
      >
        <Lock className="h-6 w-6" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[var(--text-2xl)] font-semibold tracking-[var(--tracking-tight)] text-[var(--text-primary)]">
          Acceso restringido
        </h1>
        <p className="text-[var(--text-secondary)] text-[var(--text-base)] leading-[var(--leading-snug)]">
          Tu cuenta no tiene permisos para esta sección del panel.
          Si pensás que se trata de un error, hablá con quien administra
          el directorio.
        </p>
      </div>
      <Link
        href={homeHref}
        className={buttonVariants({ variant: "secondary" })}
      >
        Ir al inicio
      </Link>
    </div>
  );
}
