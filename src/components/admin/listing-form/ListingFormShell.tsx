"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@/components/ui";
import {
  ListingFormSchema,
  parseAttributesText,
  type ListingFormInput,
  type ListingFormValues,
} from "@/lib/listings/validation";
import { createListing } from "@/server/actions/listings/create";
import { updateListing } from "@/server/actions/listings/update";
import { slugify } from "@/lib/slug";
import { FormSection, FieldRow } from "./FormSection";
import { LocationCascade } from "./LocationCascade";
import { CategoryMultiSelect } from "./CategoryMultiSelect";
import { OpeningHoursField } from "./OpeningHoursField";
import { StatusSection } from "./StatusSection";
import { ReverifyBanner } from "./ReverifyBanner";
import { useAutosave } from "./useAutosave";
import { SavedIndicator } from "./SavedIndicator";
import type { ListingFormShellProps } from "./types";

const PRICE_OPTIONS = [
  { value: "BUDGET", label: "$ – Económico" },
  { value: "MID", label: "$$ – Medio" },
  { value: "HIGH", label: "$$$ – Alto" },
  { value: "LUXURY", label: "$$$$ – Luxury" },
] as const;

const PAYMENT_OPTIONS = [
  { value: "CASH", label: "Efectivo" },
  { value: "CREDIT_CARD", label: "Tarjeta crédito" },
  { value: "DEBIT_CARD", label: "Tarjeta débito" },
  { value: "MERCADO_PAGO", label: "Mercado Pago" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "CRYPTO", label: "Cripto" },
] as const;

const LANGUAGE_OPTIONS = [
  { value: "ES", label: "Español" },
  { value: "EN", label: "Inglés" },
  { value: "PT", label: "Portugués" },
  { value: "FR", label: "Francés" },
  { value: "DE", label: "Alemán" },
  { value: "IT", label: "Italiano" },
] as const;

