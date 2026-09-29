# Sports Center Backend

This folder contains the Node.js/Express API, Prisma database layer, OpenAPI contract, validation, permission middleware and domain modules for the Sports Center MVP. The `project/` folder at the repository root is only the original Figma UI reference and is not a deployment source.

`src/app/create-services.js` owns service composition and `src/app/register-routes.js` owns route order. Each module exposes `index.js` and separates presentation, application, domain (where needed), and infrastructure. See [the migration plan](../ARCHITECTURE_MIGRATION.md). Run `npm run check` for lint, unit/contract tests and build validation; database and browser acceptance remain separate gates. `scripts/integration/support-flow.mjs` runs a write-flow check only when `TEST_DATABASE_URL` points to a localhost database named `sports_center_arch_qa*`.

## Database

- Prisma schema: `database/prisma/schema.prisma`
- Versioned migration: `database/prisma/migrations/`
- Production database: Neon PostgreSQL, Singapore
- The configured database reported PostgreSQL 18.6 during the migration audit; isolated QA checks should use the same major version.
- Runtime config: `DATABASE_URL`
- Migration config: `MIGRATE_DATABASE_URL` (falls back to `DATABASE_URL`)

Use the workflow in [`database/README.md`](database/README.md) to set up a new database. The deployed Neon database is managed through the complete versioned Prisma migration history, not a standalone SQL snapshot. Never modify an applied migration.

Do not commit a real Neon connection string. Copy `.env.example` to `.env` only on a trusted local machine or configure the variables in Render.

## Confirmed business decisions

- A paid membership is required for class booking and facility check-in. A Member may still sign in while payment is pending.
- Renewal reminders start seven days before contractual expiry. The access grace period is exactly 72 hours after that expiry; no late fee applies.
- Facility check-in and class attendance are separate records.
- Each Member has one active primary Coach. Coach access is scoped to assigned Members and classes.
- Package tiers inherit lower-tier entitlements: Basic, Standard, then Premium.
- Member-facing refunds are out of scope after contract acceptance and membership use.
- AI is a contextual reminder and Coach-assistance feature, not an autonomous live chatbot or medical adviser.
