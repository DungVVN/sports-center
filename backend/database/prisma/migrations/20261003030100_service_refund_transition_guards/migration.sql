BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE service_refunds ADD CONSTRAINT service_refund_execution_proof CHECK(status <> 'completed' OR (executed_by IS NOT NULL AND transfer_reference IS NOT NULL AND length(trim(transfer_reference)) >= 10));
ALTER TABLE service_refunds ADD CONSTRAINT service_refund_review_proof CHECK(status = 'pending' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_note IS NOT NULL AND length(trim(review_note)) >= 10));
CREATE FUNCTION guard_service_refund_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor_role user_role;
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
   (OLD.status='pending' AND NEW.status IN ('approved','rejected')) OR
   (OLD.status='approved' AND NEW.status='completed')) THEN
   RAISE EXCEPTION 'Invalid refund transition' USING ERRCODE='23514';
 END IF;
 IF NEW.status='completed' AND OLD.status='approved' THEN
   SELECT role INTO actor_role FROM users WHERE id=NEW.executed_by;
   IF actor_role IS NULL OR actor_role NOT IN ('admin','receptionist') THEN
     RAISE EXCEPTION 'Refund execution requires cashier' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER service_refund_transition BEFORE UPDATE ON service_refunds FOR EACH ROW EXECUTE FUNCTION guard_service_refund_transition();
COMMIT;
