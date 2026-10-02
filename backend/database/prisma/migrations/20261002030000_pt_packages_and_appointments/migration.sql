BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
CREATE TABLE pt_packages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text,
 price_vnd bigint NOT NULL CHECK(price_vnd >= 0), session_count integer NOT NULL CHECK(session_count > 0),
 duration_days integer NOT NULL CHECK(duration_days > 0), session_minutes integer NOT NULL CHECK(session_minutes BETWEEN 15 AND 240),
 cancellation_hours integer NOT NULL DEFAULT 5 CHECK(cancellation_hours BETWEEN 0 AND 168),
 is_active boolean NOT NULL DEFAULT true, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE pt_purchases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), package_id uuid NOT NULL REFERENCES pt_packages(id), member_id uuid NOT NULL REFERENCES members(id),
 package_name_snapshot text NOT NULL, price_vnd_snapshot bigint NOT NULL CHECK(price_vnd_snapshot >= 0),
 session_count_snapshot integer NOT NULL CHECK(session_count_snapshot > 0), duration_days_snapshot integer NOT NULL CHECK(duration_days_snapshot > 0),
 session_minutes_snapshot integer NOT NULL CHECK(session_minutes_snapshot BETWEEN 15 AND 240), cancellation_hours_snapshot integer NOT NULL CHECK(cancellation_hours_snapshot BETWEEN 0 AND 168),
 coach_user_id uuid REFERENCES users(id), status text NOT NULL DEFAULT 'pending_payment' CHECK(status IN ('pending_payment','active','cancelled','completed')),
 purchased_at timestamptz NOT NULL DEFAULT now(), activated_at timestamptz, expires_at timestamptz,
 activation_payment_id uuid REFERENCES payments(id), CHECK(expires_at IS NULL OR expires_at > activated_at)
);
CREATE INDEX pt_purchases_member_idx ON pt_purchases(member_id,purchased_at);
CREATE INDEX pt_purchases_coach_idx ON pt_purchases(coach_user_id);
ALTER TABLE class_sessions ADD COLUMN pt_purchase_id uuid REFERENCES pt_purchases(id);
ALTER TABLE class_sessions ADD CONSTRAINT class_single_service CHECK(num_nonnulls(course_id,pt_purchase_id) <= 1);
CREATE TABLE pt_appointments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purchase_id uuid NOT NULL REFERENCES pt_purchases(id),
 class_session_id uuid NOT NULL UNIQUE REFERENCES class_sessions(id), status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','absent','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, recorded_by uuid REFERENCES users(id), reason text,
 CHECK((status IN ('completed','absent')) = (completed_at IS NOT NULL))
);
CREATE INDEX pt_appointments_purchase_idx ON pt_appointments(purchase_id,status);
ALTER TABLE payments ADD COLUMN pt_purchase_id uuid REFERENCES pt_purchases(id);
ALTER TABLE payments DROP CONSTRAINT payment_course_target_exclusive;
ALTER TABLE payments ADD CONSTRAINT payment_single_service CHECK(num_nonnulls(membership_id,course_enrollment_id,pt_purchase_id) <= 1);
CREATE UNIQUE INDEX pt_open_payment ON payments(pt_purchase_id) WHERE pt_purchase_id IS NOT NULL AND status IN ('pending','paid');

CREATE FUNCTION guard_pt_appointment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE purchase pt_purchases; session class_sessions; reserved bigint;
BEGIN
 SELECT * INTO purchase FROM pt_purchases WHERE id = NEW.purchase_id FOR UPDATE;
 IF TG_OP = 'UPDATE' THEN
   IF NEW.purchase_id <> OLD.purchase_id OR NEW.class_session_id <> OLD.class_session_id THEN RAISE EXCEPTION 'PT appointment target is immutable' USING ERRCODE='23514'; END IF;
   IF OLD.status <> 'scheduled' AND NEW.status <> OLD.status THEN RAISE EXCEPTION 'PT appointment is already final' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.status = 'cancelled' THEN RETURN NEW; END IF;
 SELECT * INTO session FROM class_sessions WHERE id = NEW.class_session_id;
 IF session.pt_purchase_id IS DISTINCT FROM NEW.purchase_id OR session.coach_user_id IS DISTINCT FROM purchase.coach_user_id THEN RAISE EXCEPTION 'PT coach or purchase mismatch' USING ERRCODE='23514'; END IF;
 IF TG_OP = 'INSERT' THEN
   IF purchase.status <> 'active' OR session.starts_at <= now() OR session.ends_at > purchase.expires_at THEN RAISE EXCEPTION 'PT purchase is not eligible for this appointment' USING ERRCODE='23514'; END IF;
 END IF;
 SELECT count(*) INTO reserved FROM pt_appointments WHERE purchase_id = NEW.purchase_id AND id <> NEW.id AND status <> 'cancelled';
 IF reserved >= purchase.session_count_snapshot THEN RAISE EXCEPTION 'PT session balance exhausted' USING ERRCODE='23514',CONSTRAINT='pt_session_balance'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER pt_appointment_guard BEFORE INSERT OR UPDATE ON pt_appointments FOR EACH ROW EXECUTE FUNCTION guard_pt_appointment();

