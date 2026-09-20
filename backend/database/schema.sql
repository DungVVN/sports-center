-- Kinetic Sports Center — PostgreSQL 16+ schema
-- Apply once to an empty database: psql "$DATABASE_URL" -f database/schema.sql
-- This schema intentionally does not create a database, server, or application login.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('manager', 'receptionist', 'coach', 'member');
CREATE TYPE account_status AS ENUM ('active', 'suspended');
CREATE TYPE membership_status AS ENUM ('active', 'expiring_soon', 'expired', 'frozen', 'cancelled');
CREATE TYPE class_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled', 'attended', 'absent');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'not_marked');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'bank_transfer', 'online');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE refund_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE support_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE notification_category AS ENUM ('member', 'finance', 'operations', 'system');

CREATE TABLE roles (
  code user_role PRIMARY KEY,
  label text NOT NULL
);

CREATE TABLE permissions (
  code text PRIMARY KEY CHECK (code ~ '^[a-z]+(\.[a-z_]+)+$'),
  description text NOT NULL
);

CREATE TABLE role_permissions (
  role_code user_role NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_code, permission_code)
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  role user_role NOT NULL,
  status account_status NOT NULL DEFAULT 'active',
  avatar_url text,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_lowercase CHECK (email = lower(email)),
  CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE TABLE staff_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  employee_code text NOT NULL UNIQUE,
  specialties text[] NOT NULL DEFAULT '{}',
  hired_at date NOT NULL DEFAULT current_date
);

CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  member_code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text,
  phone text NOT NULL,
  date_of_birth date,
  gender text,
  joined_at date NOT NULL DEFAULT current_date,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT members_email_lowercase CHECK (email IS NULL OR email = lower(email))
);

CREATE UNIQUE INDEX members_email_unique_when_present ON members (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX members_phone_unique ON members (phone);

CREATE TABLE member_emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relationship text NOT NULL,
  phone text NOT NULL,
  is_primary boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX one_primary_emergency_contact_per_member
  ON member_emergency_contacts(member_id) WHERE is_primary;

CREATE TABLE membership_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  price_vnd bigint NOT NULL CHECK (price_vnd >= 0),
  duration_days integer NOT NULL CHECK (duration_days > 0),
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE member_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  package_id uuid NOT NULL REFERENCES membership_packages(id) ON DELETE RESTRICT,
  package_name_snapshot text NOT NULL,
  price_vnd_snapshot bigint NOT NULL CHECK (price_vnd_snapshot >= 0),
  status membership_status NOT NULL DEFAULT 'active',
  starts_on date NOT NULL,
  expires_on date NOT NULL,
  frozen_days integer NOT NULL DEFAULT 0 CHECK (frozen_days >= 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_on >= starts_on)
);
CREATE INDEX member_memberships_member_status_idx ON member_memberships(member_id, status, expires_on DESC);

CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  capacity integer NOT NULL CHECK (capacity > 0),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  type text NOT NULL,
  coach_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  status class_status NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX class_sessions_schedule_idx ON class_sessions(starts_at, status);
CREATE INDEX class_sessions_coach_schedule_idx ON class_sessions(coach_user_id, starts_at);

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code text NOT NULL UNIQUE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  class_session_id uuid NOT NULL REFERENCES class_sessions(id) ON DELETE RESTRICT,
  status booking_status NOT NULL DEFAULT 'confirmed',
  booked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  booked_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  cancel_reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
  CHECK (status <> 'cancelled' OR length(trim(coalesce(cancel_reason, ''))) > 0)
);
CREATE UNIQUE INDEX one_live_booking_per_member_class
  ON bookings(member_id, class_session_id) WHERE status <> 'cancelled';
CREATE INDEX bookings_class_status_idx ON bookings(class_session_id, status);
CREATE INDEX bookings_member_booked_at_idx ON bookings(member_id, booked_at DESC);

CREATE TABLE attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_session_id uuid NOT NULL REFERENCES class_sessions(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  booking_id uuid UNIQUE REFERENCES bookings(id) ON DELETE SET NULL,
  status attendance_status NOT NULL DEFAULT 'not_marked',
  checked_in_at timestamptz,
  recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_session_id, member_id)
);

