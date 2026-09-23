CREATE UNIQUE INDEX "facility_reservations_pending_unique"
ON "facility_reservations" ("day_id", "requester_user_id", "requested_start_minute", "requested_end_minute")
WHERE "status" = 'pending';
