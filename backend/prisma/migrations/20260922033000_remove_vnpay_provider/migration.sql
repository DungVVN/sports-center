DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "payments" WHERE "provider"::text = 'vnpay') THEN
    RAISE EXCEPTION 'Cannot remove payment provider vnpay while payments still reference it. Archive or migrate those records before deploying this migration.';
  END IF;
END
$$;

ALTER TYPE "payment_provider" RENAME TO "payment_provider_legacy";
CREATE TYPE "payment_provider" AS ENUM ('momo', 'zalopay', 'bank', 'payos');
ALTER TABLE "payments"
  ALTER COLUMN "provider" TYPE "payment_provider"
  USING "provider"::text::"payment_provider";
DROP TYPE "payment_provider_legacy";
