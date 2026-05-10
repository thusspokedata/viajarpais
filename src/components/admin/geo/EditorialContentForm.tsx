"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Input,
  Textarea,
  cn,
} from "@/components/ui";
import {
  GeoEditorialContentSchema,
  type GeoEditorialContentInput,
} from "@/lib/geo/validation";
import { FormSection, FieldRow } from "@/components/admin/listing-form/FormSection";
import { useAutosave } from "@/components/admin/listing-form/useAutosave";
import { SavedIndicator } from "@/components/admin/listing-form/SavedIndicator";

/*
  EditorialContentForm — un único form compartido para los 4 niveles
  geográficos (Region, Province, Department, Locality). Cada nivel tiene
  los mismos campos editoriales (`taglineEs`, `descriptionEs`,
  `metaTitleEs`, `metaDescriptionEs`).

  La página padre (Server Component) calcula los stats del footer y los
  pasa como `stats` genérico — el form los renderiza sin saber qué
  nivel es.

  Autosave reusa `useAutosave` del listing form (v0.2.a). Misma lógica:
  arranca después del primer save manual, descarta respuestas tardías,
  cancelable contra submit manual.
*/

export type StatItem = { label: string; value: number };

export type LastEdited = {
  at: string; // ISO
  by: string | null;
};

export type ParentLink = {
  label: string; // ej. "Región"
  name: string; // ej. "Cuyo"
  href: string; // ej. "/admin/geo/regions/cuyo"
} | null;

export type EditorialUpdateAction = (
  id: string,
  data: GeoEditorialContentInput,
  expectedUpdatedAt?: string,
) => Promise<
  | { ok: true; updatedAt: string }
  | {
      ok: false;
      formErrors?: string[];
      fieldErrors?: Record<string, string[]>;
      message?: string;
      conflict?: true;
    }
>;

export type EditorialContentFormProps = {
  entityId: string;
  entityName: string;
  entitySlug: string;
  parentLink: ParentLink;
  defaultValues: GeoEditorialContentInput;
  initialUpdatedAt: string;
  stats: StatItem[];
  lastEdited: LastEdited | null;
  /** Función `update*` correspondiente al nivel (region/province/department/locality). */
  updateAction: EditorialUpdateAction;
};

