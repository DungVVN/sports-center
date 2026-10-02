BEGIN;
SET LOCAL lock_timeout = '10s';
CREATE OR REPLACE FUNCTION guard_facility_service_reservation() RETURNS trigger LANGUAGE plpgsql AS $$
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
 -- Old deployed BE has no quote fields. Preserve its historical workflow until
 -- a rate is configured; once configured, quote terms are derived by the DB.
 IF NEW.hourly_rate_vnd_snapshot IS NULL AND NEW.total_vnd_snapshot IS NULL THEN
   IF facility.hourly_rate_vnd IS NULL THEN
     NEW.payment_state := 'legacy';
   ELSE
     NEW.hourly_rate_vnd_snapshot := facility.hourly_rate_vnd;
     NEW.total_vnd_snapshot := ceil(facility.hourly_rate_vnd::numeric * (NEW.assigned_end_minute-NEW.assigned_start_minute)/60);
     NEW.payment_state := CASE WHEN NEW.total_vnd_snapshot=0 THEN 'free' ELSE 'unpaid' END;
   END IF;
 END IF;
 IF NEW.payment_state <> 'legacy' AND (NEW.hourly_rate_vnd_snapshot IS NULL OR NEW.total_vnd_snapshot IS NULL
   OR NEW.total_vnd_snapshot <> ceil(NEW.hourly_rate_vnd_snapshot::numeric * (NEW.assigned_end_minute-NEW.assigned_start_minute)/60)
   OR NEW.payment_state <> (CASE WHEN NEW.total_vnd_snapshot=0 THEN 'free' ELSE 'unpaid' END)) THEN
   RAISE EXCEPTION 'Rental quote must match its hourly rate and duration' USING ERRCODE='23514';
 END IF;
 IF facility.room_id IS NOT NULL AND EXISTS(SELECT 1 FROM class_sessions c WHERE c.room_id=facility.room_id AND c.status <> 'cancelled'
   AND c.starts_at < facility_instant(day.open_on,NEW.assigned_end_minute) AND c.ends_at > facility_instant(day.open_on,NEW.assigned_start_minute)) THEN
   RAISE EXCEPTION 'Physical room is already occupied by a class or PT' USING ERRCODE='23P01',CONSTRAINT='center_resource_schedule_conflict';
 END IF;
 RETURN NEW;
END;
$$;

COMMIT;