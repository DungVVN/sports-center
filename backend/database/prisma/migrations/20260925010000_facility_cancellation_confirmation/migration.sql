ALTER TABLE "facility_reservations"
  ADD COLUMN "cancellation_requested_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN "cancellation_requested_at" TIMESTAMPTZ(6),
  ADD COLUMN "cancellation_reason" TEXT;

CREATE INDEX "facility_reservations_requester_user_id_cancellation_requested_at_idx"
  ON "facility_reservations"("requester_user_id", "cancellation_requested_at");
