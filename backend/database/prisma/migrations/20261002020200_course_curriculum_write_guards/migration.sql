BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
CREATE OR REPLACE FUNCTION guard_course_curriculum() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target courses; attaching boolean;
BEGIN
  attaching := TG_OP = 'INSERT';
  IF TG_OP = 'UPDATE' THEN attaching := NEW.course_id IS DISTINCT FROM OLD.course_id; END IF;
  IF NEW.course_id IS NOT NULL THEN
    SELECT * INTO target FROM courses WHERE id = NEW.course_id FOR UPDATE;
    IF NEW.capacity < target.capacity THEN RAISE EXCEPTION 'Class capacity is below course capacity' USING ERRCODE = '23514'; END IF;
    IF attaching AND target.status <> 'draft' THEN RAISE EXCEPTION 'Only draft courses accept new sessions' USING ERRCODE = '23514'; END IF;
  END IF;
  IF attaching THEN
    IF EXISTS (SELECT 1 FROM course_enrollments WHERE course_id = NEW.course_id AND status <> 'cancelled') THEN
      RAISE EXCEPTION 'Cannot add sessions after enrollment' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF EXISTS (SELECT 1 FROM course_enrollments WHERE course_id = OLD.course_id AND status <> 'cancelled') THEN
        RAISE EXCEPTION 'Cannot change curriculum after enrollment' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION guard_course_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE enrollment course_enrollments;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.course_enrollment_id IS NOT NULL AND (NEW.course_enrollment_id IS DISTINCT FROM OLD.course_enrollment_id OR NEW.member_id <> OLD.member_id OR NEW.amount_vnd <> OLD.amount_vnd) THEN
      RAISE EXCEPTION 'Course payment target and amount are immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.course_enrollment_id IS NOT DISTINCT FROM OLD.course_enrollment_id THEN RETURN NEW; END IF;
    IF NEW.course_enrollment_id IS NOT NULL THEN RAISE EXCEPTION 'Cannot retarget an existing payment to a course' USING ERRCODE = '23514'; END IF;
  END IF;
  IF NEW.course_enrollment_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO enrollment FROM course_enrollments WHERE id = NEW.course_enrollment_id FOR UPDATE;
  IF NOT FOUND OR enrollment.member_id <> NEW.member_id OR enrollment.price_vnd_snapshot <> NEW.amount_vnd OR enrollment.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'Course payment target does not match enrollment' USING ERRCODE = '23514', CONSTRAINT = 'course_payment_target';
  END IF;
  RETURN NEW;
END;
$$;
COMMIT;
