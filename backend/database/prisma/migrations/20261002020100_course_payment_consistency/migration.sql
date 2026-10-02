BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
CREATE FUNCTION guard_course_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE enrollment course_enrollments;
BEGIN
  IF NEW.course_enrollment_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.course_enrollment_id IS DISTINCT FROM OLD.course_enrollment_id OR NEW.member_id <> OLD.member_id OR NEW.amount_vnd <> OLD.amount_vnd THEN
      RAISE EXCEPTION 'Course payment target and amount are immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO enrollment FROM course_enrollments WHERE id = NEW.course_enrollment_id FOR UPDATE;
  IF enrollment.member_id <> NEW.member_id OR enrollment.price_vnd_snapshot <> NEW.amount_vnd OR enrollment.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'Course payment target does not match enrollment' USING ERRCODE = '23514', CONSTRAINT = 'course_payment_target';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER course_payment_guard BEFORE INSERT OR UPDATE OF course_enrollment_id,member_id,amount_vnd ON payments FOR EACH ROW EXECUTE FUNCTION guard_course_payment();
COMMIT;
