CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TYPE "facility_reservation_status" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

CREATE TABLE "facility_types" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL UNIQUE,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE "facilities" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "type_id" UUID NOT NULL REFERENCES "facility_types"("id") ON DELETE RESTRICT,
  "name" TEXT NOT NULL,
  "open_minute" INTEGER NOT NULL,
  "close_minute" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "facilities_hours_valid" CHECK ("open_minute" >= 0 AND "close_minute" <= 1440 AND "close_minute" > "open_minute"),
  CONSTRAINT "facilities_type_id_name_key" UNIQUE ("type_id", "name")
);

CREATE TABLE "facility_days" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "facility_id" UUID NOT NULL REFERENCES "facilities"("id") ON DELETE RESTRICT,
  "open_on" DATE NOT NULL,
  "created_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "facility_days_facility_id_open_on_key" UNIQUE ("facility_id", "open_on")
);

CREATE TABLE "facility_reservations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "day_id" UUID NOT NULL REFERENCES "facility_days"("id") ON DELETE RESTRICT,
  "requester_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "requested_start_minute" INTEGER NOT NULL,
  "requested_end_minute" INTEGER NOT NULL,
  "assigned_start_minute" INTEGER,
  "assigned_end_minute" INTEGER,
  "participant_count" INTEGER NOT NULL,
  "contact_phone" TEXT NOT NULL,
  "status" "facility_reservation_status" NOT NULL DEFAULT 'pending',
  "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "reviewed_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" TIMESTAMPTZ(6),
  "cancelled_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "cancelled_at" TIMESTAMPTZ(6),
  "decision_reason" TEXT,
  CONSTRAINT "facility_reservation_requested_hours" CHECK ("requested_start_minute" >= 0 AND "requested_end_minute" <= 1440 AND "requested_end_minute" > "requested_start_minute"),
  CONSTRAINT "facility_reservation_assigned_hours" CHECK (("assigned_start_minute" IS NULL AND "assigned_end_minute" IS NULL) OR ("assigned_start_minute" >= 0 AND "assigned_end_minute" <= 1440 AND "assigned_end_minute" > "assigned_start_minute")),
  CONSTRAINT "facility_reservation_approved_has_hours" CHECK ("status" <> 'approved' OR "assigned_start_minute" IS NOT NULL),
  CONSTRAINT "facility_reservation_participants_positive" CHECK ("participant_count" > 0)
);
CREATE INDEX "facility_reservations_requester_user_id_requested_at_idx" ON "facility_reservations"("requester_user_id", "requested_at");
CREATE INDEX "facility_reservations_day_id_status_idx" ON "facility_reservations"("day_id", "status");
ALTER TABLE "facility_reservations" ADD CONSTRAINT "facility_approved_no_overlap" EXCLUDE USING gist (
  "day_id" WITH =,
  int4range("assigned_start_minute", "assigned_end_minute", '[)') WITH &&
) WHERE ("status" = 'approved');

INSERT INTO "permissions" ("code", "description") VALUES
  ('facility.manage', 'Thêm loại sân và sân, cấu hình giờ hoạt động'),
  ('facility.day.manage', 'Mở ngày có thể đặt cho sân'),
  ('facility.booking.self.read', 'Xem đơn đặt sân của bản thân'),
  ('facility.booking.request', 'Gửi yêu cầu đặt sân'),
  ('facility.booking.read', 'Xem chi tiết đơn đặt sân'),
  ('facility.booking.approve', 'Duyệt hoặc từ chối đơn đặt sân'),
  ('facility.booking.cancel', 'Hủy đơn đặt sân có lý do')
ON CONFLICT ("code") DO UPDATE SET "description" = EXCLUDED."description";
