BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE courses ADD COLUMN payment_hold_minutes integer NOT NULL DEFAULT 60 CHECK(payment_hold_minutes BETWEEN 5 AND 1440);
ALTER TABLE course_enrollments ADD COLUMN payment_expires_at timestamptz;
ALTER TABLE course_enrollments ADD COLUMN cancellation_reason text;
UPDATE course_enrollments e SET payment_expires_at=now()+make_interval(mins=>c.payment_hold_minutes) FROM courses c WHERE e.course_id=c.id AND e.status='pending_payment';
CREATE INDEX course_payment_expiry_idx ON course_enrollments(payment_expires_at) WHERE status='pending_payment';
ALTER TABLE facility_reservations DROP CONSTRAINT facility_reservations_payment_state_check;
ALTER TABLE facility_reservations ADD CONSTRAINT facility_reservations_payment_state_check CHECK(payment_state IN ('legacy','unpaid','paid','free','refunded'));
CREATE FUNCTION set_course_payment_deadline() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='pending_payment' THEN
   SELECT now()+make_interval(mins=>payment_hold_minutes) INTO NEW.payment_expires_at FROM courses WHERE id=NEW.course_id;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER course_payment_deadline BEFORE INSERT ON course_enrollments FOR EACH ROW EXECUTE FUNCTION set_course_payment_deadline();

CREATE TABLE service_refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid NOT NULL REFERENCES payments(id), member_id uuid NOT NULL REFERENCES members(id),
 amount_vnd bigint NOT NULL CHECK(amount_vnd>0), reason text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','completed')),
 requested_by uuid NOT NULL REFERENCES users(id), requested_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by uuid REFERENCES users(id), reviewed_at timestamptz, review_note text,
 executed_by uuid REFERENCES users(id), executed_at timestamptz, transfer_reference text,
 CHECK((status='completed')=(executed_at IS NOT NULL)),
 CHECK(status <> 'completed' OR length(trim(transfer_reference))>=10)
);
CREATE UNIQUE INDEX service_refund_open_payment ON service_refunds(payment_id) WHERE status IN ('pending','approved');
CREATE UNIQUE INDEX service_refund_completed_payment ON service_refunds(payment_id) WHERE status='completed';
CREATE INDEX service_refunds_member_idx ON service_refunds(member_id,requested_at);
CREATE FUNCTION guard_service_refund() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE payment payments; actor_role user_role;
BEGIN
 IF TG_OP='INSERT' THEN
   SELECT * INTO payment FROM payments WHERE id=NEW.payment_id FOR UPDATE;
   IF NOT FOUND OR payment.status <> 'paid' OR payment.membership_id IS NOT NULL
     OR num_nonnulls(payment.course_enrollment_id,payment.pt_purchase_id,payment.facility_reservation_id) <> 1
     OR NEW.member_id <> payment.member_id OR NEW.amount_vnd <> payment.amount_vnd OR NEW.status <> 'pending' THEN
     RAISE EXCEPTION 'Only a paid non-membership service can request a full refund' USING ERRCODE='23514';
   END IF;
 ELSE
   IF ROW(NEW.payment_id,NEW.member_id,NEW.amount_vnd,NEW.requested_by) IS DISTINCT FROM ROW(OLD.payment_id,OLD.member_id,OLD.amount_vnd,OLD.requested_by) THEN RAISE EXCEPTION 'Refund target is immutable' USING ERRCODE='23514'; END IF;
   IF OLD.status IN ('completed','rejected') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Final refund is immutable' USING ERRCODE='23514'; END IF;
   IF NEW.status IN ('approved','rejected') AND NEW.status <> OLD.status THEN
     SELECT role INTO actor_role FROM users WHERE id=NEW.reviewed_by;
     IF actor_role IS NULL OR actor_role NOT IN ('manager','admin') OR OLD.status <> 'pending' THEN RAISE EXCEPTION 'Refund review requires manager' USING ERRCODE='23514'; END IF;
   END IF;
   IF NEW.status='completed' AND OLD.status <> 'approved' THEN RAISE EXCEPTION 'Refund must be approved before execution' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER service_refund_guard BEFORE INSERT OR UPDATE ON service_refunds FOR EACH ROW EXECUTE FUNCTION guard_service_refund();
INSERT INTO permissions(code,description) VALUES
 ('payment.refund.read','Xem hoàn tiền dịch vụ theo phạm vi'),('payment.refund.request','Yêu cầu hoàn dịch vụ chưa sử dụng'),
 ('payment.refund.review','Quản lý duyệt hoàn tiền dịch vụ'),('payment.refund.execute','Đối soát đã trả tiền dịch vụ'),('payment.reconcile','Đối soát và thử cấp lại dịch vụ đã thu tiền') ON CONFLICT DO NOTHING;
INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('member','payment.refund.read'),('member','payment.refund.request'),
 ('receptionist','payment.refund.read'),('receptionist','payment.refund.execute'),
 ('manager','payment.refund.read'),('manager','payment.refund.review'),('manager','payment.reconcile'),
 ('admin','payment.refund.read'),('admin','payment.refund.request'),('admin','payment.refund.review'),('admin','payment.refund.execute'),('admin','payment.reconcile') ON CONFLICT DO NOTHING;
UPDATE roles SET permission_version=permission_version+1;
COMMIT;
