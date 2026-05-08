import * as React from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/components/ui";
import { FooterLocaleSwitcher } from "./FooterLocaleSwitcher";

/**
 * PublicFooter — sobrio, editorial. 4 columnas en desktop. Server
 * Component: solo Links + texto, ningún estado. El selector de
 * idioma vive en `FooterLocaleSwitcher` (client) que se monta acá.
 */
export async function PublicFooter({ className }: { className?: string }) {
  const t = await getTranslations("Footer");
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "border-t border-[var(--border-subtle)] bg-[var(--surface-base)]",
        "mt-20",
        className
      )}
    >
      <div className="mx-auto max-w-7xl px-6 py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="font-display text-[var(--text-xl)] font-semibold tracking-[var(--tracking-tight)] flex items-center gap-2">
            <span className="h-7 w-7 rounded-[var(--radius-sm)] bg-[var(--brand-primary)] text-[var(--brand-primary-fg)] grid place-items-center text-[var(--text-sm)] font-bold">
              V
            </span>
            ViajarPaís
          </div>
          <p className="mt-3 text-[var(--text-sm)] text-[var(--text-secondary)] leading-[var(--leading-normal)]">
            {t("brandDescription")}
          </p>
        </div>

        <FooterColumn
          title={t("regions")}
          items={[
            ["Cuyo", "/cuyo"],
            ["NOA", "/noa"],
            ["NEA", "/nea"],
            ["Patagonia", "/patagonia"],
            ["Pampeana", "/pampeana"],
            ["Centro", "/centro"],
          ]}
        />
        <FooterColumn
          title={t("explore")}
          items={[
            [t("exploreItems.alojamientos"), "/categoria/alojamientos"],
            [t("exploreItems.gastronomia"), "/categoria/restaurantes"],
            [t("exploreItems.excursiones"), "/categoria/excursiones"],
            [t("exploreItems.sitiosDeInteres"), "/categoria/sitios-de-interes"],
            [t("exploreItems.eventos"), "/categoria/eventos"],
          ]}
        />
        <FooterColumn
          title={t("about")}
          items={[
            [t("aboutItems.proyecto"), "/sobre"],
            [t("aboutItems.verificacion"), "/verificacion"],
            [t("aboutItems.paraComerciantes"), "/comerciantes"],
            [t("aboutItems.terminos"), "/legal/terminos"],
            [t("aboutItems.privacidad"), "/legal/privacidad"],
          ]}
        />
      </div>

      <div className="border-t border-[var(--border-subtle)]">
        <div className="mx-auto max-w-7xl px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-[var(--text-xs)] text-[var(--text-muted)]">
            {t("copyright", { year })}
          </div>
          <FooterLocaleSwitcher />
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  items,
}: {
  title: string;
  items: [string, string][];
}) {
  return (
    <div>
      <div className="text-[10px] font-display uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)] mb-3">
        {title}
      </div>
      <ul className="flex flex-col gap-2">
        {items.map(([label, href]) => (
          <li key={href}>
            <Link
              href={href}
              className="text-[var(--text-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-[var(--duration-fast)]"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
