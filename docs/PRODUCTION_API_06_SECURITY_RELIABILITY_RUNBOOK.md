# API-06 — Security and Reliability Release Gate

## Implemented controls

- Helmet, 1 MB JSON limit, request ID and trusted-origin enforcement protect the HTTP surface.
- CORS only accepts configured origins with credentials; mutating browser requests from an untrusted Origin are rejected.
- Login limiter, signed session, password hashing, Manager TOTP, staff email OTP and encrypted TOTP secrets are active.
- Production refuses startup with development auth secrets. It also refuses provider email mode when Resend credentials are absent.
- PayOS uses verified callback data; online payment status cannot be manually confirmed. Bank-transfer confirmation requires an explicit reconciliation note and immutable event.
- Backup/restore verification refuses a target database equal to the source and requires explicit acknowledgement before the disposable restore target is overwritten.

## Release sequence

1. Record a production backup and validate `MIGRATE_DATABASE_URL` points to the approved database/schema.
2. Deploy this commit range, then run `npx prisma migrate deploy`; do not use `migrate dev`, `db push`, or reset.
3. Restart backend with `NODE_ENV=production`, `JOBS_ENABLED=true`, 15-minute job interval, PayOS and verified Resend configuration.
4. Confirm `/api/v1/health`, one email OTP, one Manager TOTP login, one PayOS callback, and one notification email.
5. Use a disposable restore target to run `npm run backup:restore-verify`; record actual recovery time. Acceptance target: RPO <= 1 hour and RTO <= 4 hours.
6. Perform the role-specific pilot UAT in API-00 through API-05 runbooks before onboarding the 80-120 member pilot facility.

## Current evidence boundary

- Local production environment parsing passed without printing secrets.
- Automated backend/frontend checks are green for current source.
- No production migration, deployment, PayOS live callback, Resend live delivery, backup/restore drill, or four-role browser UAT has been executed in this workspace. Those are release gates, not assumptions.
