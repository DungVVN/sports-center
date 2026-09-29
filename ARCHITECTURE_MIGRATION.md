# Sports Center architecture migration

Status: local structural migration and isolated QA passed; staging promotion is pending. Preserve existing API behavior and business rules while migrating one capability at a time.

Implementation branch: `codex/architecture-migration`. Baseline at `217edbb`: backend 231 tests, frontend 123 tests, both lint and build checks passed. This file describes the destination now implemented locally; optional layer directories are created only where owned code exists.

## Target source structure

```text
backend/src/
  app/                 # HTTP composition and route registration
  config/              # validated runtime configuration
  modules/<capability>/
    presentation/      # Express routes, input and output contracts
    application/       # use cases and capability interfaces
    domain/            # pure rules and state transitions, where needed
    infrastructure/    # Prisma repositories and external adapters
    index.js            # public module contract
  shared/              # HTTP, authentication, audit and database primitives
  openapi/             # versioned API contract
  server.js            # process lifecycle

frontend/src/
  app/                 # providers, routing, layouts and composition
  config/              # runtime configuration
  features/<capability>/
    api/                # requests and query hooks
    application/        # multi-step client workflows, where needed
    domain/             # pure feature rules and contracts, where needed
    routes/             # route-level adapters
    ui/                 # feature-owned presentation
    index.js            # public feature contract
  shared/
    api/                # HTTP transport and error parsing
    ui/                 # domain-neutral components
    lib/                # domain-neutral utilities
  main.jsx
```

The directories above are destinations, not empty scaffolding requirements. Create a layer only when it has a real owner. Keep Express, Prisma, JavaScript ESM, React, Vite and TanStack Query. Preserve route paths, API payloads, error codes, permission checks, database schema and existing UI behavior unless a separately reviewed feature requires a change.

## Migration sequence

1. Record the baseline: branch/HEAD, clean worktree, lint, unit tests, build, routes, API payloads and the critical browser journeys.
2. Add one aggregate quality command and architecture boundary checks. It must report each gate separately and not imply database or browser acceptance.
3. Extract backend service composition from `app.js`, then route registration. Keep the same route order and dependency injection hooks. Verify app, route and service tests before and after.
4. Migrate a small backend capability (Support) into presentation/application/infrastructure, retaining its public behavior. Add only meaningful missing contract tests.
5. Migrate remaining backend modules in risk order: read-oriented modules first, then identity/staff/membership, then bookings/facilities/payments/attendance. For transactions, preserve atomicity and audit behavior; add integration proof against a disposable database before promotion.
6. Consolidate frontend transport and domain-neutral UI under `shared`, then migrate one feature at a time behind root `index.js` contracts. Keep existing imports working until all consumers move.
7. Separate app routing, session lifecycle and layouts. Introduce a router only after deep-link, back/forward, login, admin/member portal and permission regression coverage exists.
8. Run full unit, lint, build and browser suites; compare API/OpenAPI contracts and test real PostgreSQL flows. Stage and verify the exact candidate before product promotion.

## Delivery slices and order

| Slice | Backend owners | Frontend owners | Required proof |
|---|---|---|---|
| Foundation | `app`, shared HTTP, module contract | `app`, `shared/api` | All existing tests, lint, build and public navigation |
| Support pilot | Support; read/write/audit/notification contracts | Support public and staff screens | Route permission, member scope, create/respond and browser flow in isolated QA |
| Reference and reporting | Insights, Audit, AI Assist | Dashboard and reports | API/OpenAPI parity and role-scoped reads |
| People and access | Identity/Auth, Staff, Members, Assignments, Roles/Permissions | Auth, Staff, Members, Roles/Permissions | Login, MFA, reset, permission change and session regression |
| Membership and training | Memberships, Classes, Training, Notifications | Corresponding features | Lifecycle, scheduled jobs, entitlement and attendance-adjacent contracts |
| Reservation and money | Bookings, Facilities, Attendance, Payments | Corresponding features | Serializable/concurrent transactions, PayOS callback idempotency, audit and isolated browser journeys |
| Routing and release | HTTP entrypoint, OpenAPI, migrations | Router, layouts, shared UI | Deep links, back/forward, mobile/admin/member portals, migrated PostgreSQL and staging smoke |

For every slice: preserve existing path and payload contracts; move one owning module at a time; run the local gate; record changed imports and any missing integration evidence. A passing source gate is not a deployed or concurrent-load result.

## Progress and remaining gates

