ALTER TABLE member_memberships ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS membership_freeze_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES member_memberships(id),
  requested_by uuid NOT NULL REFERENCES users(id),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on > starts_on),
  CHECK (ends_on <= starts_on + INTERVAL '3 months')
);
CREATE INDEX IF NOT EXISTS membership_freeze_requests_membership_idx ON membership_freeze_requests(membership_id, created_at DESC);
