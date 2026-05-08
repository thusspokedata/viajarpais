"use client";

import * as React from "react";
import { Upload, Check, AlertTriangle, ImageIcon, Plus, GripVertical, Close } from "@/components/ui/icons";
import {
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Card,
  Badge,
  cn,
} from "@/components/ui";

/**
 * ListingForm — patrón de referencia para el form admin.
 * No es el form completo — es el patrón que se escala.
 *
 * Incluye:
 * - secciones con headings + introducción
 * - inputs con label, hint, validación inline
 * - select y multi-select
 * - upload de imágenes con preview placeholder
 * - barra de progreso de upload
 * - footer sticky con: estado guardado-automático + cancelar / borrador / publicar
 */

export interface ListingFormProps {
  className?: string;
  initialData?: Partial<{
    name: string;
    category: string;
    province: string;
    description: string;
  }>;
}

export function ListingForm({ className, initialData }: ListingFormProps) {
  const [savedAt, setSavedAt] = React.useState<Date | null>(new Date());
  const [name, setName] = React.useState(initialData?.name ?? "");
  const [description, setDescription] = React.useState(initialData?.description ?? "");

  // Simulación de "guardado automático" cada vez que cambia algo
  React.useEffect(() => {
    const t = setTimeout(() => setSavedAt(new Date()), 800);
    return () => clearTimeout(t);
  }, [name, description]);

  const nameValid = name.length === 0 || name.length >= 3;

  return (
    <form
      className={cn("flex flex-col gap-6 max-w-3xl pb-32", className)}
      onSubmit={(e) => e.preventDefault()}
    >
      {/* Section: Identidad */}
      <FormSection
        title="Identidad"
        description="Cómo se llama y dónde se ubica. Estos datos son visibles en todos los listados."
      >
        <Field
          label="Nombre"
          requiredMark
          hint={`${name.length}/120`}
          error={!nameValid ? "Mínimo 3 caracteres." : undefined}
        >
          <Input
            value={name}
            invalid={!nameValid}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Hostería Lago Escondido"
            maxLength={120}
          />
        </Field>

        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Categoría" requiredMark>
            <Select defaultValue="alojamiento">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alojamiento">Alojamiento</SelectItem>
                <SelectItem value="gastronomia">Gastronomía</SelectItem>
                <SelectItem value="excursion">Excursión</SelectItem>
                <SelectItem value="evento">Evento</SelectItem>
                <SelectItem value="sitio">Sitio de interés</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Subcategorías">
            <MultiSelectChips
              options={[
                "Cabañas",
                "Boutique",
                "Familiar",
                "Pet-friendly",
                "Económico",
              ]}
              defaultSelected={["Cabañas", "Familiar"]}
            />
          </Field>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Provincia" requiredMark>
            <Select defaultValue="rio-negro">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rio-negro">Río Negro</SelectItem>
                <SelectItem value="mendoza">Mendoza</SelectItem>
                <SelectItem value="salta">Salta</SelectItem>
                <SelectItem value="jujuy">Jujuy</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Departamento" requiredMark>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Elegir departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bariloche">Bariloche</SelectItem>
                <SelectItem value="pilcaniyeu">Pilcaniyeu</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Localidad" requiredMark>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Elegir localidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="san-carlos-de-bariloche">San Carlos de Bariloche</SelectItem>
                <SelectItem value="dina-huapi">Dina Huapi</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </FormSection>

      <Separator />

      {/* Section: Descripción */}
      <FormSection
        title="Descripción"
        description="El primer párrafo aparece como copete en los listados; el resto en la ficha completa."
      >
        <Field
          label="Resumen"
          requiredMark
          hint={`${description.length}/280`}
        >
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Una descripción corta y clara del lugar. Sin mayúsculas todo, sin signos de exclamación."
            maxLength={280}
            rows={3}
          />
        </Field>
        <Field label="Descripción completa">
          <Textarea
            placeholder="Detalles, historia, qué tener en cuenta. Markdown permitido."
            rows={6}
          />
        </Field>
      </FormSection>

      <Separator />

      {/* Section: Imágenes */}
      <FormSection
        title="Imágenes"
        description="Mínimo 1 imagen, máximo 8. Arrastrá para reordenar — la primera es la portada."
      >
        <ImageUploader />
      </FormSection>

      <Separator />

      {/* Section: Verificación */}
      <FormSection
        title="Verificación"
        description="Solo el equipo editorial puede emitir o renovar la verificación."
      >
        <Card className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-[var(--verified-bg)] grid place-items-center text-[var(--verified-fg)]">
            <Check className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[var(--text-sm)] font-medium">Sin verificar</div>
            <div className="text-[var(--text-xs)] text-[var(--text-muted)]">
              La ficha se publica sin sello hasta la próxima visita editorial.
            </div>
          </div>
          <Button variant="secondary" size="sm">
            Solicitar verificación
          </Button>
        </Card>
      </FormSection>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[244px] z-30 bg-[var(--surface-base)] border-t border-[var(--border-subtle)] px-4 md:px-6 py-3 flex items-center gap-3 vp-fade-in">
        <SavedIndicator savedAt={savedAt} />
        <div className="flex-1" />
        <Button variant="ghost" type="button">
          Cancelar
        </Button>
        <Button variant="secondary" type="button">
          Guardar borrador
        </Button>
        <Button type="submit">Publicar</Button>
      </div>
    </form>
  );
}

