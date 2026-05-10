"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "@/components/ui/icons";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

/*
  Filtros en cascada para los listados de Departments y Localities.

  Variantes:
  - levels = ["region", "province"] → para departments index.
  - levels = ["region", "province", "department"] → para localities index.

  Cada select abre la lista basada en el filtro padre (los hijos quedan
  disabled si el padre no esta seleccionado). NO hay cargas en cascada
  via server action — la pagina padre pre-fetchea las opciones del
  filtro actual y se las pasa como props. Esto evita el problema de
  race condition que tuvimos en v0.2.a; aca el listado es lo
  suficientemente chico (24 provincias, ~530 deptos) para enviar todo
  de una.

  Cambiar un filtro padre invalida los hijos (los borra del query) y
  resetea `page=1`.
*/

export type GeoOption = { id: string; name: string };

export type CascadeLevel = "region" | "province" | "department";

export type CascadeGeoFiltersProps = {
  basePath: string;
  levels: CascadeLevel[];
  regions: GeoOption[];
  provinces: { id: string; name: string; regionId: string }[];
  departments: {
    id: string;
    name: string;
    provinceId: string;
  }[];
  showSearch?: boolean;
  searchPlaceholder?: string;
};

const PARAM_BY_LEVEL: Record<CascadeLevel, string> = {
  region: "regionId",
  province: "provinceId",
  department: "departmentId",
};

const CHILD_PARAMS_BY_LEVEL: Record<CascadeLevel, string[]> = {
  region: ["provinceId", "departmentId", "page"],
  province: ["departmentId", "page"],
  department: ["page"],
};

export function CascadeGeoFilters(props: CascadeGeoFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const regionId = searchParams.get("regionId") ?? "";
  const provinceId = searchParams.get("provinceId") ?? "";
  const departmentId = searchParams.get("departmentId") ?? "";
  const search = searchParams.get("search") ?? "";

  function navigate(updater: (params: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams.toString());
    updater(next);
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${props.basePath}?${qs}` : props.basePath);
  }

  function setLevel(level: CascadeLevel, value: string) {
    const param = PARAM_BY_LEVEL[level];
    navigate((p) => {
      if (value === "all" || !value) p.delete(param);
      else p.set(param, value);
      // Invalidar todos los hijos
      CHILD_PARAMS_BY_LEVEL[level].forEach((child) => p.delete(child));
    });
  }

  // Provinces y departments filtrados según el padre seleccionado.
  const provincesForRegion = regionId
    ? props.provinces.filter((p) => p.regionId === regionId)
    : props.provinces;
  const departmentsForProvince = provinceId
    ? props.departments.filter((d) => d.provinceId === provinceId)
    : [];

  return (
    <div className="flex flex-col gap-3 p-3 border border-[var(--border-subtle)] rounded-[var(--radius-lg)] bg-[var(--surface-base)]">
      {props.showSearch ? (
        <form
          key={search}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const next = String(fd.get("search") ?? "").trim();
            navigate((p) => {
              if (next) p.set("search", next);
              else p.delete("search");
            });
          }}
        >
          <Input
            name="search"
            defaultValue={search}
            placeholder={props.searchPlaceholder ?? "Buscar por nombre…"}
            leadingIcon={<Search className="h-4 w-4" />}
          />
        </form>
      ) : null}

      <div className="grid sm:grid-cols-3 gap-2">
        {props.levels.includes("region") ? (
          <FilterSelect
            label="Región"
            value={regionId || "all"}
            options={[
              { value: "all", label: "Todas" },
              ...props.regions.map((r) => ({ value: r.id, label: r.name })),
            ]}
            onChange={(v) => setLevel("region", v)}
          />
        ) : null}
        {props.levels.includes("province") ? (
          <FilterSelect
            label="Provincia"
            value={provinceId || "all"}
            options={[
              { value: "all", label: regionId ? "Todas de la región" : "Todas" },
              ...provincesForRegion.map((p) => ({
                value: p.id,
                label: p.name,
              })),
            ]}
            onChange={(v) => setLevel("province", v)}
          />
        ) : null}
        {props.levels.includes("department") ? (
          <FilterSelect
            label="Departamento"
            value={departmentId || "all"}
            options={[
              {
                value: "all",
                label: provinceId ? "Todos de la provincia" : "Elegí provincia",
              },
              ...departmentsForProvince.map((d) => ({
                value: d.id,
                label: d.name,
              })),
            ]}
            onChange={(v) => setLevel("department", v)}
            disabled={!provinceId}
          />
        ) : null}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-display uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
        {label}
      </label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