CREATE TABLE attendance_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES attendance_records(id) ON DELETE RESTRICT,
  previous_status attendance_status NOT NULL,
  new_status attendance_status NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) >= 3),
  requested_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (new_status <> previous_status)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_code text NOT NULL UNIQUE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  membership_id uuid REFERENCES member_memberships(id) ON DELETE RESTRICT,
  amount_vnd bigint NOT NULL CHECK (amount_vnd > 0),
  method payment_method NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  recorded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notes text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'paid') = (paid_at IS NOT NULL))
);
CREATE INDEX payments_member_created_idx ON payments(member_id, created_at DESC);
CREATE INDEX payments_status_created_idx ON payments(status, created_at DESC);

CREATE TABLE payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  previous_status payment_status,
  new_status payment_status NOT NULL,
  amount_vnd bigint NOT NULL CHECK (amount_vnd > 0),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  note text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_code text NOT NULL UNIQUE,
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  amount_vnd bigint NOT NULL CHECK (amount_vnd > 0),
  reason text NOT NULL CHECK (length(trim(reason)) >= 3),
  status refund_status NOT NULL DEFAULT 'pending',
  requested_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'pending') = (reviewed_at IS NULL))
);
CREATE INDEX refund_requests_status_created_idx ON refund_requests(status, created_at DESC);

CREATE TABLE training_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  coach_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name text NOT NULL,
  goal text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'completed', 'paused')),
  coach_approved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);
CREATE INDEX training_plans_member_idx ON training_plans(member_id, status, ends_on DESC);
CREATE INDEX training_plans_coach_idx ON training_plans(coach_user_id, status);

CREATE TABLE training_plan_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  name text NOT NULL,
  sets integer NOT NULL CHECK (sets > 0),
  reps integer CHECK (reps > 0),
  duration_seconds integer CHECK (duration_seconds > 0),
  rest_seconds integer NOT NULL CHECK (rest_seconds >= 0),
  instructions text,
  CHECK (reps IS NOT NULL OR duration_seconds IS NOT NULL),
  UNIQUE(plan_id, position)
);

