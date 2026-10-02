BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE facilities ADD COLUMN hourly_rate_vnd bigint CHECK(hourly_rate_vnd >= 0);
ALTER TABLE facilities ADD COLUMN room_id uuid UNIQUE REFERENCES rooms(id);
ALTER TABLE facility_reservations ADD COLUMN hourly_rate_vnd_snapshot bigint CHECK(hourly_rate_vnd_snapshot >= 0);
ALTER TABLE facility_reservations ADD COLUMN total_vnd_snapshot bigint CHECK(total_vnd_snapshot >= 0);
ALTER TABLE facility_reservations ADD COLUMN payment_state text NOT NULL DEFAULT 'legacy' CHECK(payment_state IN ('legacy','unpaid','paid','free'));
ALTER TABLE facility_reservations ADD COLUMN activation_payment_id uuid REFERENCES payments(id);
ALTER TABLE facility_reservations ADD COLUMN completed_at timestamptz;
ALTER TABLE facility_reservations ADD COLUMN completed_by uuid REFERENCES users(id);
ALTER TABLE facility_reservations ADD COLUMN completion_note text;
ALTER TABLE payments ADD COLUMN facility_reservation_id uuid REFERENCES facility_reservations(id);
ALTER TABLE payments DROP CONSTRAINT payment_single_service;
ALTER TABLE payments ADD CONSTRAINT payment_single_service CHECK(num_nonnulls(membership_id,course_enrollment_id,pt_purchase_id,facility_reservation_id) <= 1);
CREATE UNIQUE INDEX facility_open_payment ON payments(facility_reservation_id) WHERE facility_reservation_id IS NOT NULL AND status IN ('pending','paid');

CREATE FUNCTION facility_instant(day date, minute integer) RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$
 SELECT (day::timestamp + make_interval(mins => minute)) AT TIME ZONE 'Asia/Ho_Chi_Minh';
$$;

CREATE FUNCTION guard_facility_service_reservation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE day facility_days; facility facilities;
BEGIN
 IF TG_OP = 'UPDATE' AND OLD.status = 'approved' AND
   ROW(NEW.day_id,NEW.requester_user_id,NEW.assigned_start_minute,NEW.assigned_end_minute,NEW.hourly_rate_vnd_snapshot,NEW.total_vnd_snapshot)
   IS DISTINCT FROM ROW(OLD.day_id,OLD.requester_user_id,OLD.assigned_start_minute,OLD.assigned_end_minute,OLD.hourly_rate_vnd_snapshot,OLD.total_vnd_snapshot) THEN
   RAISE EXCEPTION 'Approved rental terms are immutable' USING ERRCODE='23514';
 END IF;
 IF NEW.status <> 'approved' THEN RETURN NEW; END IF;
 IF TG_OP = 'UPDATE' AND NEW.status = OLD.status AND NEW.day_id = OLD.day_id
   AND NEW.assigned_start_minute IS NOT DISTINCT FROM OLD.assigned_start_minute
   AND NEW.assigned_end_minute IS NOT DISTINCT FROM OLD.assigned_end_minute THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sports-center-class-schedule',0));
 SELECT * INTO day FROM facility_days WHERE id=NEW.day_id;
 SELECT * INTO facility FROM facilities WHERE id=day.facility_id;
 IF NOT facility.is_active OR NOT EXISTS(SELECT 1 FROM facility_types WHERE id=facility.type_id AND is_active)
   OR NEW.assigned_start_minute < facility.open_minute OR NEW.assigned_end_minute > facility.close_minute
   OR NEW.assigned_end_minute <= NEW.assigned_start_minute
   OR facility_instant(day.open_on,NEW.assigned_start_minute) <= now() THEN
   RAISE EXCEPTION 'Rental day, facility or assigned time unavailable' USING ERRCODE='23514', CONSTRAINT='facility_access_guard';
 END IF;
 IF NEW.hourly_rate_vnd_snapshot IS NULL OR NEW.total_vnd_snapshot IS NULL
   OR NEW.total_vnd_snapshot <> ceil(NEW.hourly_rate_vnd_snapshot::numeric * (NEW.assigned_end_minute-NEW.assigned_start_minute)/60)
   OR NEW.payment_state <> (CASE WHEN NEW.total_vnd_snapshot=0 THEN 'free' ELSE 'unpaid' END) THEN
   RAISE EXCEPTION 'Rental quote must match its hourly rate and duration' USING ERRCODE='23514';
 END IF;
 IF facility.room_id IS NOT NULL AND EXISTS(SELECT 1 FROM class_sessions c WHERE c.room_id=facility.room_id AND c.status <> 'cancelled'
   AND c.starts_at < facility_instant(day.open_on,NEW.assigned_end_minute) AND c.ends_at > facility_instant(day.open_on,NEW.assigned_start_minute)) THEN
   RAISE EXCEPTION 'Physical room is already occupied by a class or PT' USING ERRCODE='23P01',CONSTRAINT='center_resource_schedule_conflict';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER facility_service_reservation_guard BEFORE INSERT OR UPDATE ON facility_reservations FOR EACH ROW EXECUTE FUNCTION guard_facility_service_reservation();