- [x] Source baseline and aggregate `npm run check` command.
- [x] Backend service composition and ordered route registration extracted from `app.js` into `src/app/`.
- [x] Notification preferences and publisher moved behind the Notifications module contract. Service defaults, actor scoping and the disabled push behavior are covered by focused tests; no schema or endpoint change.
- [x] Insights and Audit read-model modules moved behind public entrypoints and presentation/application/infrastructure folders. Their cross-table projection queries remain deliberately inside their existing read repositories; no query or response contract was rewritten.
- [x] AI Assist and Role Permissions moved behind public contracts without rewriting their existing database transactions. Permission catalog now lives in `role-permissions/domain`; its transaction and audit behavior are retained.
- [x] The configured Sports Center database reported PostgreSQL 18.6 via read-only `SHOW server_version`. All 42 existing Prisma migrations applied successfully to a disposable localhost PostgreSQL 18.6 database. An earlier 16 check was only a compatibility smoke test; the temporary 16 container was removed.
- [x] Auth, Staff, Members, Memberships, Assignments, Classes, Training, Bookings, Facilities, Attendance and Payments now expose module entrypoints and layered folders. Existing route paths, repository operations and transaction bodies were not changed; the app composition injects credential delivery and PayOS adapters instead of application code importing them.
- [x] Support's real PostgreSQL 18.6 create/scope/assign/respond/notification/audit/preferences flow passed on an isolated database, including two concurrent ticket creates. Its test records were removed afterward.
- [x] Architecture check now covers all backend module roots and import direction, plus cross-feature imports on the frontend. Backend 233/233 and frontend 123/123 unit tests, lint and builds passed after the structural slices.
- [x] Support backend and frontend pilot folder boundaries. Support now reaches Members and Notifications through injected capabilities instead of querying their tables.
- [x] OpenAPI and permission inventories updated to discover nested route files.
- [x] Backend 231/231, frontend 123/123, lint and builds passed after the Support pilot. After Notifications migration, backend 233/233 passed.
- [x] Migrated Support and `shared/api` import boundary check added to `npm run check`.
- [x] Domain-neutral UI components moved from `components/ui` to `shared/ui`; feature and layout imports updated. Frontend 123/123 tests, lint and build passed. Toast browser checks passed at mobile, tablet and desktop sizes (3/3 tests).
- [x] Frontend AppShell and its styles moved to `app/layouts`, with 123/123 tests, lint and build passing after the move.
- [x] Public pages, footer and public layout moved to the `site` feature. It consumes Facilities and Memberships through root entrypoints; 123/123 tests, build and public navigation (2/2 browser tests) passed after the move.
- [x] Toast provider, mutation hooks and table helpers moved into `shared`; session permission policy moved to `auth/domain` and is exposed through Auth's root entrypoint. All frontend consumers now use `shared/api` directly, so the old `src/api` shims are gone. The architecture gate rejects product files reappearing in the old generic roots.
- [x] Workspace pages load through feature root contracts. Dashboard shell composition moved from Auth to `app/composition`, eliminating the Auth-to-App dependency while retaining lazy-loaded workspace content. Frontend 123/123 tests, lint and build passed after the move.
- [x] All frontend features now keep their API hooks/clients under `api`, presentation and styles under `ui`, and pure Auth validation/permission rules under `domain`. Cross-feature imports use feature entrypoints; frontend 123/123 tests, lint and build passed after the 86-file mechanical layout migration.
- [x] Public navigation browser test passed on the local preview at mobile, tablet and desktop sizes (2/2 tests). The navigation test now waits for document readiness and asserts visible UI instead of waiting for global network idleness.
- [x] Support write journey against an isolated QA database.
- [x] Frontend feature-local API/UI folder migration.
- [x] Authenticated browser regression on an isolated PostgreSQL 18.6 QA database: manager, receptionist, coach and member portal navigation across mobile/tablet/desktop (12/12), member history/deep-link/back/forward/reload, separate Admin portal, role access, Support, package/member assignment, cash payment, booking, class, facility and registration journeys passed. Seven additional public/layout checks passed after the feature folder migration.
- [x] PostgreSQL 18.6 integration checks passed for role-permission optimistic concurrency, booking capacity/waitlist and duplicate suppression, facility approval/duplicate suppression, and PayOS callback race. The callback race exposed a stale `pending` response on the losing request; the service now re-reads committed payment state and has unit regression coverage. These are isolated database tests, not external PayOS settlement proof.
- [x] Source ownership review completed. Cross-module read projections and atomic writes are inventoried below; no transaction was split merely to make folder boundaries look pure.
- [ ] Staging candidate verification and external integration/UAT proof. No deployment or production database migration was performed.

Latest local aggregate gate: backend 234/234 tests, frontend 123/123 tests, architecture checks, lint and both builds passed. All 42 existing migrations were applied only to disposable PostgreSQL 18.6 instances. The configured database version was independently read as 18.6; the architecture work does not downgrade it to PostgreSQL 16.

### Data ownership decisions

The modular monolith retains one PostgreSQL database. Public `index.js` contracts and application injection govern source dependencies, while a few repositories still join or atomically update tables owned by other capabilities. This is an explicit compatibility boundary, not independent database ownership:

| Capability repository | Existing cross-capability work | Decision before staging |
|---|---|---|
| Insights, Audit, AI Assist, dashboard-oriented reads | Project member, booking, class, membership and attendance data | Retain read-model projections; do not replace them with sequential API calls that change consistency or latency. |
| Payments | Atomically records payment event, activates membership and creates notification | Retain one database transaction; the duplicate webhook race is covered on PostgreSQL 18.6. External PayOS settlement remains unverified. |
| Bookings, Attendance, Facilities, Role Permissions | Reads related member/class/permission state and writes notifications or audit entries in the same workflow | Retain atomic write boundaries; booking, facility and permission races have isolated database proof. |
| Auth, Staff, Members | Creates or updates user/profile/member records and revokes auth sessions together | Retain atomic identity lifecycle; do not split credentials or session revocation into eventual asynchronous steps. |
| Classes, Memberships, AI Assist | Creates operational notifications from owner workflows | Preserve current delivery and response behavior; a future outbox requires its own migration and replay tests. |

These are deliberate monolith coupling points. Turning them into independently owned stores or asynchronous events would change transaction semantics and is outside this behavior-preserving migration. The remaining release gate is a deployed staging candidate against its configured PostgreSQL 18 environment, real external PayOS/email integrations and user acceptance checks; local tests cannot certify those.

## Gate for each slice

- The slice owns a small, reviewable diff and touches no unrelated feature.
- Existing tests, lint and build remain green.
- Any changed endpoint has route/service contract coverage; any changed transaction has database-backed proof.
- User-visible routes, permissions, errors and loading states are checked in the browser when touched.
- Record the evidence and unresolved limits before moving to the next slice.
