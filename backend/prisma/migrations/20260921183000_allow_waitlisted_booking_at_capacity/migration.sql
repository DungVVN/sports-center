-- A full class must still accept an eligible member into the waitlist.
-- Capacity is enforced only for a booking that is being confirmed.
CREATE OR REPLACE FUNCTION require_active_membership_for_booking()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE session_row class_sessions; live_membership member_memberships;
DECLARE booked_count integer;
BEGIN
  SELECT * INTO session_row FROM class_sessions WHERE id = NEW.class_session_id FOR UPDATE;
  IF NOT FOUND OR session_row.status <> 'published' THEN
    RAISE EXCEPTION 'Class is not available for booking';
  END IF;

  SELECT * INTO live_membership FROM member_memberships
  WHERE member_id = NEW.member_id
    AND status IN ('active', 'expiring_soon')
    AND starts_on <= session_row.starts_at::date
    AND (
      grace_expires_at IS NOT NULL AND session_row.starts_at <= grace_expires_at
      OR grace_expires_at IS NULL AND expires_on >= session_row.starts_at::date
    )
  ORDER BY coalesce(grace_expires_at, expires_on::timestamp) DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member does not have an active membership inside its access window';
  END IF;

  IF NEW.status = 'confirmed' THEN
    SELECT count(*) INTO booked_count FROM bookings
    WHERE class_session_id = NEW.class_session_id AND status IN ('confirmed', 'attended');
    IF booked_count >= session_row.capacity THEN
      RAISE EXCEPTION 'Class is at capacity';
    END IF;
  END IF;
  RETURN NEW;
END $$;