export function EditorialContentForm(props: EditorialContentFormProps) {
  const initialUpdatedAtRef = React.useRef(props.initialUpdatedAt);

  const form = useForm<GeoEditorialContentInput>({
    resolver: zodResolver(GeoEditorialContentSchema),
    defaultValues: props.defaultValues,
    mode: "onBlur",
  });

  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submitting, startSubmit] = React.useTransition();
  const watchedData = useWatch({ control: form.control });

  const { entityId, updateAction } = props;
  const autosaveSave = React.useCallback(
    async (data: GeoEditorialContentInput, signal: AbortSignal) => {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const result = await updateAction(
        entityId,
        data,
        initialUpdatedAtRef.current,
      );
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (!result.ok) {
        throw new Error(result.message ?? "Error al guardar.");
      }
      initialUpdatedAtRef.current = result.updatedAt;
    },
    [entityId, updateAction],
  );

  const autosave = useAutosave({
    data: watchedData as GeoEditorialContentInput,
    enabled: form.formState.isDirty,
    isValid: form.formState.isValid,
    save: autosaveSave,
  });

  function applyServerErrors(
    fieldErrors?: Record<string, string[]>,
    formErrors?: string[],
  ) {
    if (formErrors && formErrors.length > 0) {
      setServerError(formErrors.join(" "));
    }
    if (fieldErrors) {
      Object.entries(fieldErrors).forEach(([key, msgs]) => {
        const message = msgs?.[0];
        if (!message) return;
        form.setError(key as keyof GeoEditorialContentInput, { message });
      });
    }
  }

  function handleSubmit(data: GeoEditorialContentInput) {
    setServerError(null);
    autosave.cancelInFlight();

    startSubmit(async () => {
      const res = await props.updateAction(
        props.entityId,
        data,
        initialUpdatedAtRef.current,
      );
      if (!res.ok) {
        applyServerErrors(res.fieldErrors, res.formErrors);
        if (res.message) setServerError(res.message);
        return;
      }
      initialUpdatedAtRef.current = res.updatedAt;
      form.reset(data);
    });
  }

  // Contadores de chars
  const tagline = useWatch({ control: form.control, name: "taglineEs" }) ?? "";
  const description =
    useWatch({ control: form.control, name: "descriptionEs" }) ?? "";

  return (
    <form
      className="flex flex-col gap-4 max-w-3xl"
      onSubmit={(e) => {
        void form.handleSubmit(handleSubmit)(e);
      }}
    >
      {serverError ? (
        <div
          role="alert"
          className="px-4 py-3 rounded-[var(--radius-lg)] border border-[var(--danger-fg)]/40 bg-[var(--danger-bg)] text-[var(--danger-fg)] text-[var(--text-sm)]"
        >
          {serverError}
        </div>
      ) : null}

      {/* Identificación read-only */}
      <FormSection title="Identificación" defaultOpen>
        <FieldRow label="Nombre">
          <div className="text-[var(--text-sm)] text-[var(--text-secondary)]">
            {props.entityName}{" "}
            <span className="text-[var(--text-muted)] font-mono ml-1">
              /{props.entitySlug}
            </span>
          </div>
        </FieldRow>
        {props.parentLink ? (
          <FieldRow label={props.parentLink.label}>
            <a
              href={props.parentLink.href}
              className="text-[var(--text-sm)] text-[var(--text-link)] hover:underline"
            >
              {props.parentLink.name}
            </a>
          </FieldRow>
        ) : null}
      </FormSection>

      {/* Contenido editorial */}
      <FormSection title="Contenido editorial" defaultOpen>
        <FieldRow
          label="Tagline"
          error={form.formState.errors.taglineEs?.message}
          hint={
            <span
              className={cn(
                tagline.length > 120
                  ? "text-[var(--danger-fg)]"
                  : "text-[var(--text-muted)]",
              )}
            >
              {tagline.length} / 120
            </span>
          }
        >
          <Controller
            control={form.control}
            name="taglineEs"
            render={({ field }) => (
              <Input
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                placeholder="Frase corta para hero, og:description y cards de listado."
                maxLength={120}
              />
            )}
          />
        </FieldRow>

        <FieldRow
          label="Descripción"
          error={form.formState.errors.descriptionEs?.message}
          hint={
            <span
              className={cn(
                description.length > 5000
                  ? "text-[var(--danger-fg)]"
                  : "text-[var(--text-muted)]",
              )}
            >
              {description.length} / 5000
            </span>
          }
        >
          <Controller
            control={form.control}
            name="descriptionEs"
            render={({ field }) => (
              <Textarea
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                rows={12}
                placeholder="Historia, atracciones, tips, todo lo que el editor quiera contar. Markdown básico permitido."
                maxLength={5000}
              />
            )}
          />
          <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">
            Markdown: negrita <code>**texto**</code>, cursiva <code>*texto*</code>,
            listas con <code>-</code>, links <code>[texto](url)</code>. La
            preview se ve en la página pública.
          </p>
        </FieldRow>
      </FormSection>

      {/* SEO */}
      <FormSection title="SEO">
        <FieldRow
          label="Meta title"
          error={form.formState.errors.metaTitleEs?.message}
          hint="Autogenerado al guardar si está vacío."
        >
          <Controller
            control={form.control}
            name="metaTitleEs"
            render={({ field }) => (
              <Input
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                placeholder="Hasta 60 caracteres"
                maxLength={60}
              />
            )}
          />
        </FieldRow>
        <FieldRow
          label="Meta description"
          error={form.formState.errors.metaDescriptionEs?.message}
          hint="Autogenerado al guardar si está vacío."
        >
          <Controller
            control={form.control}
            name="metaDescriptionEs"
            render={({ field }) => (
              <Textarea
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                rows={3}
                placeholder="Hasta 160 caracteres"
                maxLength={160}
              />
            )}
          />
        </FieldRow>
      </FormSection>

      {/* Stats read-only */}
      {props.stats.length > 0 ? (
        <FormSection title="Estadísticas">
          <dl className="grid sm:grid-cols-2 gap-3">
            {props.stats.map((s) => (
              <div
                key={s.label}
                className="border border-[var(--border-subtle)] rounded-[var(--radius-md)] bg-[var(--surface-canvas)] px-3 py-2"
              >
                <dt className="text-[10px] font-display uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
                  {s.label}
                </dt>
                <dd className="text-[var(--text-md)] font-semibold text-[var(--text-primary)]">
                  {s.value.toLocaleString("es-AR")}
                </dd>
              </div>
            ))}
          </dl>
        </FormSection>
      ) : null}

      {/* Auditoría */}
      {props.lastEdited ? (
        <FormSection title="Auditoría">
          <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">
            Última edición:{" "}
            {props.lastEdited.by ? (
              <>
                por <strong>{props.lastEdited.by}</strong> el{" "}
              </>
            ) : (
              "el "
            )}
            <time dateTime={props.lastEdited.at}>
              {new Date(props.lastEdited.at).toLocaleString("es-AR", {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </time>
            .
          </p>
        </FormSection>
      ) : null}

      {/* Sticky footer */}
      <div
        className={cn(
          "sticky bottom-0 z-30 -mx-4 md:-mx-8",
          "bg-[var(--surface-base)] border-t border-[var(--border-subtle)] px-4 md:px-8 py-3",
          "flex items-center gap-3",
        )}
      >
        <SavedIndicator state={autosave.state} />
        <div className="flex-1" />
        <Button type="submit" disabled={submitting}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