CREATE FUNCTION guard_class_against_rentals() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='cancelled' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.room_id=OLD.room_id AND NEW.starts_at=OLD.starts_at AND NEW.ends_at=OLD.ends_at AND NEW.status=OLD.status THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sports-center-class-schedule',0));
 IF EXISTS(SELECT 1 FROM facility_reservations r JOIN facility_days d ON d.id=r.day_id JOIN facilities f ON f.id=d.facility_id
   WHERE f.room_id=NEW.room_id AND r.status='approved'
   AND facility_instant(d.open_on,r.assigned_start_minute)<NEW.ends_at AND facility_instant(d.open_on,r.assigned_end_minute)>NEW.starts_at) THEN
   RAISE EXCEPTION 'Physical room is already occupied by a rental' USING ERRCODE='23P01',CONSTRAINT='center_resource_schedule_conflict';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER class_rental_schedule_guard BEFORE INSERT OR UPDATE OF room_id,starts_at,ends_at,status ON class_sessions FOR EACH ROW EXECUTE FUNCTION guard_class_against_rentals();

CREATE FUNCTION guard_facility_room_mapping() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.room_id IS NULL THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sports-center-class-schedule',0));
 IF NOT EXISTS(SELECT 1 FROM rooms WHERE id=NEW.room_id AND is_active) THEN RAISE EXCEPTION 'Mapped room must be active' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM facility_reservations r JOIN facility_days d ON d.id=r.day_id JOIN class_sessions c ON c.room_id=NEW.room_id
   WHERE d.facility_id=NEW.id AND r.status='approved' AND c.status <> 'cancelled'
   AND facility_instant(d.open_on,r.assigned_start_minute)<c.ends_at AND facility_instant(d.open_on,r.assigned_end_minute)>c.starts_at) THEN
   RAISE EXCEPTION 'Room mapping creates overlapping center schedules' USING ERRCODE='23P01',CONSTRAINT='center_resource_schedule_conflict';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER facility_room_mapping_guard BEFORE INSERT OR UPDATE OF room_id ON facilities FOR EACH ROW EXECUTE FUNCTION guard_facility_room_mapping();

CREATE FUNCTION guard_facility_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reservation facility_reservations;
BEGIN
 IF TG_OP='UPDATE' THEN
   IF OLD.facility_reservation_id IS NOT NULL AND (NEW.facility_reservation_id IS DISTINCT FROM OLD.facility_reservation_id OR NEW.member_id <> OLD.member_id OR NEW.amount_vnd <> OLD.amount_vnd) THEN RAISE EXCEPTION 'Rental payment target and amount immutable' USING ERRCODE='23514'; END IF;
   IF NEW.facility_reservation_id IS NOT DISTINCT FROM OLD.facility_reservation_id THEN RETURN NEW; END IF;
   IF NEW.facility_reservation_id IS NOT NULL THEN RAISE EXCEPTION 'Cannot retarget payment to rental' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.facility_reservation_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO reservation FROM facility_reservations WHERE id=NEW.facility_reservation_id FOR UPDATE;
 IF NOT FOUND OR reservation.status <> 'approved' OR reservation.payment_state <> 'unpaid'
   OR reservation.total_vnd_snapshot <> NEW.amount_vnd
   OR NOT EXISTS(SELECT 1 FROM members WHERE id=NEW.member_id AND user_id=reservation.requester_user_id) THEN
   RAISE EXCEPTION 'Rental payment does not match approved quote and requester' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER facility_payment_guard BEFORE INSERT OR UPDATE OF facility_reservation_id,member_id,amount_vnd ON payments FOR EACH ROW EXECUTE FUNCTION guard_facility_payment();
COMMIT;
