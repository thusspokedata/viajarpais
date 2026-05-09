"use client";

import * as React from "react";
import { Controller, useFormContext } from "react-hook-form";
import {
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
import type { ListingFormInput } from "@/lib/listings/validation";
import type {
  DepartmentOption,
  LocalityOption,
  ProvinceOption,
} from "./types";
import { FieldRow } from "./FormSection";

/**
 * Cascada Provincia → Departamento → Localidad.
 *
 * Pre-cargada con las opciones del primer render (server) para que el
 * form de edit muestre todo sin un round-trip extra. Cuando el editor
 * cambia provincia o depto, se cargan los hijos via server action +
 * useTransition. Reseteo agresivo: cambiar provincia limpia depto y
 * localidad; cambiar depto limpia localidad.
 *
 * Nota técnica: la lógica vive en los callbacks `onChange` del Controller,
 * NO en un `useEffect` que observa con `useWatch`. Eso evita el warning
 * `react-hooks/set-state-in-effect` de React 19 — los efectos están para
 * sincronizar con sistemas externos, las cascadas dependientes son una
 * reacción a inputs del usuario y conceptualmente son event handlers.
 */
export function LocationCascade({
  provinces,
  initialDepartments,
  initialLocalities,
}: {
  provinces: ProvinceOption[];
  initialDepartments: DepartmentOption[];
  initialLocalities: LocalityOption[];
}) {
  const { control, setValue, formState } = useFormContext<ListingFormInput>();
  const errors = formState.errors;

  const [departments, setDepartments] =
    React.useState<DepartmentOption[]>(initialDepartments);
  const [localities, setLocalities] =
    React.useState<LocalityOption[]>(initialLocalities);
  const [, startTx] = React.useTransition();

  /*
    Last-write-wins guards. Sin esto, click rápido en Cuyo → Buenos Aires
    podía mostrar deptos de Cuyo si el primer fetch llegaba tarde. Cada
    cascada (depts/locs) tiene su propio counter de request id y un
    AbortController. Las respuestas con `myId !== refId.current` se
    descartan sin aplicar setState. El AbortController sólo señaliza
    "ya no me importa" porque server actions de Next no propagan signal
    al servidor — el ref-id es la garantía real, AbortController es
    consistencia con el patrón de `useAutosave`.
  */
  const deptCtrlRef = React.useRef<AbortController | null>(null);
  const deptReqIdRef = React.useRef(0);
  const locCtrlRef = React.useRef<AbortController | null>(null);
  const locReqIdRef = React.useRef(0);

  function selectProvince(provinceId: string, currentValue: string) {
    if (provinceId === currentValue) return;
    setValue("provinceId", provinceId, { shouldDirty: true });
    setValue("departmentId", "", { shouldDirty: true });
    setValue("localityId", "", { shouldDirty: true });
    setDepartments([]);
    setLocalities([]);

    // Cancelar cualquier fetch de depts/locs en vuelo: la elección de
    // provincia los invalidó.
    deptCtrlRef.current?.abort();
    locCtrlRef.current?.abort();
    locReqIdRef.current += 1;

    if (!provinceId) return;
    const ctrl = new AbortController();
    deptCtrlRef.current = ctrl;
    const myId = ++deptReqIdRef.current;

    startTx(async () => {
      const next = await getDepartmentsByProvinceAction(provinceId);
      if (ctrl.signal.aborted || myId !== deptReqIdRef.current) return;
      setDepartments(next);
    });
  }

  function selectDepartment(departmentId: string, currentValue: string) {
    if (departmentId === currentValue) return;
    setValue("departmentId", departmentId, { shouldDirty: true });
    setValue("localityId", "", { shouldDirty: true });
    setLocalities([]);

    locCtrlRef.current?.abort();

    if (!departmentId) return;
    const ctrl = new AbortController();
    locCtrlRef.current = ctrl;
    const myId = ++locReqIdRef.current;

    startTx(async () => {
      const next = await getLocalitiesByDepartmentAction(departmentId);
      if (ctrl.signal.aborted || myId !== locReqIdRef.current) return;
      setLocalities(next);
    });
  }

  return (
    <div className="grid sm:grid-cols-3 gap-3">
      <Controller
        name="provinceId"
        control={control}
        render={({ field }) => (
          <FieldRow
            label="Provincia"
            required
            error={errors.provinceId?.message}
          >
            <Select
              value={field.value || undefined}
              onValueChange={(v) => selectProvince(v, field.value ?? "")}
            >
              <SelectTrigger className={cn(errors.provinceId && "border-[var(--danger-fg)]")}>
                <SelectValue placeholder="Elegí provincia" />
              </SelectTrigger>
              <SelectContent>
                {provinces.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
        )}
      />

      <Controller
        name="departmentId"
        control={control}
        render={({ field }) => (
          <FieldRow
            label="Departamento"
            required
            error={errors.departmentId?.message}
          >
            <Select
              value={field.value || undefined}
              onValueChange={(v) => selectDepartment(v, field.value ?? "")}
              disabled={departments.length === 0}
            >
              <SelectTrigger className={cn(errors.departmentId && "border-[var(--danger-fg)]")}>
                <SelectValue
                  placeholder={
                    departments.length === 0
                      ? "Primero la provincia"
                      : "Elegí departamento"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
        )}
      />

      <Controller
        name="localityId"
        control={control}
        render={({ field }) => (
          <FieldRow
            label="Localidad"
            required
            error={errors.localityId?.message}
          >
            <Select
              value={field.value || undefined}
              onValueChange={(v) => {
                setValue("localityId", v, { shouldDirty: true });
              }}
              disabled={localities.length === 0}
            >
              <SelectTrigger className={cn(errors.localityId && "border-[var(--danger-fg)]")}>
                <SelectValue
                  placeholder={
                    localities.length === 0
                      ? "Primero el departamento"
                      : "Elegí localidad"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {localities.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
        )}
      />
    </div>
  );
}