export function ListingFormShell(props: ListingFormShellProps) {
  const router = useRouter();
  const isEdit = props.mode === "edit" && Boolean(props.listingId);
  const initialUpdatedAtRef = React.useRef(props.listingUpdatedAt);

  const form = useForm<ListingFormInput>({
    resolver: zodResolver(ListingFormSchema),
    defaultValues: props.defaultValues,
    mode: "onBlur",
  });

  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submitting, startSubmit] = React.useTransition();

  /*
    `attributesText` mantiene el texto crudo que el editor escribe en el
    textarea. Cada cambio se parsea y, si el JSON es válido, se sincroniza
    al form via `setValue("attributes", parsed)`. Si no, `setError` marca
    el campo invalido — el form keep el último valor parseado correctamente
    o `undefined`. Asi el autosave (que lee `form.attributes` watched)
    persiste cambios de attributes; antes vivian solo en `attributesText`
    local y el autosave nunca los veia.
  */
  const [attributesText, setAttributesText] = React.useState<string>(() =>
    props.defaultValues.attributes
      ? JSON.stringify(props.defaultValues.attributes, null, 2)
      : "",
  );

  const watchedData = useWatch({ control: form.control });
  const isFormValid = form.formState.isValid;

  const autosaveSave = React.useCallback(
    async (data: ListingFormInput, signal: AbortSignal) => {
      if (!isEdit || !props.listingId) return;
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const result = await updateListing(
        props.listingId,
        data,
        initialUpdatedAtRef.current,
      );
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (!result.ok) {
        throw new Error(result.message ?? "Error al guardar.");
      }
      initialUpdatedAtRef.current = result.updatedAt;
    },
    [isEdit, props.listingId],
  );

  const autosave = useAutosave({
    data: watchedData as ListingFormInput,
    enabled: isEdit && form.formState.isDirty,
    isValid: isFormValid,
    save: autosaveSave,
    // Con `mode: "onBlur"`, `isValid` no se actualiza durante el typing —
    // `form.trigger()` fuerza la revalidación al momento del autosave, así
    // no persistimos data inválida con un `isValid` cacheado en `true`.
    validate: form.trigger,
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
        form.setError(key as keyof ListingFormInput, { message });
      });
    }
  }

  function handleAttributesChange(text: string) {
    setAttributesText(text);
    const parsed = parseAttributesText(text);
    if (parsed.ok) {
      form.setValue("attributes", parsed.value, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.clearErrors("attributes");
    } else {
      form.setError("attributes", { type: "manual", message: parsed.error });
    }
  }

  function handleSubmit(data: ListingFormInput) {
    setServerError(null);
    autosave.cancelInFlight();

    /*
      `data.attributes` ya viene parseado y validado: se sincroniza desde
      el textarea via `handleAttributesChange`. Si el JSON está mal, el
      form ya marcó error y `handleSubmit` no se ejecuta (RHF bloquea
      submit con errores). Por eso acá solo reenviamos `data` tal cual.
    */
    const payload: ListingFormInput = data;

    startSubmit(async () => {
      if (isEdit && props.listingId) {
        const res = await updateListing(
          props.listingId,
          payload,
          initialUpdatedAtRef.current,
        );
        if (!res.ok) {
          applyServerErrors(res.fieldErrors, res.formErrors);
          if (res.message) setServerError(res.message);
          return;
        }
        initialUpdatedAtRef.current = res.updatedAt;
        form.reset(payload as ListingFormValues);
        router.refresh();
      } else {
        const res = await createListing(payload);
        // En éxito createListing redirige y este branch no se alcanza.
        if (res && res.ok === false) {
          applyServerErrors(res.fieldErrors, res.formErrors);
          if (res.message) setServerError(res.message);
        }
      }
    });
  }

  // Slug preview: construido a partir del nombre cuando el editor no
  // escribió un slug a mano. Solo informativo, no se persiste hasta el
  // submit donde el server valida unicidad.
  const watchedName = useWatch({ control: form.control, name: "name" }) ?? "";
  const watchedSlug = useWatch({ control: form.control, name: "slug" }) ?? "";
  const slugPreview = watchedSlug || slugify(watchedName);

  const description = useWatch({ control: form.control, name: "description" }) ?? "";
  const descLen = description.length;
  const descClass =
    descLen < 200 || descLen > 2000
      ? "text-[var(--danger-fg)]"
      : "text-[var(--text-muted)]";

  return (
    <FormProvider {...form}>
      <form
        className="flex flex-col gap-4 max-w-4xl pb-32"
        onSubmit={(event) => {
          void form.handleSubmit(handleSubmit)(event);
        }}
      >
        {props.justCreated ? (
          <div
            role="status"
            className="flex items-center gap-2 px-4 py-3 rounded-[var(--radius-lg)] border border-[var(--success-fg)]/30 bg-[var(--success-bg)] text-[var(--success-fg)] text-[var(--text-sm)]"
          >
            Ficha creada como borrador. Completá los datos restantes y publicala
            cuando esté lista.
          </div>
        ) : null}

        {props.needsReverify ? <ReverifyBanner /> : null}

        {serverError ? (
          <div
            role="alert"
            className="px-4 py-3 rounded-[var(--radius-lg)] border border-[var(--danger-fg)]/40 bg-[var(--danger-bg)] text-[var(--danger-fg)] text-[var(--text-sm)]"
          >
            {serverError}
          </div>
        ) : null}

        {/* Identificación */}
        <FormSection
          title="Identificación"
          description="Cómo se llama, cómo se ve la URL, cómo se categoriza."
          defaultOpen
        >
          <FieldRow
            label="Nombre"
            required
            error={form.formState.errors.name?.message}
          >
            <Input
              {...form.register("name")}
              placeholder="Ej. Hostería Lago Escondido"
              maxLength={200}
              invalid={Boolean(form.formState.errors.name)}
            />
          </FieldRow>

          <FieldRow
            label="Slug"
            error={form.formState.errors.slug?.message}
            hint={
              slugPreview ? (
                <span className="font-mono">/{slugPreview}</span>
              ) : null
            }
          >
            <Input
              {...form.register("slug")}
              placeholder="Se autogenera del nombre si lo dejás vacío"
              invalid={Boolean(form.formState.errors.slug)}
            />
            <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">
              Solo minúsculas, números y guiones. Si colisiona, se intenta
              añadir el slug de la localidad como sufijo.
            </p>
          </FieldRow>

          <FieldRow
            label="Descripción"
            required
            error={form.formState.errors.description?.message}
            hint={
              <span className={descClass}>
                {descLen} / 2000 (mínimo 200)
              </span>
            }
          >
            <Textarea
              {...form.register("description")}
              rows={8}
              placeholder="Texto descriptivo de la ficha. Markdown básico permitido."
              invalid={Boolean(form.formState.errors.description)}
            />
            <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">
              Permite negrita <code>**texto**</code>, cursiva <code>*texto*</code>,
              listas con <code>-</code>, y links <code>[texto](url)</code>. La
              preview se verá cuando se publique la ficha.
            </p>
          </FieldRow>

          <FieldRow
            label="Categorías"
            required
            error={
              form.formState.errors.categories?.message as string | undefined
            }
          >
            <Controller
              control={form.control}
              name="categories"
              render={({ field }) => (
                <CategoryMultiSelect
                  categories={props.categories}
                  value={field.value ?? []}
                  onChange={field.onChange}
                />
              )}
            />
          </FieldRow>
        </FormSection>

        {/* Ubicación */}
        <FormSection
          title="Ubicación"
          description="Dónde se ubica esta ficha geográficamente."
          defaultOpen
        >
          <LocationCascade
            provinces={props.provinces}
            initialDepartments={props.initialDepartments}
            initialLocalities={props.initialLocalities}
          />
          <FieldRow
            label="Dirección"
            required
            error={form.formState.errors.address?.message}
          >
            <Input
              {...form.register("address")}
              placeholder="Av. Mitre 1234"
              invalid={Boolean(form.formState.errors.address)}
            />
          </FieldRow>
          <div className="grid sm:grid-cols-2 gap-3">
            <FieldRow
              label="Latitud"
              error={form.formState.errors.lat?.message}
              hint="Opcional. Copiá desde Google Maps."
            >
              <Input
                {...form.register("lat")}
                inputMode="decimal"
                placeholder="-32.8908"
              />
            </FieldRow>
            <FieldRow
              label="Longitud"
              error={form.formState.errors.lng?.message}
            >
              <Input
                {...form.register("lng")}
                inputMode="decimal"
                placeholder="-68.8272"
              />
            </FieldRow>
          </div>
        </FormSection>

        {/* Contacto */}
        <FormSection
          title="Contacto"
          description="Al menos un canal es obligatorio."
          defaultOpen
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <FieldRow
              label="Teléfono"
              error={form.formState.errors.phone?.message}
            >
              <Input {...form.register("phone")} placeholder="+54 11 1234 5678" />
            </FieldRow>
            <FieldRow
              label="WhatsApp"
              error={form.formState.errors.whatsapp?.message}
            >
              <Input
                {...form.register("whatsapp")}
                placeholder="+54 11 1234 5678"
              />
            </FieldRow>
            <FieldRow
              label="Email"
              error={form.formState.errors.email?.message}
            >
              <Input
                {...form.register("email")}
                type="email"
                placeholder="contacto@ejemplo.com"
              />
            </FieldRow>
            <FieldRow
              label="Website"
              error={form.formState.errors.website?.message}
            >
              <Input {...form.register("website")} placeholder="https://..." />
            </FieldRow>
          </div>
        </FormSection>

        {/* Redes sociales */}
        <FormSection
          title="Redes sociales"
          description="Handles públicos. Los handles van sin el @."
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <FieldRow
              label="Instagram"
              error={form.formState.errors.instagram?.message}
              hint="Sin @"
            >
              <Input {...form.register("instagram")} placeholder="hosteria_lago" />
            </FieldRow>
            <FieldRow
              label="Facebook"
              error={form.formState.errors.facebook?.message}
              hint="URL completa"
            >
              <Input
                {...form.register("facebook")}
                placeholder="https://facebook.com/..."
              />
            </FieldRow>
            <FieldRow
              label="TikTok"
              error={form.formState.errors.tiktok?.message}
              hint="Sin @"
            >
              <Input {...form.register("tiktok")} placeholder="hosteria_lago" />
            </FieldRow>
            <FieldRow
              label="YouTube"
              error={form.formState.errors.youtube?.message}
              hint="URL del canal"
            >
              <Input
                {...form.register("youtube")}
                placeholder="https://youtube.com/@..."
              />
            </FieldRow>
          </div>
        </FormSection>

        {/* Operación */}
        <FormSection
          title="Operación"
          description="Precios, idiomas, métodos de pago, horarios."
        >
          <FieldRow label="Rango de precios">
            <Controller
              control={form.control}
              name="priceRange"
              render={({ field }) => (
                <Select
                  value={field.value ?? undefined}
                  onValueChange={(v) => field.onChange(v)}
                >
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Sin definir" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FieldRow>

          <FieldRow label="Idiomas atendidos">
            <Controller
              control={form.control}
              name="languages"
              render={({ field }) => (
                <Chips
                  options={LANGUAGE_OPTIONS}
                  value={field.value ?? []}
                  onChange={field.onChange}
                />
              )}
            />
          </FieldRow>

          <FieldRow label="Métodos de pago">
            <Controller
              control={form.control}
              name="paymentMethods"
              render={({ field }) => (
                <Chips
                  options={PAYMENT_OPTIONS}
                  value={field.value ?? []}
                  onChange={field.onChange}
                />
              )}
            />
          </FieldRow>

          <FieldRow label="Horarios de atención">
            <Controller
              control={form.control}
              name="openingHours"
              render={({ field }) => (
                <OpeningHoursField
                  value={field.value ?? null}
                  onChange={field.onChange}
                />
              )}
            />
          </FieldRow>
        </FormSection>

        {/* Atributos */}
        <FormSection
          title="Atributos específicos"
          description="Campo experimental. Se completa en versiones futuras según categoría."
        >
          <FieldRow
            label="Atributos (JSON opcional)"
            error={
              form.formState.errors.attributes?.message as string | undefined
            }
          >
            <Textarea
              value={attributesText}
              onChange={(e) => handleAttributesChange(e.target.value)}
              rows={5}
              placeholder='{ "wifi": true, "estacionamiento": "gratis" }'
              className="font-mono text-[var(--text-xs)]"
            />
            <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">
              Tiene que ser un objeto JSON parseable. Dejalo vacío si no aplica.
              El autosave persiste cambios validos automáticamente.
            </p>
          </FieldRow>
        </FormSection>

        {/* SEO */}
        <FormSection
          title="SEO"
          description="Si lo dejás vacío, se autogenera al guardar a partir del nombre, categoría y localidad."
        >
          <FieldRow
            label="Meta title"
            error={form.formState.errors.metaTitle?.message}
          >
            <Input
              {...form.register("metaTitle")}
              placeholder="Autogenerado si vacío"
              maxLength={70}
            />
          </FieldRow>
          <FieldRow
            label="Meta description"
            error={form.formState.errors.metaDescription?.message}
          >
            <Textarea
              {...form.register("metaDescription")}
              rows={3}
              placeholder="Autogenerado si vacío"
              maxLength={180}
            />
          </FieldRow>
        </FormSection>

        {/* Estado y verificación (solo edit) */}
        {isEdit &&
        props.listingId &&
        props.listingStatus &&
        props.listingTier ? (
          <FormSection
            title="Estado y verificación"
            description="Publicar, archivar, marcar como verificada."
          >
            <StatusSection
              listingId={props.listingId}
              status={props.listingStatus}
              tier={props.listingTier}
              verifiedAt={props.listingVerifiedAt ?? null}
              verifiedUntil={props.listingVerifiedUntil ?? null}
              archivedAt={props.listingArchivedAt ?? null}
            />
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
          {isEdit ? <SavedIndicator state={autosave.state} /> : null}
          <div className="flex-1" />
          <Button
            type="button"
            variant="ghost"
            disabled={submitting}
            onClick={() => router.push("/admin/listings")}
          >
            {form.formState.isDirty ? "Descartar cambios" : "Cerrar"}
          </Button>
          <Button type="submit" disabled={submitting}>
            {isEdit ? "Guardar" : "Guardar borrador"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T[];
  onChange: (next: T[]) => void;
}) {
  function toggle(opt: T) {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center px-3 h-7 rounded-[var(--radius-pill)]",
              "text-[var(--text-xs)] font-medium border transition-colors",
              "focus:outline-none focus-visible:shadow-[var(--shadow-focus)]",
              active
                ? "bg-[var(--brand-muted)] border-[var(--brand-primary)] text-[var(--brand-muted-fg)]"
                : "bg-[var(--surface-base)] border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