CREATE FUNCTION guard_pt_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE purchase pt_purchases;
BEGIN
 IF TG_OP = 'UPDATE' THEN
   IF OLD.pt_purchase_id IS NOT NULL AND (NEW.pt_purchase_id IS DISTINCT FROM OLD.pt_purchase_id OR NEW.member_id <> OLD.member_id OR NEW.amount_vnd <> OLD.amount_vnd) THEN RAISE EXCEPTION 'PT payment target and amount are immutable' USING ERRCODE='23514'; END IF;
   IF NEW.pt_purchase_id IS NOT DISTINCT FROM OLD.pt_purchase_id THEN RETURN NEW; END IF;
   IF NEW.pt_purchase_id IS NOT NULL THEN RAISE EXCEPTION 'Cannot retarget payment to PT' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.pt_purchase_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO purchase FROM pt_purchases WHERE id = NEW.pt_purchase_id FOR UPDATE;
 IF NOT FOUND OR purchase.status <> 'pending_payment' OR purchase.member_id <> NEW.member_id OR purchase.price_vnd_snapshot <> NEW.amount_vnd THEN RAISE EXCEPTION 'PT payment does not match purchase' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER pt_payment_guard BEFORE INSERT OR UPDATE OF pt_purchase_id,member_id,amount_vnd ON payments FOR EACH ROW EXECUTE FUNCTION guard_pt_payment();

CREATE OR REPLACE FUNCTION require_active_membership_for_booking() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE session_row class_sessions; live_membership member_memberships; booked_count integer;
BEGIN
 SELECT * INTO session_row FROM class_sessions WHERE id = NEW.class_session_id FOR UPDATE;
 IF NOT FOUND OR session_row.status <> 'published' THEN RAISE EXCEPTION 'Class is not available for booking'; END IF;
 IF session_row.pt_purchase_id IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM pt_purchases WHERE id = session_row.pt_purchase_id AND member_id = NEW.member_id AND status = 'active' AND expires_at >= session_row.ends_at) THEN RAISE EXCEPTION 'Active PT purchase required' USING ERRCODE='23514'; END IF;
 ELSIF session_row.course_id IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM course_enrollments WHERE course_id = session_row.course_id AND member_id = NEW.member_id AND status = 'active') THEN RAISE EXCEPTION 'Active course enrollment is required' USING ERRCODE='23514',CONSTRAINT='course_booking_access'; END IF;
 ELSE
   SELECT * INTO live_membership FROM member_memberships WHERE member_id = NEW.member_id AND status IN ('active','expiring_soon') AND starts_on <= session_row.starts_at::date
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
INSERT INTO permissions(code,description) VALUES ('pt.read','Xem gói PT và lịch trong phạm vi'),('pt.manage','Quản lý gói PT và phân công coach'),('pt.purchase','Mua và đặt lịch PT của chính mình'),('pt.complete','Ghi nhận buổi PT của coach được phân công') ON CONFLICT DO NOTHING;
INSERT INTO role_permissions(role_code,permission_code) VALUES ('member','pt.read'),('member','pt.purchase'),('coach','pt.read'),('coach','pt.complete'),('receptionist','pt.read'),('receptionist','pt.manage'),('manager','pt.read'),('admin','pt.read'),('admin','pt.manage'),('admin','pt.complete') ON CONFLICT DO NOTHING;
UPDATE roles SET permission_version = permission_version + 1;
COMMIT;
