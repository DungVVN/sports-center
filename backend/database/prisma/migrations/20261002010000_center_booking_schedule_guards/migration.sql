-- Preserve historical rows, including legacy overlapping schedules.
-- Enforce existing center rules for new bookings and schedule/capacity changes.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

CREATE FUNCTION guard_center_class_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  room_capacity integer;
  occupied bigint;
BEGIN
  SELECT capacity INTO room_capacity FROM rooms WHERE id = NEW.room_id;
  IF NEW.capacity > room_capacity THEN
    RAISE EXCEPTION 'Class capacity exceeds room capacity'
      USING ERRCODE = '23514', CONSTRAINT = 'class_room_capacity_guard';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.capacity IS DISTINCT FROM OLD.capacity THEN
    SELECT count(*) INTO occupied FROM bookings
      WHERE class_session_id = NEW.id AND status IN ('confirmed', 'attended');
    IF NEW.capacity < occupied THEN
      RAISE EXCEPTION 'Class capacity is below occupied seats'
        USING ERRCODE = '23514', CONSTRAINT = 'class_occupied_capacity_guard';
    END IF;
  END IF;

  IF NEW.status = 'cancelled' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.room_id IS NOT DISTINCT FROM OLD.room_id
      AND NEW.coach_user_id IS NOT DISTINCT FROM OLD.coach_user_id
      AND NEW.starts_at IS NOT DISTINCT FROM OLD.starts_at
      AND NEW.ends_at IS NOT DISTINCT FROM OLD.ends_at
      AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  END IF;

  -- Center schedule writes are low-volume. One transaction lock avoids
  -- crossed coach/room lock ordering and serializes competing schedule writes.
  PERFORM pg_advisory_xact_lock(hashtextextended('sports-center-class-schedule', 0));
  IF EXISTS (SELECT 1 FROM class_sessions c
    WHERE c.id <> NEW.id AND c.status <> 'cancelled'
      AND c.starts_at < NEW.ends_at AND c.ends_at > NEW.starts_at
      AND (c.room_id = NEW.room_id OR c.coach_user_id = NEW.coach_user_id)) THEN
    RAISE EXCEPTION 'Coach or room already has an overlapping class'
      USING ERRCODE = '23P01', CONSTRAINT = 'class_schedule_conflict_guard';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER center_class_schedule_guard
  BEFORE INSERT OR UPDATE OF room_id, coach_user_id, starts_at, ends_at, status, capacity
  ON class_sessions FOR EACH ROW EXECUTE FUNCTION guard_center_class_schedule();

CREATE FUNCTION guard_center_booking_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  seat_capacity integer;
  occupied bigint;
BEGIN
  IF NEW.status NOT IN ('confirmed', 'attended') THEN RETURN NEW; END IF;
  SELECT capacity INTO seat_capacity FROM class_sessions WHERE id = NEW.class_session_id FOR UPDATE;
  SELECT count(*) INTO occupied FROM bookings
    WHERE class_session_id = NEW.class_session_id AND id <> NEW.id
      AND status IN ('confirmed', 'attended');
  IF occupied >= seat_capacity THEN
    RAISE EXCEPTION 'Class has no available confirmed seat'
      USING ERRCODE = '23514', CONSTRAINT = 'booking_class_capacity_guard';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER center_booking_capacity_guard
  BEFORE INSERT OR UPDATE OF class_session_id, status ON bookings
  FOR EACH ROW EXECUTE FUNCTION guard_center_booking_capacity();

COMMIT;
