BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

CREATE FUNCTION guard_pt_session_details() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE purchase pt_purchases;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.pt_purchase_id IS NOT NULL AND NEW.pt_purchase_id IS DISTINCT FROM OLD.pt_purchase_id THEN
    RAISE EXCEPTION 'Cannot detach or retarget a PT session' USING ERRCODE='23514';
  END IF;
  IF NEW.pt_purchase_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO purchase FROM pt_purchases WHERE id = NEW.pt_purchase_id;
  IF NOT FOUND OR NEW.coach_user_id IS DISTINCT FROM purchase.coach_user_id
      OR NEW.capacity <> 1 OR NEW.type <> 'personal'
      OR NEW.ends_at - NEW.starts_at <> make_interval(mins => purchase.session_minutes_snapshot)
      OR purchase.expires_at IS NULL OR NEW.ends_at > purchase.expires_at THEN
    RAISE EXCEPTION 'PT session must match purchased coach, duration and access window' USING ERRCODE='23514', CONSTRAINT='pt_session_details';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER pt_session_details_guard BEFORE INSERT OR UPDATE OF pt_purchase_id,coach_user_id,capacity,type,starts_at,ends_at
ON class_sessions FOR EACH ROW EXECUTE FUNCTION guard_pt_session_details();

CREATE FUNCTION guard_pt_purchase_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.package_id,NEW.member_id,NEW.package_name_snapshot,NEW.price_vnd_snapshot,
      NEW.session_count_snapshot,NEW.duration_days_snapshot,NEW.session_minutes_snapshot,NEW.cancellation_hours_snapshot)
    IS DISTINCT FROM ROW(OLD.package_id,OLD.member_id,OLD.package_name_snapshot,OLD.price_vnd_snapshot,
      OLD.session_count_snapshot,OLD.duration_days_snapshot,OLD.session_minutes_snapshot,OLD.cancellation_hours_snapshot) THEN
    RAISE EXCEPTION 'Purchased PT terms are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER pt_purchase_snapshot_guard BEFORE UPDATE ON pt_purchases FOR EACH ROW EXECUTE FUNCTION guard_pt_purchase_snapshot();
COMMIT;
