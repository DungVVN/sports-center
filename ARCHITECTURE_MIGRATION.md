# Sports Center architecture migration

Status: in progress. Preserve existing API behavior and business rules while migrating one capability at a time.

Implementation branch: `codex/architecture-migration`. Baseline at `217edbb`: backend 231 tests, frontend 123 tests, both lint and build checks passed. This file describes the full destination; directories not yet migrated retain their current layout until their own slice passes the gate below.

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
- [x] Support backend and frontend pilot folder boundaries. Support now reaches Members and Notifications through injected capabilities instead of querying their tables.
- [x] OpenAPI and permission inventories updated to discover nested route files.
- [x] Backend 231/231, frontend 123/123, lint and builds passed after the Support pilot. After Notifications migration, backend 233/233 passed.
- [x] Migrated Support and `shared/api` import boundary check added to `npm run check`.
- [x] Domain-neutral UI components moved from `components/ui` to `shared/ui`; feature and layout imports updated. Frontend 123/123 tests, lint and build passed. Toast browser checks passed at mobile, tablet and desktop sizes (3/3 tests).
- [x] Frontend AppShell and its styles moved to `app/layouts`, with 123/123 tests, lint and build passing after the move.
- [x] Public pages, footer and public layout moved to the `site` feature. It consumes Facilities and Memberships through root entrypoints; 123/123 tests, build and public navigation (2/2 browser tests) passed after the move.
- [x] Toast provider, mutation hooks and table helpers moved into `shared`; session permission policy moved to `auth/domain` and is exposed through Auth's root entrypoint. All frontend consumers now use `shared/api` directly, so the old `src/api` shims are gone. The architecture gate rejects product files reappearing in the old generic roots.
- [x] Workspace pages load through feature root contracts. Dashboard shell composition moved from Auth to `app/composition`, eliminating the Auth-to-App dependency while retaining lazy-loaded workspace content. Frontend 123/123 tests, lint and build passed after the move.
- [x] Public navigation browser test passed on the local preview at mobile, tablet and desktop sizes (2/2 tests). The navigation test now waits for document readiness and asserts visible UI instead of waiting for global network idleness.
- [ ] Support write journey against an isolated QA database.
- [ ] Remaining module migration and expansion of architecture import gates with each owner.
- [ ] Full authenticated browser suite, database-backed concurrency checks and staging candidate verification.

## Gate for each slice

- The slice owns a small, reviewable diff and touches no unrelated feature.
- Existing tests, lint and build remain green.
- Any changed endpoint has route/service contract coverage; any changed transaction has database-backed proof.
- User-visible routes, permissions, errors and loading states are checked in the browser when touched.
- Record the evidence and unresolved limits before moving to the next slice.
