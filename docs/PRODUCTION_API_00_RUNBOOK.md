# API-00 Production runbook: Platform and authentication

## Scope of this slice

- Admin is the highest authority and is provisioned only through the restricted bootstrap/recovery procedure; it is never created through the normal staff API.
- Every role may choose to enroll TOTP from its security profile; once enrolled, TOTP is required for that user's later login sessions.
- CAPTCHA must be verified server-side for registration/login and risk-triggered recovery; no role has forced email OTP under this policy.
- This covers authentication email only. Business notification emails are API-03 work and are not implied by this runbook.

## Required production configuration

Set these values in the backend host only. Do not commit them or expose them to the frontend:

- `AUTH_JWT_SECRET`: unique random value, at least 32 characters.
- `VERIFICATION_CODE_SECRET`: unique random value, separate from the JWT secret.
- `AUTH_MFA_ENCRYPTION_KEY`: unique random value, separate from the other secrets. Changing it makes existing enrolled TOTP factors unreadable, so rotate it only with a planned re-enrollment window.
- `VERIFICATION_DELIVERY_MODE=provider`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`: verified Resend sender values.
- `CORS_ORIGIN`: exact HTTPS frontend origin; `PUBLIC_API_ORIGIN` or `RENDER_EXTERNAL_URL`: exact HTTPS backend origin.

## Rollout order

1. Back up the production database and record the backup location/time.
2. Compare the hosts/database/schema in `MIGRATE_DATABASE_URL` and `DATABASE_URL`. They must target the approved production database before migration.
3. Deploy the application and apply `20260922010000_auth_totp_mfa` then `20260922011000_staff_email_login_otp` with `prisma migrate deploy`. Never use `migrate dev` or reset in production.
4. Configure the production secrets and verified Resend sender, then restart the backend.
5. Verify server-side CAPTCHA on registration/login. Confirm that missing, invalid and expired CAPTCHA tokens do not issue a session.
6. Have one volunteer from each role open **Hồ sơ**, choose **Thiết lập Authenticator**, register the shown manual key in an Authenticator application, and confirm a six-digit code. Confirmation revokes that user's sessions and returns the browser to login.
7. Confirm that password plus valid CAPTCHA alone is sufficient for a user without TOTP; for an enrolled user, confirm that password plus valid CAPTCHA returns a TOTP challenge without a session cookie and only the correct TOTP creates a session.
8. Record browser/API evidence, timestamp, test account IDs and result in the release record. Do not record OTPs, keys, cookies or provider secrets.

## Manager recovery

There is intentionally no unauthenticated “lost Authenticator” endpoint. During the pilot, recovery is a controlled operational action:

1. Confirm the requester identity through the organization’s approved out-of-band process.
2. Obtain approval from the designated business owner and one technical owner.
3. Revoke the affected user’s active sessions and remove only that user’s TOTP factor using the approved restricted database procedure.
4. Record the actor, approvers, reason, affected account and time in the audit/release record; never store the MFA secret or OTP.
5. Require the Manager to re-enroll at the next login and verify the new factor.

## Pilot acceptance criteria

- Missing/invalid CAPTCHA never creates a session.
- An enrolled user cannot get a session after password and CAPTCHA alone; a user who has not enrolled can.
- Manager cannot create, modify, suspend, reactivate or promote Admin/Manager accounts through UI or direct API requests.
- OTP/TOTP invalid, expired, reused and sixth-attempt cases are rejected without a session.
- Authentication email failures do not create a session and are visible to the operator through the API error/audit trail.
- CORS, Secure/HttpOnly/SameSite session cookies, logout and password-change session revocation are verified in the deployed browser.
- The release record distinguishes local tests from deployed UAT. Passing automated checks alone is not Production acceptance.

## Recovery and rollback boundary

The migrations are additive; do not edit or roll them back in production. If authentication email delivery is unavailable, pause the pilot rollout and remediate the verified sender/provider configuration rather than bypassing staff OTP. Database restoration follows the pilot RPO of one hour and RTO of four hours.
