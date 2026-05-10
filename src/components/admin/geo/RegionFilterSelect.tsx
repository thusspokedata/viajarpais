"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

/*
  Selector de region que actualiza la URL via search params. Reusable
  en los listados de provincias/departamentos/localidades — al cambiar
  el valor, navega a la misma ruta con `?regionId=...` (o sin el param
  si elige "todas").
*/
export function RegionFilterSelect({
  basePath,
  regions,
  paramName = "regionId",
  label = "Región",
  allLabel = "Todas las regiones",
}: {
  basePath: string;
  regions: { id: string; nameEs: string }[];
  paramName?: string;
  label?: string;
  allLabel?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramName) ?? "all";

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete(paramName);
    else params.set(paramName, next);
    // Cambiar el filtro padre invalida los hijos del query
    if (paramName === "regionId") {
      params.delete("provinceId");
      params.delete("departmentId");
    } else if (paramName === "provinceId") {
      params.delete("departmentId");
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-[var(--text-xs)] font-display uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
        {label}
      </label>
      <Select value={current} onValueChange={onChange}>
        <SelectTrigger className="min-w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {regions.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.nameEs}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
