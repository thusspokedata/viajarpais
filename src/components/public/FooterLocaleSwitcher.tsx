"use client";

import * as React from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/components/ui";

/*
  Endónimos: cada idioma se muestra en su propia lengua, no se
  traduce. Esa es la convención usual para selectores de locale.
*/
const LOCALES = [
  { id: "es", label: "Español" },
  { id: "en", label: "English" },
  { id: "pt-BR", label: "Português" },
] as const;

type LocaleId = (typeof LOCALES)[number]["id"];

export function FooterLocaleSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(next: LocaleId) {
    router.replace(pathname, { locale: next });
  }

  return (
    <div className={cn("flex items-center gap-3 text-[var(--text-xs)] text-[var(--text-muted)]", className)}>
      {LOCALES.map((l, i) => (
        <React.Fragment key={l.id}>
          {i > 0 ? <span aria-hidden>·</span> : null}
          <button
            type="button"
            onClick={() => switchLocale(l.id)}
            className="hover:text-[var(--text-primary)] transition-colors duration-[var(--duration-fast)] focus:outline-none focus-visible:shadow-[var(--shadow-focus)] rounded-[var(--radius-xs)]"
          >
            {l.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
