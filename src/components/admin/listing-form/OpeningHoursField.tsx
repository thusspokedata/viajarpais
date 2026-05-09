"use client";

import * as React from "react";
import { Plus, Close } from "@/components/ui/icons";
import { Input, cn } from "@/components/ui";
import { OPENING_HOURS_DAYS } from "@/lib/listings/validation";

type TimeRangeInput = { open: string; close: string };
type OpeningHoursInput = Partial<
  Record<(typeof OPENING_HOURS_DAYS)[number], TimeRangeInput[]>
> | null;

const DAY_LABEL: Record<(typeof OPENING_HOURS_DAYS)[number], string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

type DayKey = (typeof OPENING_HOURS_DAYS)[number];
type TimeRange = TimeRangeInput;
type Hours = Record<DayKey, TimeRange[]>;

const EMPTY_HOURS: Hours = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
};

function normalize(input: OpeningHoursInput | undefined): Hours {
  const base = { ...EMPTY_HOURS };
  if (!input) return base;
  for (const day of OPENING_HOURS_DAYS) {
    base[day] = input[day] ?? [];
  }
  return base;
}

export function OpeningHoursField({
  value,
  onChange,
}: {
  value: OpeningHoursInput | undefined;
  onChange: (next: OpeningHoursInput) => void;
}) {
  const hours: Hours = normalize(value);

  function update(next: Hours) {
    const allEmpty = OPENING_HOURS_DAYS.every((d) => next[d].length === 0);
    onChange(allEmpty ? null : next);
  }

  function addRange(day: DayKey) {
    update({ ...hours, [day]: [...hours[day], { open: "09:00", close: "18:00" }] });
  }
  function removeRange(day: DayKey, index: number) {
    update({ ...hours, [day]: hours[day].filter((_, i) => i !== index) });
  }
  function changeRange(day: DayKey, index: number, patch: Partial<TimeRange>) {
    update({
      ...hours,
      [day]: hours[day].map((r, i) =>
        i === index ? { ...r, ...patch } : r,
      ),
    });
  }
  function copyMondayToWeekdays() {
    const next: Hours = { ...hours };
    const src = hours.monday;
    (["tuesday", "wednesday", "thursday", "friday"] as DayKey[]).forEach((d) => {
      next[d] = src.map((r) => ({ ...r }));
    });
    update(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        {OPENING_HOURS_DAYS.map((day) => (
          <DayRow
            key={day}
            day={day}
            ranges={hours[day]}
            onAdd={() => addRange(day)}
            onRemove={(i) => removeRange(day, i)}
            onChange={(i, patch) => changeRange(day, i, patch)}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={copyMondayToWeekdays}
          disabled={hours.monday.length === 0}
          className={cn(
            "text-[var(--text-xs)] underline-offset-2 hover:underline",
            hours.monday.length === 0
              ? "text-[var(--text-muted)] cursor-not-allowed"
              : "text-[var(--text-link)] hover:text-[var(--text-link-hover)]",
          )}
        >
          Copiar lunes a martes–viernes
        </button>
        <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
          Dejá un día vacío para indicar que está cerrado.
        </span>
      </div>
    </div>
  );
}

function DayRow({
  day,
  ranges,
  onAdd,
  onRemove,
  onChange,
}: {
  day: DayKey;
  ranges: TimeRange[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, patch: Partial<TimeRange>) => void;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr_auto] items-start gap-2 py-1.5 border-b border-[var(--border-subtle)] last:border-b-0">
      <div className="text-[var(--text-sm)] text-[var(--text-secondary)] pt-1.5">
        {DAY_LABEL[day]}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ranges.length === 0 ? (
          <span className="text-[var(--text-xs)] text-[var(--text-muted)] py-1.5">
            Cerrado
          </span>
        ) : (
          ranges.map((range, i) => (
            <div
              key={i}
              className="inline-flex items-center gap-1 px-1.5 py-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-canvas)]"
            >
              <Input
                type="time"
                value={range.open}
                onChange={(e) => onChange(i, { open: e.target.value })}
                className="h-7 px-1.5 w-[88px] text-[var(--text-xs)]"
                aria-label={`${DAY_LABEL[day]} abre`}
              />
              <span className="text-[var(--text-muted)]">–</span>
              <Input
                type="time"
                value={range.close}
                onChange={(e) => onChange(i, { close: e.target.value })}
                className="h-7 px-1.5 w-[88px] text-[var(--text-xs)]"
                aria-label={`${DAY_LABEL[day]} cierra`}
              />
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={`Quitar rango ${i + 1} de ${DAY_LABEL[day]}`}
                className="h-6 w-6 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
              >
                <Close className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1 h-7 px-2 rounded-[var(--radius-md)] text-[var(--text-xs)] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
        aria-label={`Agregar rango a ${DAY_LABEL[day]}`}
      >
        <Plus className="h-3 w-3" />
        Rango
      </button>
    </div>
  );
}
