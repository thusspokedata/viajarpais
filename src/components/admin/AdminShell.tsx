"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  Bell,
  Plus,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  Close,
  LayoutGrid,
  List,
  MapPin,
  Calendar,
  ShieldCheck,
  Layers,
} from "@/components/ui/icons";
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  cn,
} from "@/components/ui";

/**
 * AdminShell — layout principal del panel admin.
 *
 * Crítico: lo usa un editor no-programador todas horas todos los días.
 * Diseño: sidebar izquierda colapsable, topbar con search global, área
 * principal. Mobile: sidebar como drawer.
 *
 * Densidad: el shell setea data-density="compact" en su root para que
 * todos los inputs/buttons internos achiquen automáticamente sin que
 * cada componente del admin tenga que pasarse `size="sm"`.
 */

type NavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  badge?: string | number;
};

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Catálogo",
    items: [
      { id: "fichas", label: "Fichas", icon: <List className="h-4 w-4" />, badge: 142 },
      { id: "categorias", label: "Categorías", icon: <Layers className="h-4 w-4" /> },
      { id: "regiones", label: "Geografía", icon: <MapPin className="h-4 w-4" /> },
      { id: "eventos", label: "Eventos", icon: <Calendar className="h-4 w-4" /> },
    ],
  },
  {
    section: "Operación",
    items: [
      { id: "verificacion", label: "Verificaciones", icon: <ShieldCheck className="h-4 w-4" />, badge: 7 },
      { id: "vista", label: "Vista pública", icon: <LayoutGrid className="h-4 w-4" /> },
    ],
  },
];

export interface AdminShellProps {
  children: React.ReactNode;
  /** Item actualmente activo (id) */
  activeId?: string;
  /** Nombre del editor logueado */
  userName?: string;
  /** Email del editor */
  userEmail?: string;
  /** Título del breadcrumb / página */
  pageTitle?: string;
  /** Acciones a la derecha del topbar */
  actions?: React.ReactNode;
  className?: string;
}

export function AdminShell({
  children,
  activeId = "fichas",
  userName = "Camila Soria",
  userEmail = "camila@viajarpais.com.ar",
  pageTitle = "Fichas",
  actions,
  className,
}: AdminShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div
      data-density="compact"
      className={cn(
        "min-h-screen bg-[var(--surface-canvas)] text-[var(--text-primary)]",
        "grid",
        collapsed ? "md:grid-cols-[64px_1fr]" : "md:grid-cols-[244px_1fr]",
        "transition-[grid-template-columns] duration-[var(--duration-base)] ease-[var(--ease-standard)]",
        className
      )}
    >
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:sticky inset-y-0 left-0 top-0 z-40",
          "bg-[var(--surface-base)] border-r border-[var(--border-subtle)]",
          "h-screen flex flex-col",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          "transition-transform duration-[var(--duration-base)] ease-[var(--ease-emphasized)]",
          "w-[244px]",
          collapsed && "md:w-16"
        )}
      >
        {/* Logo / brand */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-[var(--border-subtle)]">
          <Link href="/admin" className="flex items-center gap-2 font-display font-semibold tracking-tight text-[var(--text-md)]">
            <span
              aria-hidden
              className="h-7 w-7 rounded-[var(--radius-sm)] bg-[var(--brand-primary)] text-[var(--brand-primary-fg)] grid place-items-center text-[var(--text-sm)] font-bold"
            >
              V
            </span>
            <span className={cn(collapsed ? "md:hidden" : "block")}>ViajarPaís</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="md:hidden h-8 w-8 grid place-items-center rounded-[var(--radius-sm)] hover:bg-[var(--surface-sunken)]"
            aria-label="Cerrar menú"
          >
            <Close className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV.map((section) => (
            <div key={section.section} className="mb-4">
              <div
                className={cn(
                  "px-2 mb-1 text-[10px] font-display uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]",
                  collapsed && "md:hidden"
                )}
              >
                {section.section}
              </div>
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = item.id === activeId;
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href ?? `#${item.id}`}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group flex items-center gap-2.5 px-2 h-8 rounded-[var(--radius-sm)]",
                          "text-[var(--text-sm)] font-medium",
                          "transition-[background-color,color] duration-[var(--duration-fast)]",
                          active
                            ? "bg-[var(--brand-muted)] text-[var(--brand-muted-fg)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
                        )}
                      >
                        <span className="shrink-0">{item.icon}</span>
                        <span
                          className={cn(
                            "flex-1 truncate",
                            collapsed && "md:hidden"
                          )}
                        >
                          {item.label}
                        </span>
                        {item.badge !== undefined && !collapsed ? (
                          <span
                            className={cn(
                              "text-[10px] px-1.5 h-4 inline-flex items-center rounded-[var(--radius-xs)]",
                              active
                                ? "bg-[var(--surface-base)] text-[var(--brand-muted-fg)]"
                                : "bg-[var(--surface-sunken)] text-[var(--text-muted)]"
                            )}
                          >
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Sidebar footer: collapse toggle + user mini */}
        <div className="border-t border-[var(--border-subtle)] p-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              "hidden md:flex items-center gap-2 w-full px-2 h-8 rounded-[var(--radius-sm)]",
              "text-[var(--text-xs)] text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]",
              "transition-colors"
            )}
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-[var(--duration-base)]",
                collapsed ? "-rotate-90" : "rotate-90"
              )}
            />
            <span className={cn(collapsed && "md:hidden")}>Colapsar</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen ? (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-[var(--surface-overlay)] md:hidden"
        />
      ) : null}

      {/* Main column */}
      <div className="min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-20 h-14 bg-[var(--surface-base)] border-b border-[var(--border-subtle)] flex items-center gap-3 px-4 md:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden h-8 w-8 grid place-items-center rounded-[var(--radius-sm)] hover:bg-[var(--surface-sunken)]"
            aria-label="Abrir menú"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[var(--text-xs)] text-[var(--text-muted)] hidden md:inline">
              Admin
            </span>
            <span className="text-[var(--text-xs)] text-[var(--text-muted)] hidden md:inline">/</span>
            <h1 className="font-display font-semibold tracking-[var(--tracking-tight)] text-[var(--text-md)] truncate">
              {pageTitle}
            </h1>
          </div>

          <div className="flex-1" />

          <div className="hidden lg:block w-72">
            <Input
              placeholder="Buscar fichas, comerciantes, lugares…"
              leadingIcon={<Search className="h-4 w-4" />}
            />
          </div>

          {actions ?? (
            <Button size="sm" leadingIcon={<Plus className="h-4 w-4" />}>
              Nueva ficha
            </Button>
          )}

          <button
            type="button"
            aria-label="Notificaciones"
            className="relative h-8 w-8 grid place-items-center rounded-[var(--radius-sm)] hover:bg-[var(--surface-sunken)] text-[var(--text-secondary)]"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[var(--danger-fg)]" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 h-8 px-2 rounded-[var(--radius-sm)] hover:bg-[var(--surface-sunken)] transition-colors focus:outline-none focus-visible:shadow-[var(--shadow-focus)]">
              <Avatar size="sm">
                <AvatarFallback>
                  {userName
                    .split(" ")
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:block text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                {userName.split(" ")[0]}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)] hidden md:block" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[220px]">
              <DropdownMenuLabel>{userName}</DropdownMenuLabel>
              <div className="px-2 pb-1.5 text-[var(--text-xs)] text-[var(--text-muted)]">{userEmail}</div>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="h-4 w-4" /> Preferencias
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive>
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
