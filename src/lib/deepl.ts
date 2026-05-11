import "server-only";
import * as deepl from "deepl-node";
import { prisma } from "@/lib/db";

/*
  Helper de DeepL para traducción automática de contenido editorial.
  Cubre los 4 niveles geográficos + Listings. Solo se traducen
  `descriptionEs` y `taglineEs` — meta titles/descriptions, nombres y
  topónimos quedan intactos por decisión de producto (ver AGENTS.md
  sección "i18n del contenido editorial").

  Política fail-fast en module-load: si `DEEPL_API_KEY` no está seteada,
  el import explota. Mismo patrón que `db.ts`, `auth.ts` y `cloudinary.ts`.
  CI workflow ships un placeholder `00000000-...:fx` para satisfacer este
  contrato sin acceso real al API. Cualquier route handler que importe
  `translateText` ya está dentro del scope donde el env var es requerido,
  no opcional.

  Free vs Pro: la lib auto-detecta por sufijo `:fx` en la auth key (Free
  termina en `:fx`, Pro no). No hace falta cablear el plan acá.
*/

const authKey = process.env.DEEPL_API_KEY;
if (!authKey) {
  throw new Error("DEEPL_API_KEY is not set");
}
const translator = new deepl.Translator(authKey);

/**
 * Límite mensual de caracteres de DeepL Free Plan. Si se sube a Pro,
 * ajustar acá. Pro tiene cuota mucho mayor (1M+ chars/mes default y
 * facturación por uso) — el chequeo de quota pasa a ser una alerta
 * más que un cap duro, pero el flujo del código no cambia.
 */
export const FREE_PLAN_CHAR_LIMIT = 500_000;

/**
 * Threshold de logueo de warning de cuota. Cuando se cruza este % en
 * un solo incremento (de < threshold a >= threshold), se loguea un
 * `console.warn` con el porcentaje. Cuando llegue Resend, ese log se
 * convierte en email al admin.
 */
const QUOTA_WARN_THRESHOLD = 0.8;

/**
 * Backoff entre retries para errores transitorios (timeout, 5xx,
 * `TooManyRequestsError`, `ConnectionError`). El primer intento es
 * inmediato; los siguientes esperan 1s, 3s, 9s respectivamente. 3
 * retries total. Si los 3 fallan, devolvemos `RETRY_EXHAUSTED` y la
 * server action prende el flag `*PendingRetry` para que el editor
 * pueda dispararlo de nuevo desde el admin.
 */
const RETRY_DELAYS_MS = [1_000, 3_000, 9_000] as const;
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1; // 1 inicial + 3 retries

/**
 * Tope conservador del payload por llamada — `descriptionEs` tiene
 * max de 5000 chars en zod, taglineEs tope 120. Ambos lejos de este
 * límite. Lo mantenemos para defensa contra inputs anómalos (ej. un
 * editor pegando 50k chars por error que volaría la cuota de un solo
 * save).
 */
const MAX_INPUT_CHARS = 10_000;

export type TranslationTarget = "en-US" | "pt-BR";

export type TranslationResult =
  | { ok: true; text: string; charactersUsed: number }
  | {
      ok: false;
      reason: "QUOTA_EXCEEDED" | "RETRY_EXHAUSTED" | "INVALID_INPUT";
      details?: string;
    };

/**
 * Devuelve el mes actual en formato `YYYY-MM`. Se usa como clave de
 * `TranslationUsage`. Operación pura, sin DB. UTC para evitar drift
 * entre regiones del runtime — todos los environments comparten el
 * mismo mes a la misma hora.
 */
export function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export type QuotaStatus = {
  charactersUsed: number;
  charactersLimit: number;
  percentUsed: number; // 0..1
  isExceeded: boolean;
  isNearLimit: boolean; // ≥ 80%
  month: string;
};

/**
 * Lee el estado de cuota del mes actual. Si no hay row, devuelve 0
 * usados — no creamos el row hasta que se consume al menos 1 char,
 * para no contaminar la tabla con meses inactivos.
 */
export async function getQuotaStatus(): Promise<QuotaStatus> {
  const month = getCurrentMonth();
  const row = await prisma.translationUsage.findUnique({
    where: { month_provider: { month, provider: "deepl" } },
  });
  const used = row?.charactersUsed ?? 0;
  const percent = used / FREE_PLAN_CHAR_LIMIT;
  return {
    charactersUsed: used,
    charactersLimit: FREE_PLAN_CHAR_LIMIT,
    percentUsed: percent,
    isExceeded: used >= FREE_PLAN_CHAR_LIMIT,
    isNearLimit: percent >= QUOTA_WARN_THRESHOLD,
    month,
  };
}

