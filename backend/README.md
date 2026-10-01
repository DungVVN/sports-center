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

## Public site CMS

`src/modules/site` owns the public page/menu CMS. Only the existing admin role can create and save drafts, publish, or restore a published version. Public `/api/v1/site/*` endpoints read publication pointers, never drafts. Save and publish are separate calls guarded by `editRevision`; the database keeps published snapshots immutable. A published menu must contain a visible link, and internal links to CMS pages must target an already-published page.

Deploy the additive CMS migration before deploying API code that queries these tables. CMS blocks accept validated internal or HTTPS image URLs; an admin can upload JPG, PNG, WebP, GIF, or AVIF (up to 10 MB) directly to Cloudinary through a server signature. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and the server-only `CLOUDINARY_API_SECRET` in the deployment environment. Uploaded asset metadata is recorded in `site_media_assets`; live-provider upload acceptance remains separate from source tests.

The four published pages `/ve-chung-toi`, `/dich-vu`, `/bang-gia` and `/lien-he` read CMS publication pointers independently of the whole-site rollout flag. Cloudflare Pages supplies their initial HTML, SEO metadata, canonical URLs, robots and sitemap. Draft saves and previews never alter published content.

## Swagger and requirement tracking

Swagger UI is served at `/api-docs`, with the OpenAPI 3.1 contract at `/openapi.json`. CMS request/response schemas and examples are maintained in `src/openapi/site-contract.js`. Admin CMS operations accept the admin portal session cookie or a session bearer token and still enforce the admin role. Public CMS reads require no authentication. Draft writes use `editRevision`; publish requires a positive revision and restore requires an already-published revision ID. The contract documents validation, authorization, stale-draft, publication and missing-provider errors.

The local `docs/sports-center-requirements.xlsx` workbook tracks CMS, dedicated pages, SEO, media, API documentation and deployment acceptance in `System Requirements` and `Update`. Requirements distinguish source/tests, production public-read smoke checks and pending authenticated/provider UAT. Both frontend and backend workbook copies are local artifacts excluded from Git.

Deployment snapshot (2026-10-01): the frontend runs on Cloudflare Pages, the production API remains on Render and the database remains on Neon PostgreSQL. The separate `codex/cloudflare-backend-neon` branch implements Cloudflare Free staging with Durable Objects and Hyperdrive. Staging public-read smoke checks passed; authenticated/MFA, booking, payment/webhook, email and media acceptance, synchronized secrets and scheduler handoff are cutover gates. Keep Render if Free quotas or validation are unsuitable. This documentation update does not move the production API or migrate the database.

## Confirmed business decisions

- A paid membership is required for class booking and facility check-in. A Member may still sign in while payment is pending.
- Renewal reminders start seven days before contractual expiry. The access grace period is exactly 72 hours after that expiry; no late fee applies.
- Facility check-in and class attendance are separate records.
- Each Member has one active primary Coach. Coach access is scoped to assigned Members and classes.
- Package tiers inherit lower-tier entitlements: Basic, Standard, then Premium.
- Member-facing refunds are out of scope after contract acceptance and membership use.
- AI is a contextual reminder and Coach-assistance feature, not an autonomous live chatbot or medical adviser.
