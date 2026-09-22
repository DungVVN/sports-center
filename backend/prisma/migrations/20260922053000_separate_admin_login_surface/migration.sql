-- Admin MFA challenges are bound to the portal where they were created.
ALTER TABLE "auth_mfa_login_challenges"
  ADD COLUMN IF NOT EXISTS "login_surface" VARCHAR(16) NOT NULL DEFAULT 'main';
