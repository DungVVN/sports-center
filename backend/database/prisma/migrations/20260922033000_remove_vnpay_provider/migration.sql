-- Keep legacy provider evidence on historical payments while removing VNPAY
-- from the active provider enum. Pending legacy payments remain pending for
-- manual reconciliation; this migration never changes their status or amount.
BEGIN;
ALTER TABLE "payments" ADD COLUMN "legacy_provider" TEXT;
UPDATE "payments"
SET "legacy_provider" = "provider"::text,
    "provider" = NULL
WHERE "provider"::text = 'vnpay';
ALTER TYPE "payment_provider" RENAME TO "payment_provider_legacy";
CREATE TYPE "payment_provider" AS ENUM ('momo', 'zalopay', 'bank', 'payos');
ALTER TABLE "payments"
  ALTER COLUMN "provider" TYPE "payment_provider"
  USING "provider"::text::"payment_provider";
DROP TYPE "payment_provider_legacy";
COMMIT;
