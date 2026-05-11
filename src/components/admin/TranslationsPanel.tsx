"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
  cn,
} from "@/components/ui";
import { ChevronDown, ChevronUp } from "@/components/ui/icons";
import {
  forceRetranslateField,
  markTranslationManuallyEdited,
  retryPendingTranslations,
} from "@/server/actions/translations";
import type { EntityType } from "@/lib/translations/dispatcher";
import type {
  TranslationOutcome,
  TranslationStatus,
} from "@/lib/translations/orchestrator";

/*
  Panel de traducciones compartido para los 5 niveles editables del PR:
  Region, Province, Department, Locality, Listing.

  Estructura:
  - Header colapsable "Traducciones" con el resumen de outcomes.
  - Banner de pendingRetry global (si hay algún campo en pending).
  - 2 columnas (English / Português) lado a lado.
  - Por columna:
    - Drift banner si el `*Es` cambió después de un REVIEWED/HUMAN.
    - Badge de source: Auto/Revisada/Manual/Vacía.
    - Texto leído del idioma destino (tagline + descripción).
    - "Editar manualmente" abre textarea inline + guarda como REVIEWED.
    - "Re-traducir desde español" → modal si source es REVIEWED/HUMAN.

  Los handlers de las server actions ya devuelven `TranslationStatus`
  por idioma — usamos eso para los toasts diferenciados.
*/

export type TranslationFieldsView = {
  taglineEs: string | null;
  descriptionEs: string | null;

  taglineEn: string | null;
  taglineEnSource: "NONE" | "MACHINE" | "REVIEWED" | "HUMAN";
  taglineEnTranslatedAt: string | null;
  taglineEnPendingRetry: boolean;
  descriptionEn: string | null;
  descriptionEnSource: "NONE" | "MACHINE" | "REVIEWED" | "HUMAN";
  descriptionEnTranslatedAt: string | null;
  descriptionEnPendingRetry: boolean;

  taglinePtBr: string | null;
  taglinePtBrSource: "NONE" | "MACHINE" | "REVIEWED" | "HUMAN";
  taglinePtBrTranslatedAt: string | null;
  taglinePtBrPendingRetry: boolean;
  descriptionPtBr: string | null;
  descriptionPtBrSource: "NONE" | "MACHINE" | "REVIEWED" | "HUMAN";
  descriptionPtBrTranslatedAt: string | null;
  descriptionPtBrPendingRetry: boolean;
};

export type TranslationsPanelProps = {
  entityType: EntityType;
  entityId: string;
  /**
   * Identificador para el `revalidatePath` post-acción. Geo usa `code`,
   * Listing usa `id`. Si no se pasa, las acciones igual funcionan, solo
   * que el editor tendrá que recargar para ver el panel actualizado.
   */
  revalidateIdentifier?: string;
  /**
   * El `updatedAt` del registro padre (Region/Province/etc.). Se usa
   * para detectar drift: si una traducción `REVIEWED` fue generada
   * antes de `parentUpdatedAt`, mostramos banner "el texto base
   * cambió".
   */
  parentUpdatedAt: string; // ISO
  translations: TranslationFieldsView;
};

type Lang = "en-US" | "pt-BR";

const LANG_LABELS: Record<Lang, string> = {
  "en-US": "English",
  "pt-BR": "Português (Brasil)",
};

const SOURCE_BADGE: Record<
  "NONE" | "MACHINE" | "REVIEWED" | "HUMAN",
  { label: string; tone: "default" | "info" | "warning" | "success" }
