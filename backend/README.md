# Sports Center Backend

This folder contains the Node.js/Express API, Prisma database layer, OpenAPI contract, validation, permission middleware and domain modules for the Sports Center MVP. The `project/` folder at the repository root is only the original Figma UI reference and is not a deployment source.

## Database

- Prisma schema: `prisma/schema.prisma`
- Versioned migration: `prisma/migrations/`
- Production database: Neon PostgreSQL, Singapore
- Runtime config: `DATABASE_URL`
- Migration config: `MIGRATE_DATABASE_URL` (falls back to `DATABASE_URL`)

Run `npm run db:migrate` only when Prisma CLI is available in the deployment environment. The initial migration has already been applied to the Neon production database. Later business-rule changes are additive migrations and must not modify an applied migration.

Do not commit a real Neon connection string. Copy `.env.example` to `.env` only on a trusted local machine or configure the variables in Render.

## Demo accounts

Use `DEMO_ACCOUNT_PASSWORD` at runtime, never in source control, then run `npm run db:seed-demo-accounts`. The script upserts two active accounts for each role and creates the matching `staff_profiles` or `members` record. It is intended only for an approved non-production demo environment. With the API running, `npm run test:runtime-auth` checks login, authenticated identity and logout for all eight accounts.

## Confirmed business decisions

- A paid membership is required for class booking and facility check-in. A Member may still sign in while payment is pending.
- Renewal reminders start seven days before contractual expiry. The access grace period is exactly 72 hours after that expiry; no late fee applies.
- Facility check-in and class attendance are separate records.
- Each Member has one active primary Coach. Coach access is scoped to assigned Members and classes.
- Package tiers inherit lower-tier entitlements: Basic, Standard, then Premium.
- Member-facing refunds are out of scope after contract acceptance and membership use.
- AI is a contextual reminder and Coach-assistance feature, not an autonomous live chatbot or medical adviser.
