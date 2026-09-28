CREATE INDEX "facility_days_open_on_idx" ON "facility_days"("open_on");
CREATE INDEX "facility_reservations_status_requested_at_idx" ON "facility_reservations"("status", "requested_at");
CREATE INDEX "facility_reservations_cancellation_requested_at_status_idx" ON "facility_reservations"("cancellation_requested_at", "status");