> = {
  NONE: { label: "Vacía", tone: "default" },
  MACHINE: { label: "Auto", tone: "info" },
  REVIEWED: { label: "Revisada", tone: "success" },
  HUMAN: { label: "Manual", tone: "success" },
};

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return "hace unos segundos";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60)
    return `hace ${diffMin} minuto${diffMin === 1 ? "" : "s"}`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr} hora${diffHr === 1 ? "" : "s"}`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `hace ${diffDay} día${diffDay === 1 ? "" : "s"}`;
  const diffMo = Math.round(diffDay / 30);
  return `hace ${diffMo} mes${diffMo === 1 ? "" : "es"}`;
}

export function TranslationsPanel(props: TranslationsPanelProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const { translations: t, entityType, entityId, revalidateIdentifier, parentUpdatedAt } = props;

  const hasPendingRetry =
    t.taglineEnPendingRetry ||
    t.taglinePtBrPendingRetry ||
    t.descriptionEnPendingRetry ||
    t.descriptionPtBrPendingRetry;

  const handleRetryPending = () => {
    startTransition(async () => {
      const res = await retryPendingTranslations({
        entityType,
        entityId,
        revalidateIdentifier,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      showToastForStatus(res.status, "Traducciones reintentadas");
    });
  };

  return (
    <section
      className="border border-[var(--border-subtle)] rounded-[var(--radius-lg)] bg-[var(--surface-base)]"
      aria-label="Panel de traducciones"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="translations-panel-content"
        className={cn(
          "w-full flex items-center justify-between gap-3 px-4 py-3",
          "text-left hover:bg-[var(--surface-sunken)]/40 transition-colors",
          "focus:outline-none focus-visible:shadow-[var(--shadow-focus)]",
          open ? "rounded-t-[var(--radius-lg)]" : "rounded-[var(--radius-lg)]",
        )}
      >
        <span className="flex items-center gap-2">
          <span className="font-display text-[var(--text-md)] font-semibold text-[var(--text-primary)]">
            Traducciones
          </span>
          {hasPendingRetry ? (
            <Badge variant="warning" size="sm">
              Pendientes
            </Badge>
          ) : null}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" aria-hidden />
        ) : (
          <ChevronDown
            className="h-4 w-4 text-[var(--text-muted)]"
            aria-hidden
          />
        )}
      </button>

      {open ? (
        <div
          id="translations-panel-content"
          className="px-4 pb-4 pt-2 flex flex-col gap-4 border-t border-[var(--border-subtle)]"
        >
          {hasPendingRetry ? (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 px-3 py-2 rounded-[var(--radius-md)] border border-[var(--warning-fg)]/40 bg-[var(--warning-bg)]"
            >
              <p className="text-[var(--text-sm)] text-[var(--warning-fg)]">
                Quedaron traducciones sin generar (DeepL falló o la cuota
                estaba agotada). Reintentá ahora.
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleRetryPending}
                disabled={pending}
              >
                {pending ? "Reintentando…" : "Reintentar ahora"}
              </Button>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <TranslationColumn
              lang="en-US"
              translations={t}
              entityType={entityType}
              entityId={entityId}
              revalidateIdentifier={revalidateIdentifier}
              parentUpdatedAt={parentUpdatedAt}
              disabled={pending}
            />
            <TranslationColumn
              lang="pt-BR"
              translations={t}
              entityType={entityType}
              entityId={entityId}
              revalidateIdentifier={revalidateIdentifier}
              parentUpdatedAt={parentUpdatedAt}
              disabled={pending}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

type ColumnProps = Omit<TranslationsPanelProps, "translations"> & {
  lang: Lang;
  translations: TranslationFieldsView;
  disabled: boolean;
};

function TranslationColumn({
  lang,
  translations: t,
  entityType,
  entityId,
  revalidateIdentifier,
  parentUpdatedAt,
  disabled,
}: ColumnProps) {
  const isEn = lang === "en-US";

  const taglineText = isEn ? t.taglineEn : t.taglinePtBr;
  const descriptionText = isEn ? t.descriptionEn : t.descriptionPtBr;
  const taglineSource = isEn ? t.taglineEnSource : t.taglinePtBrSource;
  const descriptionSource = isEn
    ? t.descriptionEnSource
    : t.descriptionPtBrSource;
  const taglineAt = isEn ? t.taglineEnTranslatedAt : t.taglinePtBrTranslatedAt;
  const descriptionAt = isEn
    ? t.descriptionEnTranslatedAt
    : t.descriptionPtBrTranslatedAt;
  const taglinePending = isEn
    ? t.taglineEnPendingRetry
    : t.taglinePtBrPendingRetry;
  const descriptionPending = isEn
    ? t.descriptionEnPendingRetry
    : t.descriptionPtBrPendingRetry;

  /*
    Drift detection: el `*Es` cambió DESPUÉS del último `translatedAt`
    de una versión REVIEWED/HUMAN. Comparamos `parentUpdatedAt` (que
    refleja el último save del registro padre) contra el translatedAt
    de cada campo. Si REVIEWED/HUMAN + translatedAt < parentUpdatedAt,
    aparece banner — el editor decide si re-traducir.
  */
  const taglineDrift = hasDrift(taglineSource, taglineAt, parentUpdatedAt);
  const descriptionDrift = hasDrift(
    descriptionSource,
    descriptionAt,
    parentUpdatedAt,
  );

  const [editing, setEditing] = React.useState(false);
  const [taglineDraft, setTaglineDraft] = React.useState(taglineText ?? "");
  const [descriptionDraft, setDescriptionDraft] = React.useState(
    descriptionText ?? "",
  );

  /*
    Cuando el server state cambia (revalidate después de un save manual
    o un retry exitoso), queremos que los drafts vuelvan a reflejar la
    versión nueva. Antes lo hacíamos con `useEffect` pero React 19
    desaconseja `setState` dentro de effects — alternativa idiomática:
    inicializar los drafts cuando el editor entra en modo edición. Si
    ya está editando, no pisamos sus cambios en curso.

    Si el editor querría "tirar mis cambios y empezar con el texto
    nuevo del server", el botón "Cancelar" abajo hace exactamente eso.
  */
  const openEditing = () => {
    setTaglineDraft(taglineText ?? "");
    setDescriptionDraft(descriptionText ?? "");
    setEditing(true);
  };

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [submitting, startTransition] = React.useTransition();

  const handleSaveReviewed = () => {
    startTransition(async () => {
      const res = await markTranslationManuallyEdited({
        entityType,
        entityId,
        lang,
        revalidateIdentifier,
        taglineText: taglineDraft.trim() === "" ? null : taglineDraft,
        descriptionText:
          descriptionDraft.trim() === "" ? null : descriptionDraft,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(`Traducción marcada como revisada (${LANG_LABELS[lang]}).`);
      setEditing(false);
    });
  };

  const handleForceRetranslate = () => {
    startTransition(async () => {
      const res = await forceRetranslateField({
        entityType,
        entityId,
        lang,
        revalidateIdentifier,
      });
      setConfirmOpen(false);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      showToastForStatus(
        res.status,
        `Re-traducción a ${LANG_LABELS[lang]}`,
      );
    });
  };

  const needsConfirm =
    taglineSource === "REVIEWED" ||
    taglineSource === "HUMAN" ||
    descriptionSource === "REVIEWED" ||
    descriptionSource === "HUMAN";

  const onClickForceRetranslate = () => {
    if (needsConfirm) {
      setConfirmOpen(true);
      return;
    }
    handleForceRetranslate();
  };

  return (
    <div className="flex flex-col gap-3 p-4 rounded-[var(--radius-md)] bg-[var(--surface-canvas)] border border-[var(--border-subtle)]">
      <header className="flex items-center justify-between gap-2">
        <h4 className="font-display text-[var(--text-md)] font-semibold text-[var(--text-primary)]">
          {LANG_LABELS[lang]}
        </h4>
      </header>

      {taglineDrift || descriptionDrift ? (
        <div
          role="alert"
          className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--warning-fg)]/40 bg-[var(--warning-bg)] text-[var(--text-sm)] text-[var(--warning-fg)]"
        >
          El texto en español cambió. La traducción revisada al{" "}
          {LANG_LABELS[lang].toLowerCase()} puede estar desactualizada.
        </div>
      ) : null}

      <Field
        label="Tagline"
        text={taglineText}
        source={taglineSource}
        translatedAt={taglineAt}
        pendingRetry={taglinePending}
        editing={editing}
        draftValue={taglineDraft}
        onDraftChange={setTaglineDraft}
        rows={2}
        maxLength={120}
      />

      <Field
        label="Descripción"
        text={descriptionText}
        source={descriptionSource}
        translatedAt={descriptionAt}
        pendingRetry={descriptionPending}
        editing={editing}
        draftValue={descriptionDraft}
        onDraftChange={setDescriptionDraft}
        rows={8}
        maxLength={5000}
      />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {editing ? (
          <>
            <Button
              size="sm"
              onClick={handleSaveReviewed}
              disabled={submitting || disabled}
            >
              {submitting ? "Guardando…" : "Guardar como revisada"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setTaglineDraft(taglineText ?? "");
                setDescriptionDraft(descriptionText ?? "");
                setEditing(false);
              }}
              disabled={submitting || disabled}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={openEditing}
              disabled={submitting || disabled}
            >
              Editar manualmente
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClickForceRetranslate}
              disabled={submitting || disabled}
            >
              {submitting ? "Re-traduciendo…" : "Re-traducir desde español"}
            </Button>
          </>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sobrescribir traducción revisada</DialogTitle>
            <DialogDescription>
              Esto va a sobrescribir la traducción revisada con una versión
              nueva de DeepL. El trabajo manual existente se va a perder.
              ¿Continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" disabled={submitting}>
                Cancelar
              </Button>
            </DialogClose>
            <Button onClick={handleForceRetranslate} disabled={submitting}>
              {submitting ? "Re-traduciendo…" : "Sí, sobrescribir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type FieldProps = {
  label: string;
  text: string | null;
  source: "NONE" | "MACHINE" | "REVIEWED" | "HUMAN";
  translatedAt: string | null;
  pendingRetry: boolean;
  editing: boolean;
  draftValue: string;
  onDraftChange: (value: string) => void;
  rows: number;
  maxLength: number;
};

function Field({
  label,
  text,
  source,
  translatedAt,
  pendingRetry,
  editing,
  draftValue,
  onDraftChange,
  rows,
  maxLength,
}: FieldProps) {
  const badge = SOURCE_BADGE[source];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-display uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
          {label}
        </span>
        <span className="flex items-center gap-1.5">
          <Badge variant={badge.tone} size="sm">
            {badge.label}
          </Badge>
          {pendingRetry ? (
            <Badge variant="warning" size="sm">
              Pendiente
            </Badge>
          ) : null}
          <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
            {formatRelative(translatedAt)}
          </span>
        </span>
      </div>
      {editing ? (
        <Textarea
          value={draftValue}
          onChange={(e) => onDraftChange(e.target.value)}
          rows={rows}
          maxLength={maxLength}
        />
      ) : text ? (
        <p className="text-[var(--text-sm)] text-[var(--text-primary)] whitespace-pre-line">
          {text}
        </p>
      ) : (
        <p className="text-[var(--text-sm)] italic text-[var(--text-muted)]">
          (sin contenido)
        </p>
      )}
    </div>
  );
}

function hasDrift(
  source: "NONE" | "MACHINE" | "REVIEWED" | "HUMAN",
  translatedAt: string | null,
  parentUpdatedAt: string,
): boolean {
  if (source !== "REVIEWED" && source !== "HUMAN") return false;
  if (!translatedAt) return false;
  return new Date(translatedAt).getTime() < new Date(parentUpdatedAt).getTime();
}

/**
 * Toast diferenciado según el outcome agregado de EN y PT-BR. Misma
 * lógica que `EditorialContentForm` después de un update — pero
 * adaptado a las acciones del panel (retry, force-retranslate).
 */
function showToastForStatus(status: TranslationStatus, basePrefix: string) {
  const allGood = isPositive(status.en) && isPositive(status.ptBr);
  const anyQuota = status.en === "quota" || status.ptBr === "quota";
  const anyFailed = status.en === "failed" || status.ptBr === "failed";

  if (allGood) {
    toast.success(`${basePrefix}: ambos idiomas listos.`);
    return;
  }
  if (anyQuota) {
    toast.warning(
      "Cuota mensual de DeepL agotada. Las traducciones pendientes se retomarán el mes próximo o en un reintento manual.",
    );
    return;
  }
  if (anyFailed) {
    toast.warning(
      "DeepL respondió con error en al menos un idioma. Probá reintentar desde el banner.",
    );
    return;
  }
  // Edge case: ambos skipped o uno solo success/uno skipped.
  toast.success(basePrefix);
}

function isPositive(outcome: TranslationOutcome): boolean {
  return outcome === "success" || outcome === "skipped";
}
