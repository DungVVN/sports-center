# Database foundation

This folder provides the PostgreSQL 16+ database foundation for the Sports Center backend. It deliberately contains no credentials and does not start a database service.

## Environment

The production database is Neon PostgreSQL (Singapore). Docker is not used.

1. Copy `../.env.example` to `../.env` only on a trusted local machine.
2. Put the Neon connection string in `DATABASE_URL` and, while there is a single owner account, in `MIGRATE_DATABASE_URL` too.
3. In Render, configure the same values as encrypted environment variables; do not commit them.

## Run migrations

1. Create an empty PostgreSQL database.
2. Provide its Neon connection string as `DATABASE_URL`.
3. Run `npm run db:migrate`.

Sports Center now follows the same Prisma/PostgreSQL migration layout as UBND-BE: `prisma/migrations/` is the source of truth and Prisma owns its `_prisma_migrations` ledger. `prisma/migrations/20260913000000_initial_sports_center/migration.sql` is the initial migration and `20260913000100_membership_access_rules` is the deployed business-rule adjustment. Do not run `database/schema.sql` manually on a Prisma-managed database.

For every later database change, create a new migration through Prisma with a higher timestamp. Never modify an already-applied migration.

## What is covered

- Accounts, roles, exact permissions, staff and member profiles.
- Tiered membership entitlements, payment-gated activation and auditable membership history.
- Rooms, concrete class sessions, bookings, facility check-ins, class attendance and direct Coach corrections.
- Payments, append-only payment events and paid-at revenue reporting; legacy refund records are retained but new requests are disabled by policy.
- Training plans, exercises and recorded outcomes.
- Notifications, support tickets and audit logs.

## Prisma workflow

- `npm run db:validate` validates `prisma/schema.prisma`.
- `npm run db:migrate` applies versioned SQL through Prisma using `MIGRATE_DATABASE_URL` when present.
- `npm run db:generate` creates the typed client at `src/generated/prisma`.
- `npm run db:seed` upserts DEV reference roles, permissions, packages, and rooms; it never runs automatically in production.

## Important server rules

The database prevents a pending-payment or out-of-window member from booking/checking in, rejects duplicate live bookings, serializes capacity checks by locking the class row, activates a pending membership only after a successful payment, and requires a Coach reason plus audit log for attendance correction. Settled payment identity/amount/method fields cannot be edited in place.

The future backend must additionally enforce endpoint authorization and data scope (Coach = assigned students/classes; Member = own records only). Do not treat navigation visibility in the UI as authorization. It must also run the expiry-notification and automatic-expiry job; the database preserves the required timestamps but does not schedule notifications itself.

## Deliberate implementation boundary

No backend/API, password-creation endpoint, or real payment provider has been added because this project currently contains only a Figma Make frontend. A future server should use the generated Prisma client and a restricted runtime database account; the migration account should be supplied through `MIGRATE_DATABASE_URL`.
