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
