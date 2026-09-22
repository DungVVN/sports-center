CREATE TABLE "auth_totp_factors" (
  "user_id" UUID NOT NULL,
  "secret_ciphertext" TEXT NOT NULL,
  "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "auth_totp_factors_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "auth_mfa_enrollments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "secret_ciphertext" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "consumed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_mfa_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_mfa_enrollments_user_id_expires_at_idx" ON "auth_mfa_enrollments"("user_id", "expires_at");

CREATE TABLE "auth_mfa_login_challenges" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_mfa_login_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_mfa_login_challenges_user_id_expires_at_idx" ON "auth_mfa_login_challenges"("user_id", "expires_at");
