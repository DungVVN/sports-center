# API-01 Production runbook: Payments

## Scope and provider boundary

- `payos`: payment link/QR and bank-transfer collection. The backend creates a numeric provider order code and accepts payment state only from a verified PayOS webhook.
- `bank_transfer`: do not mark paid from a client request. Use a verified PayOS webhook or a Receptionist confirmation with reason/audit after a documented bank-statement match.
- MoMo and ZaloPay are explicitly out of scope for the pilot and are not exposed by the payment API, frontend or deployment configuration.

## PayOS configuration

Add these deployment-only values:

- `PAYOS_CLIENT_ID`
- `PAYOS_API_KEY`
- `PAYOS_CHECKSUM_KEY`
- Exact HTTPS `CORS_ORIGIN` for the frontend return/cancel URL.

Do not store these values in `.env.example`, source, browser variables, logs or audit value fields.

## Deployment and test sequence

1. Back up the target database and confirm `MIGRATE_DATABASE_URL` and `DATABASE_URL` target the same approved database/schema.
2. Deploy the code and run `prisma migrate deploy`, including `20260922020000_payos_payment_link`.
3. Configure the PayOS keys and restart the backend. A missing key must return `PAYOS_NOT_CONFIGURED`; it must never fall back to a fake paid transaction.
4. Register/confirm the HTTPS PayOS webhook URL: `https://<api-host>/api/v1/payments/callbacks/payos` using the official PayOS dashboard/SDK procedure.
5. Create a dedicated pending membership and PayOS payment. Confirm the returned checkout URL/QR opens, then complete a sandbox test payment.
6. Verify webhook signature, provider order code and amount match the database before the membership becomes active. Send the same webhook again and verify no second activation/event occurs.
7. Capture test account, order code, timestamp, provider response and browser/API evidence. Never record keys, QR payloads, OTPs or cookies.

## Acceptance criteria

- PayOS checkout creation is rejected when credentials or an HTTPS return origin are absent.
- Only a verified PayOS webhook whose `orderCode` and amount match an internal pending payment can activate membership.
- Replayed webhook does not create a second payment event or activate membership twice.
- Failed/invalid webhooks do not change payment or membership state.
- Payment reports derive revenue from `paid_at` and successful payment events, not from client values.
- The pilot supports only PayOS and controlled bank-transfer reconciliation; no MoMo or ZaloPay merchant credential, callback or UAT evidence is required.
- A paid bank transfer requires a Receptionist-entered reconciliation note of at least 10 characters; the note is recorded in the immutable payment event and audit log. Online payments cannot be confirmed manually.

## Sources

- PayOS Node SDK: create a payment link with `paymentRequests.create()` and verify webhooks with `webhooks.verify()`.
