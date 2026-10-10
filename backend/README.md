# Sports Center Backend

Các ghi nhận deployment bên dưới là snapshot lịch sử, cần xác minh lại môi trường chạy. Quy trình hiện tại, secret production, pagination/readiness, CI và UAT nằm trong [runbook](../docs/OPERATIONS.md).

## Cloudflare Workers + existing Neon database

The Workers entry is `src/worker/index.js`; `src/server.js` remains the Render/Node rollback entry. PostgreSQL schema and migrations stay unchanged. No migration runs at Worker request startup. Requests use separate Prisma clients through AsyncLocalStorage; Node retains a shared pool. Workers use Durable Objects for login limits across isolates and Cron Triggers for lifecycle/email jobs.

Run `npm run worker:dev` for local work and `npm run worker:build` for bundle verification. Swagger assets are prepared from the installed dependency; no remote CDN is needed. The default Wrangler target is staging, with jobs disabled and no API-domain route. `production` is a separate Worker target, also with jobs disabled until cutover. Confirm the live `JOB_INTERVAL_MINUTES` before adding its matching cron.

Before deploying, configure only the required existing production settings through Wrangler secrets or the Cloudflare dashboard: database runtime URL (or Hyperdrive with caching disabled), CORS origins, JWT/MFA/verification secrets, CAPTCHA settings, email provider settings, PayOS settings, and Cloudinary settings. Do not put secrets in Wrangler config or Git. Do not upload the migration-owner database URL or backup/test credentials to the Worker. Keep existing keys to preserve sessions and encrypted MFA data. Staging must never send scheduled production email.

The current bcrypt work factor is 12. The edge Worker only forwards requests to 16 API Durable Object shards. Express, Prisma and password operations run inside SQLite-backed Durable Objects, available on Workers Free with a separate 30-second CPU budget. Neon remains the business database; Durable Object storage is only used for distributed login limits. A deployed Free probe successfully hashed and verified a disposable bcrypt-12 password. Validate the complete API on staging before cutover. Monitor Workers, Durable Object duration/request/storage, and Hyperdrive daily quotas: exceeding a Free quota fails requests rather than automatically upgrading the plan. Do not lower password hashing strength to fit a free plan.

Cutover requires staged smoke tests covering authenticated admin/member sessions, CAPTCHA, MFA, bookings, payment webhooks, email, and media. Switch the API hostname only after passing them. Disable Render background jobs before enabling the Worker cron so only one scheduler runs. Keep Render available for rollback; restore its route and scheduler together if needed. Neither Neon nor its data is deleted during this migration.

This folder contains the Node.js/Express API, Prisma database layer, OpenAPI contract, validation, permission middleware and domain modules for the Sports Center MVP. The `project/` folder at the repository root is only the original Figma UI reference and is not a deployment source.

`src/app/create-services.js` owns service composition and `src/app/register-routes.js` owns route order. Each module exposes `index.js` and separates presentation, application, domain (where needed), and infrastructure. The current boundaries and checks are documented in the root [README](../README.md#cấu-trúc-và-ranh-giới-source). Run `npm run check` for lint, unit/contract tests and build validation; database and browser acceptance remain separate gates. `scripts/integration/support-flow.mjs` runs a write-flow check only when `TEST_DATABASE_URL` points to a localhost database named `sports_center_arch_qa*`.

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

- Class booking requires an eligible active membership and its group-class entitlement at the scheduled class time. Zero-price memberships activate without a payment; paid memberships activate after successful payment. A Member may still sign in while payment is pending. Facility reservations use their own permission/approval workflow; an entrance check-in product flow is outside the current scope.
- Renewal reminders start seven days before contractual expiry. The access grace period is exactly 72 hours after that expiry; no late fee applies.
- Facility check-in and class attendance are separate records.
- Each Member has one active primary Coach. Coach access is scoped to assigned Members and classes.
- Package tiers inherit lower-tier entitlements: Basic, Standard, then Premium.
- Member-facing refunds are out of scope after contract acceptance and membership use.
- AI is a contextual reminder and Coach-assistance feature, not an autonomous live chatbot or medical adviser.

## Source composition

`src/openapi/spec.js` composes the published contract from path groups, core/facility schemas and contract enrichments. Edit the owning path/contract file and verify `test/openapi.spec.test.js`; the public export and endpoints remain the same.

`src/modules/training/application/personalization.service.js` composes profile/consent, assessment, protocol/authorization, decision and session operations. `personalization-context.js` owns their shared scope, audit and error-mapping helpers; domain rules remain in `domain/personalization-policy.js`. Repositories are injected at the service composition boundary.
