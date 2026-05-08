"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/components/ui";

/**
 * PublicFooter — sobrio, editorial. 4 columnas en desktop.
 */
export function PublicFooter({ className }: { className?: string }) {
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
            Directorio nacional de turismo argentino. Información verificada
            manualmente, sin reseñas falsas.
          </p>
        </div>

        <FooterColumn
          title="Regiones"
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
          title="Explorar"
          items={[
            ["Alojamientos", "/categorias/alojamientos"],
            ["Gastronomía", "/categorias/gastronomia"],
            ["Excursiones", "/categorias/excursiones"],
            ["Sitios de interés", "/categorias/sitios"],
            ["Eventos", "/eventos"],
          ]}
        />
        <FooterColumn
          title="Sobre"
          items={[
            ["El proyecto", "/sobre"],
            ["Verificación", "/verificacion"],
            ["Para comerciantes", "/comerciantes"],
            ["Términos", "/legal/terminos"],
            ["Privacidad", "/legal/privacidad"],
          ]}
        />
      </div>

      <div className="border-t border-[var(--border-subtle)]">
        <div className="mx-auto max-w-7xl px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-[var(--text-xs)] text-[var(--text-muted)]">
            © {new Date().getFullYear()} ViajarPaís — Todos los derechos reservados.
          </div>
          <div className="flex items-center gap-3 text-[var(--text-xs)] text-[var(--text-muted)]">
            <Link href="/es" className="hover:text-[var(--text-primary)]">Español</Link>
            <span aria-hidden>·</span>
            <Link href="/en" className="hover:text-[var(--text-primary)]">English</Link>
            <span aria-hidden>·</span>
            <Link href="/pt-BR" className="hover:text-[var(--text-primary)]">Português</Link>
          </div>
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
