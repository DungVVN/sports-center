BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_vnd bigint NOT NULL CHECK (price_vnd >= 0),
  capacity integer NOT NULL CHECK (capacity > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','cancelled','completed')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER courses_updated_at BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE class_sessions ADD COLUMN course_id uuid REFERENCES courses(id);
CREATE INDEX class_sessions_course_idx ON class_sessions(course_id);

CREATE TABLE course_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id),
  member_id uuid NOT NULL REFERENCES members(id),
  price_vnd_snapshot bigint NOT NULL CHECK (price_vnd_snapshot >= 0),
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment','active','cancelled','completed')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  activation_payment_id uuid REFERENCES payments(id),
  cancelled_at timestamptz,
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
);
CREATE UNIQUE INDEX course_live_enrollment ON course_enrollments(course_id,member_id) WHERE status <> 'cancelled';
CREATE INDEX course_enrollments_member_idx ON course_enrollments(member_id,enrolled_at);
ALTER TABLE payments ADD COLUMN course_enrollment_id uuid REFERENCES course_enrollments(id);
ALTER TABLE payments ADD CONSTRAINT payment_course_target_exclusive CHECK (num_nonnulls(membership_id,course_enrollment_id) <= 1);
CREATE UNIQUE INDEX course_open_payment ON payments(course_enrollment_id) WHERE course_enrollment_id IS NOT NULL AND status IN ('pending','paid');

CREATE FUNCTION guard_course_enrollment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target courses; occupied bigint;
BEGIN
  SELECT * INTO target FROM courses WHERE id = NEW.course_id FOR UPDATE;
  IF TG_OP = 'UPDATE' AND (NEW.course_id <> OLD.course_id OR NEW.member_id <> OLD.member_id OR NEW.price_vnd_snapshot <> OLD.price_vnd_snapshot) THEN
    RAISE EXCEPTION 'Enrollment owner, course and price snapshot are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'cancelled' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF target.status <> 'published' OR NOT EXISTS (SELECT 1 FROM class_sessions WHERE course_id = target.id AND status = 'published')
      OR EXISTS (SELECT 1 FROM class_sessions WHERE course_id = target.id AND (status <> 'published' OR starts_at <= now())) THEN
      RAISE EXCEPTION 'Course is not open for enrollment' USING ERRCODE = '23514', CONSTRAINT = 'course_enrollment_availability';
    END IF;
    IF NEW.price_vnd_snapshot <> target.price_vnd THEN RAISE EXCEPTION 'Course enrollment price mismatch' USING ERRCODE = '23514'; END IF;
  END IF;
  SELECT count(*) INTO occupied FROM course_enrollments WHERE course_id = NEW.course_id AND id <> NEW.id AND status <> 'cancelled';
  IF occupied >= target.capacity THEN RAISE EXCEPTION 'Course enrollment capacity reached' USING ERRCODE = '23514', CONSTRAINT = 'course_enrollment_capacity'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER course_enrollment_guard BEFORE INSERT OR UPDATE ON course_enrollments FOR EACH ROW EXECUTE FUNCTION guard_course_enrollment();

CREATE FUNCTION guard_course_curriculum() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_capacity integer;
BEGIN
  IF NEW.course_id IS NOT NULL THEN
    SELECT capacity INTO target_capacity FROM courses WHERE id = NEW.course_id FOR UPDATE;
    IF NEW.capacity < target_capacity THEN RAISE EXCEPTION 'Class capacity is below course capacity' USING ERRCODE = '23514'; END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM course_enrollments WHERE course_id = NEW.course_id AND status <> 'cancelled') THEN
      RAISE EXCEPTION 'Cannot add sessions after enrollment' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.course_id IS DISTINCT FROM OLD.course_id AND EXISTS (
      SELECT 1 FROM course_enrollments WHERE course_id IN (NEW.course_id,OLD.course_id) AND status <> 'cancelled') THEN
      RAISE EXCEPTION 'Cannot change curriculum after enrollment' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER course_curriculum_guard BEFORE INSERT OR UPDATE OF course_id,capacity ON class_sessions FOR EACH ROW EXECUTE FUNCTION guard_course_curriculum();

CREATE OR REPLACE FUNCTION require_active_membership_for_booking() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE session_row class_sessions; live_membership member_memberships; booked_count integer;
BEGIN
  SELECT * INTO session_row FROM class_sessions WHERE id = NEW.class_session_id FOR UPDATE;
  IF NOT FOUND OR session_row.status <> 'published' THEN RAISE EXCEPTION 'Class is not available for booking'; END IF;
  IF session_row.course_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM course_enrollments WHERE course_id = session_row.course_id AND member_id = NEW.member_id AND status = 'active') THEN
      RAISE EXCEPTION 'Active course enrollment is required' USING ERRCODE = '23514', CONSTRAINT = 'course_booking_access';
    END IF;
  ELSE
    SELECT * INTO live_membership FROM member_memberships
    WHERE member_id = NEW.member_id AND status IN ('active','expiring_soon') AND starts_on <= session_row.starts_at::date
      AND (grace_expires_at IS NOT NULL AND session_row.starts_at <= grace_expires_at OR grace_expires_at IS NULL AND expires_on >= session_row.starts_at::date)
    ORDER BY coalesce(grace_expires_at,expires_on::timestamp) DESC LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Member does not have an active membership inside its access window'; END IF;
  END IF;
  IF NEW.status = 'confirmed' THEN
    SELECT count(*) INTO booked_count FROM bookings WHERE class_session_id = NEW.class_session_id AND status IN ('confirmed','attended');
    IF booked_count >= session_row.capacity THEN RAISE EXCEPTION 'Class is at capacity'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

INSERT INTO permissions(code,description) VALUES
 ('course.read','Xem danh mục khóa học'), ('course.manage','Quản lý khóa học và lịch nhiều buổi'),
 ('course.enroll','Đăng ký khóa học của chính mình'), ('course.enrollment.read','Xem đăng ký khóa học để vận hành') ON CONFLICT DO NOTHING;
INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('member','course.read'),('member','course.enroll'),('coach','course.read'),
 ('manager','course.read'),('manager','course.enrollment.read'),
 ('receptionist','course.read'),('receptionist','course.manage'),('receptionist','course.enrollment.read'),
 ('admin','course.read'),('admin','course.manage'),('admin','course.enrollment.read') ON CONFLICT DO NOTHING;
UPDATE roles SET permission_version = permission_version + 1;
COMMIT;
