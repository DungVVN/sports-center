-- Public Member registration requires both contact channels to be verified
-- before a Receptionist can approve the account. This migration is additive.

ALTER TYPE account_status ADD VALUE IF NOT EXISTS 'pending_verification' BEFORE 'active';
ALTER TYPE account_status ADD VALUE IF NOT EXISTS 'pending_approval' BEFORE 'active';

CREATE TYPE verification_channel AS ENUM ('email', 'phone');
CREATE TYPE verification_purpose AS ENUM ('registration');

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user_expiry_idx ON auth_sessions(user_id, expires_at);

CREATE TABLE account_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel verification_channel NOT NULL,
  purpose verification_purpose NOT NULL DEFAULT 'registration',
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_verifications_lookup_idx
  ON account_verifications(user_id, channel, purpose, created_at DESC);

ALTER TABLE members
  ADD COLUMN approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN approved_at timestamptz;

INSERT INTO permissions(code, description) VALUES
  ('registration.approve', 'Duyệt tài khoản hội viên đăng ký công khai')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions(role_code, permission_code) VALUES
  ('manager', 'registration.approve'),
  ('receptionist', 'registration.approve')
ON CONFLICT DO NOTHING;
