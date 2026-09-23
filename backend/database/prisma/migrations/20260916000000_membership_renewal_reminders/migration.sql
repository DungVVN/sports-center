CREATE TYPE "membership_reminder_type" AS ENUM ('pre_expiry', 'grace');

CREATE TABLE "membership_renewal_reminders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "membership_id" UUID NOT NULL,
  "reminder_type" "membership_reminder_type" NOT NULL,
  "reminder_on" DATE NOT NULL,
  "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "membership_renewal_reminders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "membership_renewal_reminders_membership_id_reminder_type_reminder_on_key"
  ON "membership_renewal_reminders"("membership_id", "reminder_type", "reminder_on");

CREATE INDEX "membership_renewal_reminders_membership_id_reminder_on_idx"
  ON "membership_renewal_reminders"("membership_id", "reminder_on");