/* ────────────────────────── helpers ─────────────────────────── */

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid md:grid-cols-[220px_1fr] gap-x-8 gap-y-4">
      <div>
        <h2 className="font-display text-[var(--text-md)] font-semibold tracking-[var(--tracking-tight)]">
          {title}
        </h2>
        {description ? (
          <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1 leading-[var(--leading-normal)]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  requiredMark,
  hint,
  error,
  children,
}: {
  label: string;
  requiredMark?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label requiredMark={requiredMark} hint={hint}>
        {label}
      </Label>
      {children}
      {error ? (
        <div className="flex items-center gap-1 text-[var(--text-xs)] text-[var(--danger-fg)]">
          <AlertTriangle className="h-3 w-3" />
          {error}
        </div>
      ) : null}
    </div>
  );
}

function MultiSelectChips({
  options,
  defaultSelected = [],
}: {
  options: string[];
  defaultSelected?: string[];
}) {
  const [selected, setSelected] = React.useState<string[]>(defaultSelected);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() =>
              setSelected((s) =>
                active ? s.filter((x) => x !== opt) : [...s, opt]
              )
            }
            className={cn(
              "inline-flex items-center gap-1 px-2.5 h-7 rounded-[var(--radius-pill)]",
              "text-[var(--text-xs)] font-medium border transition-colors duration-[var(--duration-fast)]",
              active
                ? "bg-[var(--brand-muted)] text-[var(--brand-muted-fg)] border-[var(--brand-primary)]"
                : "bg-[var(--surface-base)] text-[var(--text-secondary)] border-[var(--border-default)] hover:border-[var(--border-strong)]"
            )}
          >
            {active ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function ImageUploader() {
  const [images, setImages] = React.useState<string[]>(["mock-1", "mock-2"]);
  const [progress, setProgress] = React.useState<number | null>(null);

  function fakeUpload() {
    setProgress(0);
    const id = `mock-${Date.now()}`;
    let p = 0;
    const interval = setInterval(() => {
      p += 12;
      setProgress(Math.min(p, 100));
      if (p >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setImages((curr) => [...curr, id]);
          setProgress(null);
        }, 200);
      }
    }, 100);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {images.map((id, i) => (
          <div
            key={id}
            className="group/img relative aspect-[4/3] rounded-[var(--radius-md)] overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-sunken)]"
          >
            <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,var(--neutral-100)_0,var(--neutral-100)_8px,var(--neutral-150)_8px,var(--neutral-150)_16px)]" />
            <div className="absolute top-1.5 left-1.5">
              <Badge size="sm" variant={i === 0 ? "info" : "default"}>
                {i === 0 ? "Portada" : `#${i + 1}`}
              </Badge>
            </div>
            <button
              type="button"
              className="absolute top-1.5 right-1.5 h-6 w-6 grid place-items-center rounded-full bg-[var(--surface-base)]/90 text-[var(--text-secondary)] opacity-0 group-hover/img:opacity-100 transition-opacity"
              onClick={() => setImages((s) => s.filter((x) => x !== id))}
              aria-label="Quitar imagen"
            >
              <Close className="h-3 w-3" />
            </button>
            <div className="absolute bottom-1.5 left-1.5 text-[var(--text-muted)] cursor-grab opacity-0 group-hover/img:opacity-100 transition-opacity">
              <GripVertical className="h-3.5 w-3.5" />
            </div>
          </div>
        ))}

        {images.length < 8 ? (
          <button
            type="button"
            onClick={fakeUpload}
            className={cn(
              "aspect-[4/3] rounded-[var(--radius-md)]",
              "border-2 border-dashed border-[var(--border-default)]",
              "bg-[var(--surface-canvas)]",
              "flex flex-col items-center justify-center gap-1.5",
              "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
              "hover:border-[var(--brand-primary)] hover:bg-[var(--brand-muted)]",
              "transition-colors duration-[var(--duration-fast)]",
              "focus:outline-none focus-visible:shadow-[var(--shadow-focus)]"
            )}
          >
            {progress !== null ? (
              <div className="w-3/4 flex flex-col gap-1.5 items-center">
                <Upload className="h-4 w-4" />
                <div className="h-1 w-full bg-[var(--neutral-150)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--brand-primary)] transition-[width] duration-[var(--duration-fast)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono">{progress}%</span>
              </div>
            ) : (
              <>
                <ImageIcon className="h-5 w-5" />
                <span className="text-[var(--text-xs)] font-medium">Agregar imagen</span>
              </>
            )}
          </button>
        ) : null}
      </div>
      <div className="text-[var(--text-xs)] text-[var(--text-muted)]">
        {images.length}/8 imágenes · JPG o PNG · 2 MB máx por archivo
      </div>
    </div>
  );
}

function SavedIndicator({ savedAt }: { savedAt: Date | null }) {
  if (!savedAt) return null;
  const time = savedAt.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="flex items-center gap-1.5 text-[var(--text-xs)] text-[var(--text-muted)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--success-fg)] animate-pulse" />
      Guardado automáticamente · {time}
    </div>
  );
}
