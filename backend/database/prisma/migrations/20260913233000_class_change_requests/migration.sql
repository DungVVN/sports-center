CREATE TYPE class_change_type AS ENUM ('cancel', 'reschedule');
CREATE TYPE class_change_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE class_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_session_id uuid NOT NULL REFERENCES class_sessions(id),
  type class_change_type NOT NULL,
  proposed_starts_at timestamptz,
  proposed_ends_at timestamptz,
  reason text NOT NULL,
  status class_change_status NOT NULL DEFAULT 'pending',
  requested_by uuid NOT NULL REFERENCES users(id),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((type = 'cancel' AND proposed_starts_at IS NULL AND proposed_ends_at IS NULL) OR (type = 'reschedule' AND proposed_starts_at IS NOT NULL AND proposed_ends_at IS NOT NULL AND proposed_ends_at > proposed_starts_at))
);
CREATE INDEX class_change_requests_session_status_idx ON class_change_requests(class_session_id, status);

INSERT INTO permissions(code, description) VALUES ('class.change.review', 'Duyệt yêu cầu hủy hoặc đổi lịch lớp') ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_code, permission_code) VALUES ('manager', 'class.change.review'), ('receptionist', 'class.change.review') ON CONFLICT DO NOTHING;
