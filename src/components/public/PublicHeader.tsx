"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Menu, Globe, Close, ChevronDown } from "@/components/ui/icons";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from "@/components/ui";
import { SearchBar } from "./SearchBar";
import { REGIONS } from "./RegionFilter";

/**
 * PublicHeader — barra superior pública.
 * Logo placeholder (wordmark Fraunces) + nav de regiones + search +
 * switcher idioma + CTA secundaria. Mobile: hamburguesa con drawer.
 */

const LOCALES = [
  { id: "es", label: "Español" },
  { id: "en", label: "English" },
  { id: "pt-BR", label: "Português (BR)" },
] as const;

type LocaleId = (typeof LOCALES)[number]["id"];

export interface PublicHeaderProps {
  className?: string;
}

export function PublicHeader({ className }: PublicHeaderProps) {
  const t = useTranslations("Header");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const currentLocale = LOCALES.find((l) => l.id === locale) ?? LOCALES[0];

  function switchLocale(next: LocaleId) {
    router.replace(pathname, { locale: next });
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-30 bg-[var(--surface-base)]/85 backdrop-blur-md",
        "border-b border-[var(--border-subtle)]",
        className
      )}
    >
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        {/* Top row: logo + actions */}
        <div className="flex items-center justify-between gap-4 h-16">
          <Link
            href="/"
            className="font-display text-[var(--text-xl)] font-semibold tracking-[var(--tracking-tight)] text-[var(--text-primary)] flex items-center gap-2"
          >
            <span
              aria-hidden
              className="h-7 w-7 rounded-[var(--radius-sm)] bg-[var(--brand-primary)] text-[var(--brand-primary-fg)] grid place-items-center text-[var(--text-sm)] font-bold"
            >
              V
            </span>
            ViajarPaís
          </Link>

          {/* Desktop: search center */}
          <div className="hidden lg:flex flex-1 max-w-xl mx-6">
            <SearchBar placeholder={t("searchPlaceholder")} />
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" leadingIcon={<Globe className="h-4 w-4" />} trailingIcon={<ChevronDown className="h-3.5 w-3.5" />}>
                  <span className="hidden sm:inline">{currentLocale.label}</span>
                  <span className="sm:hidden uppercase">{currentLocale.id}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {LOCALES.map((l) => (
                  <DropdownMenuItem key={l.id} onClick={() => switchLocale(l.id)}>
                    {l.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="sm" className="hidden md:inline-flex">
              {t("forBusinesses")}
            </Button>
            <Button size="sm" className="hidden md:inline-flex">
              {t("signIn")}
            </Button>

            <button
              type="button"
              aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
              aria-expanded={mobileOpen}
              aria-controls="public-header-mobile-drawer"
              onClick={() => setMobileOpen((o) => !o)}
              className="lg:hidden h-10 w-10 grid place-items-center rounded-[var(--radius-md)] hover:bg-[var(--surface-sunken)] transition-colors"
            >
              {mobileOpen ? <Close className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Region nav (desktop) */}
        <nav className="hidden lg:flex items-center gap-1 h-11 -mt-px">
          {REGIONS.filter((r) => r.id !== "all").map((r) => (
            <Link
              key={r.id}
              href={`/${r.id}`}
              className={cn(
                "px-3 h-9 inline-flex items-center rounded-[var(--radius-md)]",
                "text-[var(--text-sm)] font-medium text-[var(--text-secondary)]",
                "hover:text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]",
                "transition-colors duration-[var(--duration-fast)]"
              )}
            >
              {r.label}
            </Link>
          ))}
          <span className="mx-2 h-5 w-px bg-[var(--border-subtle)]" />
          <Link
            href="/categorias"
            className={cn(
              "px-3 h-9 inline-flex items-center rounded-[var(--radius-md)]",
              "text-[var(--text-sm)] font-medium text-[var(--text-secondary)]",
              "hover:text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]",
              "transition-colors duration-[var(--duration-fast)]"
            )}
          >
            {t("categories")}
          </Link>
          <Link
            href="/sobre"
            className={cn(
              "px-3 h-9 inline-flex items-center rounded-[var(--radius-md)]",
              "text-[var(--text-sm)] font-medium text-[var(--text-secondary)]",
              "hover:text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]",
              "transition-colors duration-[var(--duration-fast)]"
            )}
          >
            {t("about")}
          </Link>
        </nav>
      </div>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div
          id="public-header-mobile-drawer"
          className="lg:hidden border-t border-[var(--border-subtle)] bg-[var(--surface-base)] animate-[vp-fade-in_var(--duration-base)_var(--ease-decelerate)]"
        >
          <div className="px-4 py-4 flex flex-col gap-3">
            <SearchBar placeholder={t("searchPlaceholder")} />
            <div className="text-[10px] font-display uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)] mt-2">
              {t("regionsHeading")}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {REGIONS.filter((r) => r.id !== "all").map((r) => (
                <Link
                  key={r.id}
                  href={`/${r.id}`}
                  className="px-3 py-2 rounded-[var(--radius-md)] text-[var(--text-sm)] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                >
                  {r.label}
                </Link>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="secondary" className="flex-1">
                {t("forBusinesses")}
              </Button>
              <Button className="flex-1">{t("signIn")}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