CREATE TABLE training_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES training_plans(id) ON DELETE RESTRICT,
  exercise_id uuid REFERENCES training_plan_exercises(id) ON DELETE SET NULL,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  recorded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_on date NOT NULL,
  value_numeric numeric(12,2),
  value_text text,
  metric text NOT NULL,
  coach_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (value_numeric IS NOT NULL OR value_text IS NOT NULL)
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category notification_category NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  link_path text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_recipient_unread_idx ON notifications(recipient_user_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code text NOT NULL UNIQUE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  subject text NOT NULL,
  body text NOT NULL,
  status support_status NOT NULL DEFAULT 'open',
  priority text NOT NULL CHECK (priority IN ('low', 'normal', 'high')),
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_ticket_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  summary text NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_entity_idx ON audit_logs(entity_type, entity_id, occurred_at DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs(actor_user_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION require_active_membership_for_booking()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE session_row class_sessions; live_membership member_memberships;
DECLARE booked_count integer;
BEGIN
  SELECT * INTO session_row FROM class_sessions WHERE id = NEW.class_session_id FOR UPDATE;
  IF NOT FOUND OR session_row.status <> 'published' THEN
    RAISE EXCEPTION 'Class is not available for booking';
  END IF;
  SELECT * INTO live_membership FROM member_memberships
    WHERE member_id = NEW.member_id AND status IN ('active', 'expiring_soon')
      AND starts_on <= session_row.starts_at::date AND expires_on >= session_row.starts_at::date
    ORDER BY expires_on DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member does not have an active membership'; END IF;
  SELECT count(*) INTO booked_count FROM bookings
    WHERE class_session_id = NEW.class_session_id AND status IN ('confirmed', 'attended');
  IF booked_count >= session_row.capacity THEN RAISE EXCEPTION 'Class is at capacity'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION require_manager_for_refund_approval()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reviewer_role user_role;
BEGIN
  IF NEW.status IN ('approved', 'rejected') AND OLD.status = 'pending' THEN
    SELECT role INTO reviewer_role FROM users WHERE id = NEW.reviewed_by;
    IF reviewer_role IS DISTINCT FROM 'manager' THEN
      RAISE EXCEPTION 'Only a manager can approve or reject a refund';
    END IF;
    NEW.reviewed_at = coalesce(NEW.reviewed_at, now());
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION prevent_settled_payment_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('paid', 'refunded') AND
     (NEW.member_id, NEW.membership_id, NEW.amount_vnd, NEW.method, NEW.paid_at) IS DISTINCT FROM
     (OLD.member_id, OLD.membership_id, OLD.amount_vnd, OLD.method, OLD.paid_at) THEN
    RAISE EXCEPTION 'Settled payment fields are immutable; create a payment event or refund instead';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER members_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER packages_updated_at BEFORE UPDATE ON membership_packages FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER memberships_updated_at BEFORE UPDATE ON member_memberships FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON class_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER attendance_updated_at BEFORE UPDATE ON attendance_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER settled_payment_immutable BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION prevent_settled_payment_mutation();
CREATE TRIGGER refunds_updated_at BEFORE UPDATE ON refund_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER manager_refund_approval BEFORE UPDATE ON refund_requests FOR EACH ROW EXECUTE FUNCTION require_manager_for_refund_approval();
CREATE TRIGGER plans_updated_at BEFORE UPDATE ON training_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER enforce_booking_rules BEFORE INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION require_active_membership_for_booking();

INSERT INTO roles(code, label) VALUES
  ('manager', 'Quản lý'), ('receptionist', 'Lễ tân'), ('coach', 'Huấn luyện viên'), ('member', 'Hội viên');

INSERT INTO permissions(code, description) VALUES
  ('member.read', 'Xem hồ sơ hội viên'), ('member.write', 'Tạo và cập nhật hội viên'),
  ('class.read', 'Xem lớp học'), ('class.manage', 'Tạo và quản lý lớp học'),
  ('booking.write', 'Tạo và hủy đặt chỗ'), ('attendance.write', 'Ghi nhận điểm danh'),
  ('payment.record', 'Ghi nhận thanh toán'), ('refund.approve', 'Duyệt hoàn tiền'),
  ('training.write', 'Tạo kế hoạch và kết quả tập luyện'), ('report.read', 'Xem báo cáo'),
  ('staff.manage', 'Quản lý nhân viên'), ('audit.read', 'Xem nhật ký kiểm toán');

INSERT INTO role_permissions(role_code, permission_code)
SELECT 'manager', code FROM permissions;
INSERT INTO role_permissions(role_code, permission_code) VALUES
  ('receptionist', 'member.read'), ('receptionist', 'member.write'), ('receptionist', 'class.read'),
  ('receptionist', 'booking.write'), ('receptionist', 'attendance.write'), ('receptionist', 'payment.record'),
  ('coach', 'class.read'), ('coach', 'attendance.write'), ('coach', 'training.write'),
  ('member', 'class.read'), ('member', 'booking.write');


-- Migration: 20260913000100_membership_access_rules

-- Business rules confirmed after the initial database foundation.
-- This migration is additive: it must run after 20260913000000_initial_sports_center.

ALTER TYPE membership_status ADD VALUE IF NOT EXISTS 'pending_payment' BEFORE 'active';
ALTER TABLE member_memberships
  ALTER COLUMN status SET DEFAULT 'pending_payment';

CREATE TYPE entitlement_code AS ENUM (
  'gym_access', 'group_class_booking', 'pool_access', 'sauna_access',
  'towel_service', 'premium_locker', 'pt_session'
);
CREATE TYPE entitlement_limit_period AS ENUM ('weekly', 'monthly');

ALTER TABLE membership_packages
  ADD COLUMN tier_rank integer;
UPDATE membership_packages
SET tier_rank = CASE code
  WHEN 'BASIC' THEN 1
  WHEN 'STANDARD' THEN 2
  WHEN 'PREMIUM' THEN 3
  ELSE 100
END
WHERE tier_rank IS NULL;
ALTER TABLE membership_packages
  ALTER COLUMN tier_rank SET NOT NULL,
  ADD CONSTRAINT membership_packages_tier_rank_positive CHECK (tier_rank > 0),
  ADD CONSTRAINT membership_packages_tier_rank_unique UNIQUE (tier_rank);

CREATE TABLE membership_package_entitlements (
  package_id uuid NOT NULL REFERENCES membership_packages(id) ON DELETE CASCADE,
  entitlement entitlement_code NOT NULL,
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  limit_period entitlement_limit_period,
  PRIMARY KEY(package_id, entitlement),
  CHECK ((usage_limit IS NULL) = (limit_period IS NULL))
);

ALTER TABLE member_memberships
  ADD COLUMN contract_expires_at timestamptz,
  ADD COLUMN grace_expires_at timestamptz,
  ADD COLUMN activated_at timestamptz,
  ADD COLUMN activation_payment_id uuid UNIQUE REFERENCES payments(id) ON DELETE RESTRICT;
CREATE INDEX member_memberships_access_window_idx
  ON member_memberships(member_id, status, grace_expires_at DESC);

-- Existing rows retain their original contractual date. New memberships must
-- set timestamps explicitly in the center timezone; this backfill is only a
-- safe fallback for pre-rule records that stored a date without a time.
UPDATE member_memberships
SET contract_expires_at = ((expires_on + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    grace_expires_at = ((expires_on + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '72 hours'
WHERE contract_expires_at IS NULL OR grace_expires_at IS NULL;

CREATE TABLE member_coach_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  coach_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE UNIQUE INDEX one_active_coach_per_member
  ON member_coach_assignments(member_id) WHERE effective_to IS NULL;
CREATE INDEX coach_active_members_idx
  ON member_coach_assignments(coach_user_id, member_id) WHERE effective_to IS NULL;

CREATE TABLE facility_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  membership_id uuid REFERENCES member_memberships(id) ON DELETE RESTRICT,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  allowed boolean NOT NULL,
  denial_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((allowed AND denial_reason IS NULL) OR (NOT allowed AND length(trim(coalesce(denial_reason, ''))) > 0))
);
CREATE INDEX facility_checkins_member_time_idx ON facility_checkins(member_id, checked_in_at DESC);

CREATE OR REPLACE FUNCTION require_coach_for_assignment()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE assigned_role user_role;
BEGIN
  SELECT role INTO assigned_role FROM users WHERE id = NEW.coach_user_id;
  IF assigned_role IS DISTINCT FROM 'coach' THEN
    RAISE EXCEPTION 'A member can only be assigned to a Coach account';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION activate_membership_after_successful_payment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'paid' AND NEW.membership_id IS NOT NULL THEN
    UPDATE member_memberships
    SET status = 'active',
        activated_at = coalesce(activated_at, NEW.paid_at, now()),
        activation_payment_id = NEW.id
    WHERE id = NEW.membership_id
      AND status = 'pending_payment';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION require_active_membership_for_facility_checkin()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE active_membership member_memberships;
BEGIN
  IF NOT NEW.allowed THEN RETURN NEW; END IF;
  SELECT * INTO active_membership
  FROM member_memberships
  WHERE id = NEW.membership_id
    AND member_id = NEW.member_id
    AND status IN ('active', 'expiring_soon')
    AND (grace_expires_at IS NULL OR NEW.checked_in_at <= grace_expires_at)
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facility check-in requires an active membership inside its access window';
  END IF;
  RETURN NEW;
END $$;

-- Replace the original booking guard so the same 72-hour access window is
-- honored for a future class occurrence. Pending-payment and expired accounts
-- remain blocked.
CREATE OR REPLACE FUNCTION require_active_membership_for_booking()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE session_row class_sessions; live_membership member_memberships;
DECLARE booked_count integer;
BEGIN
  SELECT * INTO session_row FROM class_sessions WHERE id = NEW.class_session_id FOR UPDATE;
  IF NOT FOUND OR session_row.status <> 'published' THEN
    RAISE EXCEPTION 'Class is not available for booking';
  END IF;
  SELECT * INTO live_membership FROM member_memberships
  WHERE member_id = NEW.member_id
    AND status IN ('active', 'expiring_soon')
    AND starts_on <= session_row.starts_at::date
    AND (
      grace_expires_at IS NOT NULL AND session_row.starts_at <= grace_expires_at
      OR grace_expires_at IS NULL AND expires_on >= session_row.starts_at::date
    )
  ORDER BY coalesce(grace_expires_at, expires_on::timestamp) DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member does not have an active membership inside its access window';
  END IF;
  SELECT count(*) INTO booked_count FROM bookings
  WHERE class_session_id = NEW.class_session_id AND status IN ('confirmed', 'attended');
  IF booked_count >= session_row.capacity THEN RAISE EXCEPTION 'Class is at capacity'; END IF;
  RETURN NEW;
END $$;

-- Refunds are retained only as historical data from the initial foundation.
-- The confirmed policy prohibits any new member refund request after use.
DELETE FROM role_permissions WHERE permission_code = 'refund.approve';
CREATE OR REPLACE FUNCTION prevent_new_refund_request()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Refund requests are not available under the current membership policy';
END $$;
CREATE TRIGGER refund_requests_disabled
  BEFORE INSERT ON refund_requests
  FOR EACH ROW EXECUTE FUNCTION prevent_new_refund_request();

CREATE OR REPLACE FUNCTION audit_attendance_correction()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor_role user_role;
BEGIN
  SELECT role INTO actor_role FROM users WHERE id = NEW.requested_by;
  IF actor_role IS DISTINCT FROM 'coach' THEN
    RAISE EXCEPTION 'Only a Coach can correct attendance';
  END IF;
  INSERT INTO audit_logs(actor_user_id, action, entity_type, entity_id, summary, previous_value, new_value, reason)
  VALUES (
    NEW.requested_by,
    'attendance.corrected',
    'attendance_record',
    NEW.attendance_id,
    'Coach corrected attendance with a stated reason',
    jsonb_build_object('status', NEW.previous_status),
    jsonb_build_object('status', NEW.new_status),
    NEW.reason
  );
  RETURN NEW;
END $$;

CREATE TRIGGER member_coach_assignment_requires_coach
  BEFORE INSERT OR UPDATE OF coach_user_id ON member_coach_assignments
  FOR EACH ROW EXECUTE FUNCTION require_coach_for_assignment();
CREATE TRIGGER membership_activation_on_payment_insert
  AFTER INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION activate_membership_after_successful_payment();
CREATE TRIGGER membership_activation_on_payment_update
  AFTER UPDATE OF status ON payments
  FOR EACH ROW EXECUTE FUNCTION activate_membership_after_successful_payment();
CREATE TRIGGER facility_checkin_requires_active_membership
  BEFORE INSERT ON facility_checkins
  FOR EACH ROW EXECUTE FUNCTION require_active_membership_for_facility_checkin();
CREATE TRIGGER attendance_correction_audit
  AFTER INSERT ON attendance_corrections
  FOR EACH ROW EXECUTE FUNCTION audit_attendance_correction();

-- Basic < Standard < Premium. Higher tiers repeat the lower-tier grants so
-- entitlement checks are direct and do not depend on a hidden inheritance rule.
INSERT INTO membership_package_entitlements(package_id, entitlement, usage_limit, limit_period)
SELECT membership_packages.id,
       entitlement_rows.entitlement::entitlement_code,
       entitlement_rows.usage_limit,
       entitlement_rows.limit_period::entitlement_limit_period
FROM membership_packages
CROSS JOIN (VALUES
  ('BASIC', 'gym_access', NULL::integer, NULL::text),
  ('STANDARD', 'gym_access', NULL::integer, NULL::text),
  ('STANDARD', 'group_class_booking', 2, 'weekly'),
  ('STANDARD', 'towel_service', NULL::integer, NULL::text),
  ('PREMIUM', 'gym_access', NULL::integer, NULL::text),
  ('PREMIUM', 'group_class_booking', NULL::integer, NULL::text),
  ('PREMIUM', 'towel_service', NULL::integer, NULL::text),
  ('PREMIUM', 'pool_access', NULL::integer, NULL::text),
  ('PREMIUM', 'sauna_access', NULL::integer, NULL::text),
  ('PREMIUM', 'premium_locker', NULL::integer, NULL::text),
  ('PREMIUM', 'pt_session', 2, 'monthly')
) AS entitlement_rows(package_code, entitlement, usage_limit, limit_period)
WHERE membership_packages.code = entitlement_rows.package_code
ON CONFLICT (package_id, entitlement) DO NOTHING;
