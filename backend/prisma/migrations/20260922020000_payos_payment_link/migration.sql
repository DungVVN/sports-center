ALTER TYPE "payment_provider" ADD VALUE IF NOT EXISTS 'payos';

ALTER TABLE "payments" ADD COLUMN "provider_order_code" BIGINT;

CREATE UNIQUE INDEX "payments_provider_order_code_key" ON "payments"("provider_order_code");