/**
 * Traduce `text` de español a `targetLang` con retries exponenciales y
 * tracking de cuota. Política completa:
 *
 * 1. Valida que el input no esté vacío ni exceda `MAX_INPUT_CHARS`.
 * 2. Chequea cuota mensual pre-llamada. Si está agotada, devuelve
 *    `QUOTA_EXCEEDED` sin tocar la red.
 * 3. Llama a DeepL hasta `MAX_ATTEMPTS` veces (1 + 3 retries) con
 *    backoff `RETRY_DELAYS_MS`. Errores transitorios (timeout, 5xx,
 *    rate limit, network) gatillan retry; `QuotaExceededError` y
 *    `AuthorizationError` cortan inmediato (no tiene sentido reintentar).
 * 4. Si éxito, incrementa `charactersUsed` atómicamente. El conteo se
 *    basa en `text.length` (lo que enviamos) — DeepL factura por
 *    caracteres origen, no por caracteres traducidos.
 * 5. Loguea warning si el incremento cruzó el 80% del cap.
 *
 * Trade-off de race condition en el pre-check: dos saves concurrentes
 * pueden ambos pasar el check con `charactersUsed` justo por debajo
 * del cap y pasarse 1-2 chunks. En Free plan (500k chars/mes) es
 * inofensivo — DeepL responde `QuotaExceededError` cuando se cruza
 * efectivamente y devolvemos `QUOTA_EXCEEDED` también. Si se necesita
 * exactitud absoluta (Pro plan con cobro estricto), sustituir el
 * pre-check por `SELECT ... FOR UPDATE` en transacción explícita.
 */
export async function translateText(
  text: string,
  targetLang: TranslationTarget,
): Promise<TranslationResult> {
  // 1. Validación de input.
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "INVALID_INPUT", details: "empty_text" };
  }
  if (text.length > MAX_INPUT_CHARS) {
    return {
      ok: false,
      reason: "INVALID_INPUT",
      details: `text_too_long: ${text.length} > ${MAX_INPUT_CHARS}`,
    };
  }

  // 2. Pre-check de cuota.
  const status = await getQuotaStatus();
  if (status.isExceeded) {
    return { ok: false, reason: "QUOTA_EXCEEDED" };
  }

  // 3. Llamada con retries.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
    try {
      const result = await translator.translateText(text, "es", targetLang);
      // `translateText` con string singular devuelve `TextResult`, no
      // array. El tipo conditional del SDK lo refleja, pero TS infiere
      // como union — chequeo defensivo.
      const translated = Array.isArray(result) ? result[0]?.text ?? "" : result.text;

      // 4. Increment atómico.
      const charsConsumed = text.length;
      await incrementUsage(charsConsumed, status.charactersUsed);

      return { ok: true, text: translated, charactersUsed: charsConsumed };
    } catch (err) {
      lastError = err;

      // Errores fatales (no tiene sentido reintentar):
      if (err instanceof deepl.QuotaExceededError) {
        return {
          ok: false,
          reason: "QUOTA_EXCEEDED",
          details: err.message,
        };
      }
      if (err instanceof deepl.AuthorizationError) {
        // La key está mal — un retry no la va a arreglar. Salimos como
        // RETRY_EXHAUSTED para que la server action marque pending y
        // el admin pueda ver el detalle en el log.
        console.error("[DeepL] AuthorizationError — verificar DEEPL_API_KEY:", err.message);
        return {
          ok: false,
          reason: "RETRY_EXHAUSTED",
          details: `authorization_error: ${err.message}`,
        };
      }

      // Errores transitorios: el loop sigue, próximo iter espera el
      // siguiente delay (o termina si ya gastó todos los attempts).
    }
  }

  return {
    ok: false,
    reason: "RETRY_EXHAUSTED",
    details:
      lastError instanceof Error
        ? `${lastError.constructor.name}: ${lastError.message}`
        : String(lastError),
  };
}

/**
 * Incremento atómico de `charactersUsed`. Usa upsert con `increment`
 * para que el UPDATE se compile a `SET charactersUsed = charactersUsed
 * + N` — seguro contra concurrencia sin transacción explícita.
 *
 * `previousUsed` se pasa por argumento para detectar exactamente el
 * cruce de 80% en este save (en vez de loggear repetidamente cada
 * incremento por encima del threshold). Si pre-incremento estaba <
 * 80% y post-incremento está >= 80%, log de warning.
 */
async function incrementUsage(
  charactersConsumed: number,
  previousUsed: number,
): Promise<void> {
  const month = getCurrentMonth();
  const updated = await prisma.translationUsage.upsert({
    where: { month_provider: { month, provider: "deepl" } },
    create: {
      month,
      provider: "deepl",
      charactersUsed: charactersConsumed,
    },
    update: {
      charactersUsed: { increment: charactersConsumed },
    },
  });

  const newPercent = updated.charactersUsed / FREE_PLAN_CHAR_LIMIT;
  const previousPercent = previousUsed / FREE_PLAN_CHAR_LIMIT;
  if (newPercent >= QUOTA_WARN_THRESHOLD && previousPercent < QUOTA_WARN_THRESHOLD) {
    console.warn(
      `[DeepL] Quota cruzó el ${Math.round(QUOTA_WARN_THRESHOLD * 100)}%: ` +
        `${updated.charactersUsed}/${FREE_PLAN_CHAR_LIMIT} caracteres ` +
        `(${(newPercent * 100).toFixed(1)}%) en ${month}. ` +
        `TODO: convertir a email vía Resend cuando esté la cuenta verificada.`,
    );
  }
}
