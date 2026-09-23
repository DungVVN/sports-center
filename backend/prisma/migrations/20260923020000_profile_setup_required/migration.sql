ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "profile_setup_required" BOOLEAN NOT NULL DEFAULT false;

-- Staff accounts created before this migration may still be waiting to change
-- their temporary password. Keep their profile step in the first-login flow.
UPDATE "users"
SET "profile_setup_required" = true
WHERE "must_change_password" = true;
