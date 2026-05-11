-- v0.3-geo-b follow-up: CHECK constraint para validar el formato del
-- campo `month` en TranslationUsage.
--
-- El comparador del cuota-month es el unique `(month, provider)`. Sin
-- validación a nivel DB, un malformed `"2026-5"` o `"2026-13"` crearía
-- un bucket separado del canónico `"2026-05"` — la cuota se contaría
-- contra el row equivocado y el unique no atraparía el duplicado.
--
-- Hoy `getCurrentMonth()` en `src/lib/deepl.ts` siempre produce el
-- formato canónico vía `padStart(2)`, así que el riesgo práctico es
-- cero. Pero un refactor futuro del helper, o un script de migración
-- que escriba directo a esta tabla, podría romper la convención
-- silenciosamente. El CHECK explota inmediato en lugar de crear
-- buckets fantasma.
--
-- Defensa en profundidad: cero impacto de performance, valida cada
-- INSERT/UPDATE en O(1). El regex acepta exactamente `YYYY-MM` con
-- `MM` entre 01 y 12.

ALTER TABLE "TranslationUsage"
  ADD CONSTRAINT "TranslationUsage_month_format_check"
  CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
