ALTER TABLE "notifications"
  ADD COLUMN "email_delivered_at" TIMESTAMPTZ,
  ADD COLUMN "email_skipped_at" TIMESTAMPTZ,
  ADD COLUMN "email_delivery_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "email_delivery_error" TEXT,
  ADD COLUMN "email_delivery_locked_at" TIMESTAMPTZ;

CREATE INDEX "notifications_email_delivery_idx"
  ON "notifications" ("email_delivered_at", "email_skipped_at", "email_delivery_locked_at");

ALTER TABLE "notification_preferences" ALTER COLUMN "push_enabled" SET DEFAULT false;
