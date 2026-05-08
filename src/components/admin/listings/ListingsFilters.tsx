"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "@/components/ui/icons";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@/components/ui";
import {
  getDepartmentsByProvinceAction,
  getLocalitiesByDepartmentAction,
} from "@/server/actions/geo";
import type {
  CategoryOption,
  DepartmentOption,
  LocalityOption,
  ProvinceOption,
} from "@/components/admin/listing-form/types";

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Borradores" },
  { value: "PUBLISHED", label: "Publicadas" },
  { value: "ARCHIVED", label: "Archivadas" },
] as const;
const TIER_OPTIONS = [
  { value: "FREE", label: "Free" },
  { value: "PAID", label: "Paga" },
  { value: "FEATURED", label: "Destacada" },
] as const;
const VERIFIED_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "yes", label: "Solo verificadas" },
  { value: "no", label: "Solo sin verificar" },
] as const;

/**
 * Filtros del listado. Estado vive en URL search params (shareable +
 * bookmarkable + back button friendly). Cada cambio dispara
 * `router.push(?...)` que el server component re-lee para volver a
 * fetchear el listado.
 */
export function ListingsFilters({
  provinces,
  initialDepartments,
  initialLocalities,
  categories,
}: {
  provinces: ProvinceOption[];
  initialDepartments: DepartmentOption[];
  initialLocalities: LocalityOption[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTx] = React.useTransition();

  const search = searchParams.get("search") ?? "";
  const provinceId = searchParams.get("provinceId") ?? "";
  const departmentId = searchParams.get("departmentId") ?? "";
  const localityId = searchParams.get("localityId") ?? "";
  const categoryId = searchParams.get("categoryId") ?? "";
  const verified = (searchParams.get("verified") as "yes" | "no" | "all" | null) ?? "all";
  const statusList = searchParams.getAll("status");
  const tierList = searchParams.getAll("tier");

  const [departments, setDepartments] =
    React.useState<DepartmentOption[]>(initialDepartments);
  const [localities, setLocalities] =
    React.useState<LocalityOption[]>(initialLocalities);

  function navigate(updater: (params: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams.toString());
    updater(next);
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `/admin/listings?${qs}` : "/admin/listings");
  }

  function setSingle(key: string, value: string | null) {
    navigate((p) => {
      if (value === null || value === "") p.delete(key);
      else p.set(key, value);
    });
  }

  function toggleMulti(key: string, value: string) {
    navigate((p) => {
      const all = p.getAll(key);
      p.delete(key);
      if (all.includes(value)) {
        all.filter((v) => v !== value).forEach((v) => p.append(key, v));
      } else {
        [...all, value].forEach((v) => p.append(key, v));
      }
    });
  }

  function selectProvince(value: string) {
    if (value === provinceId) return;
    navigate((p) => {
      if (value) p.set("provinceId", value);
      else p.delete("provinceId");
      p.delete("departmentId");
      p.delete("localityId");
    });
    setDepartments([]);
    setLocalities([]);
    if (!value) return;
    startTx(async () => {
      const next = await getDepartmentsByProvinceAction(value);
      setDepartments(next);
    });
  }

  function selectDepartment(value: string) {
    if (value === departmentId) return;
    navigate((p) => {
      if (value) p.set("departmentId", value);
      else p.delete("departmentId");
      p.delete("localityId");
    });
    setLocalities([]);
    if (!value) return;
    startTx(async () => {
      const next = await getLocalitiesByDepartmentAction(value);
      setLocalities(next);
    });
  }

  function clearAll() {
    router.push("/admin/listings");
  }

  const anyActive =
    Boolean(search) ||
    Boolean(provinceId) ||
    Boolean(departmentId) ||
    Boolean(localityId) ||
    Boolean(categoryId) ||
    verified !== "all" ||
    statusList.length > 0 ||
    tierList.length > 0;

  return (
    <div className="flex flex-col gap-3 p-4 border border-[var(--border-subtle)] rounded-[var(--radius-lg)] bg-[var(--surface-base)]">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <form
          key={search}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const next = String(fd.get("search") ?? "").trim();
            setSingle("search", next || null);
          }}
        >
          <Input
            name="search"
            defaultValue={search}
            placeholder="Buscar por nombre…"
            leadingIcon={<Search className="h-4 w-4" />}
          />
        </form>

        <Select value={provinceId || "all"} onValueChange={(v) => selectProvince(v === "all" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Todas las provincias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las provincias</SelectItem>
            {provinces.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={departmentId || "all"}
          onValueChange={(v) => selectDepartment(v === "all" ? "" : v)}
          disabled={!provinceId}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={provinceId ? "Todos los departamentos" : "—"}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los departamentos</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={localityId || "all"}
          onValueChange={(v) => setSingle("localityId", v === "all" ? null : v)}
          disabled={!departmentId}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={departmentId ? "Todas las localidades" : "—"}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las localidades</SelectItem>
            {localities.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Select
          value={categoryId || "all"}
          onValueChange={(v) => setSingle("categoryId", v === "all" ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nameEs}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={verified}
          onValueChange={(v) =>
            setSingle("verified", v === "all" ? null : v)
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VERIFIED_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center justify-end gap-2 sm:col-span-2 lg:col-span-1">
          {anyActive ? (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-display uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
          Estado
        </span>
        {STATUS_OPTIONS.map((opt) => {
          const active = statusList.includes(opt.value);
          return (
            <Toggle
              key={opt.value}
              active={active}
              onClick={() => toggleMulti("status", opt.value)}
            >
              {opt.label}
            </Toggle>
          );
        })}
        <span className="text-[10px] font-display uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)] ml-2">
          Tier
        </span>
        {TIER_OPTIONS.map((opt) => {
          const active = tierList.includes(opt.value);
          return (
            <Toggle
              key={opt.value}
              active={active}
              onClick={() => toggleMulti("tier", opt.value)}
            >
              {opt.label}
            </Toggle>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center px-2.5 h-7 rounded-[var(--radius-pill)]",
        "text-[var(--text-xs)] font-medium border transition-colors",
        "focus:outline-none focus-visible:shadow-[var(--shadow-focus)]",
        active
          ? "bg-[var(--brand-muted)] border-[var(--brand-primary)] text-[var(--brand-muted-fg)]"
          : "bg-[var(--surface-base)] border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]",
      )}
    >
      {children}
    </button>
  );
}
