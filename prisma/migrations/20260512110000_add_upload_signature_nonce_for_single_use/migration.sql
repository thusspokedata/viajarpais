-- v0.3-geo-c follow-up post-CodeRabbit: single-use nonces para
-- signatures de upload a Cloudinary (H-1 del audit interno).
--
-- Sin esta tabla, la signature de `getUploadSignature` es válida por
-- ~1h y NO firma el file → un editor malicioso puede cachear la
-- signature en DevTools y subir N archivos hasta saturar el plan Free
-- (25GB). Con esta tabla, cada signature lleva un nonce único; el
-- nonce solo puede registrarse en DB UNA vez (update condicional
-- `WHERE usedAt IS NULL`).
--
-- Cleanup: rows con `createdAt > 24h` deben borrarse periódicamente
-- (cron daily futuro — documentado en AGENTS.md backlog).

CREATE TABLE "UploadSignatureNonce" (
    "nonce"      TEXT     NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt"     TIMESTAMP(3),
    "entityType" TEXT     NOT NULL,
    "entityId"   TEXT     NOT NULL,

    CONSTRAINT "UploadSignatureNonce_pkey" PRIMARY KEY ("nonce")
);

CREATE INDEX "UploadSignatureNonce_usedAt_idx" ON "UploadSignatureNonce"("usedAt");
CREATE INDEX "UploadSignatureNonce_createdAt_idx" ON "UploadSignatureNonce"("createdAt");
