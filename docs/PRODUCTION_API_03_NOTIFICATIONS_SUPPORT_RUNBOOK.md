# API-03 — Notifications, Email Preferences, Support

## Scope delivered

- `GET`/`PUT /api/v1/notification-preferences`: each account controls only operational/support email with `emailEnabled`; security verification email is never disabled by this preference.
- Existing in-app notifications become a durable email outbox. The worker claims one notification, retries failed provider sends at most five times, records delivery/skip/failure state, and never logs a recipient address or provider response body.
- A disabled email preference or inactive/missing recipient is terminally marked skipped; it is not retried forever.
- Receptionist/Manager support replies create an immutable in-app notification for the ticket owner. That notification then follows the same email-preference and outbox path.
- Push notification is deliberately disabled in this pilot; it has no active provider or device-token delivery path.

## Required production configuration

Set these variables in the deployed backend (never send values in chat):

```env
NODE_ENV=production
VERIFICATION_DELIVERY_MODE=provider
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=no-reply@kineticsports.io.vn
RESEND_FROM_NAME=Kinetic Sports
PUBLIC_API_ORIGIN=https://api.kineticsports.io.vn
JOBS_ENABLED=true
JOB_INTERVAL_MINUTES=15
```

`NODE_ENV=production` now refuses startup if provider email mode does not have both Resend credentials. Before enabling delivery, verify the sending domain in Resend and deploy the migration.

## Pilot UAT evidence required

1. Member keeps email enabled; staff responds to a ticket; member sees in-app notification and exactly one Resend email.
2. Member disables email; a second staff response remains visible in-app but is marked skipped and no email arrives.
3. Simulate one provider error; the row keeps a delivery error and is retried on the next job run. Confirm no more than five attempts.
4. Confirm registration/staff-login OTP still arrives even when operational email is disabled.
5. Capture the role, ticket ID, notification ID, timestamp, and mail-provider message ID in the pilot log; do not capture codes, API keys, or full email address.

This is source-level implementation and automated-test evidence only until the migration is applied and the above production UAT is performed.
