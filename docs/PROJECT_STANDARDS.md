# Sports Center Project Standards

## 1. Scope and sources of truth

- `project/` is a disposable Figma UI reference. Do not modify it or place product code in it.
- `frontend/` contains the React JSX product. `backend/` contains the Node.js product and Prisma database layer.
- Business decisions approved in the project conversation and the versioned API contract override visual mock data in `project/`.
- The Figma reference controls visual direction: information hierarchy, labels, states, desktop/mobile behavior, and component appearance. Rebuild it in `frontend/`; do not copy source files into the product.
- The database schema and applied migrations are the source of truth for persisted data. Swagger/OpenAPI is the source of truth for the HTTP contract.

## 2. Delivery rule

Work on one approved MVP group at a time. Complete this loop before starting another group:

1. Implement backend route, schema validation, permission/scope checks, business service, transaction and audit behavior.
2. Test the API, including valid use, invalid input, forbidden access and business-rule failures.
3. Implement only the matching React JSX screen/flow and call the real API.
4. Test the integrated FE/API flow, including loading, empty, error and success states.
5. Update Swagger/OpenAPI with the exact request, response and error contract.
6. Run relevant tests, lint and production builds for both applications.
7. Inspect the intended diff, commit only that completed group, push and verify the push.

Do not keep mocks for a delivered flow, skip a failing gate, or begin the next group early.

## 3. Technology and package rules

- Use `npm` only. Do not add pnpm files, workspace files or pnpm commands.
- Frontend uses React and `.jsx`; backend uses Node.js ESM and `.js`. Do not introduce TypeScript.
- Add a dependency only when it removes meaningful repeated code or solves a concrete need. Record the reason in the group commit or PR description.
- Pin project behavior through `package-lock.json`. Never commit `node_modules`, `.env`, provider keys, tokens or Neon connection strings.
- Each application must eventually expose `npm run test`, `npm run lint` and `npm run build`. A command must not silently pass while skipping its work.

## 4. Frontend standards

### Structure

```text
frontend/src/
  app/          application bootstrap, router and providers
  api/          HTTP client, endpoint functions and API error mapping
  features/     domain flows such as auth, members, booking and payment
  pages/        route-level composition only
  components/   shared ui, layout and domain-neutral components
  hooks/        reusable React hooks
  lib/          pure helpers and formatters
  styles/       tokens, reset and shared global styles
```

- Pages compose features. A page must not call `fetch` directly, encode permission rules or duplicate a business workflow.
- Endpoint calls live in `api/` or the owning feature service. All requests use one API client that handles base URL, credentials/token, timeout, normalized errors and request IDs.
- Keep server data separate from temporary form state. Cache/refetch behavior belongs in a shared server-data layer, not in page-local effects.
- Use route guards driven by the authenticated user and backend permissions. The UI may hide an action but never becomes the authorization boundary.

### UI and forms

- Start from Figma UI reference, then implement reusable product components in `frontend/`.
- Use design tokens and component-scoped CSS. Do not copy large inline style objects across pages. Inline style is permitted only for genuinely dynamic runtime values.
- Reuse `Button`, `FormField`, input/select/textarea/date controls, dialog, toast, state views, pagination, tooltip and list/filter toolbar.
- Reuse field groups and pickers when their meaning is stable: `PersonContactFields`, `MemberPicker`, `CoachPicker`, `PackagePicker`, `ClassSessionPicker`, `PaymentMethodSelector` and `ApprovalDecisionDialog`.
- Do not build one generic business form for Member, Payment, Class, Booking, Attendance and Training. Reuse primitives while keeping their workflow-specific validation and screens explicit.
- Every form has client validation for UX and displays backend field errors. Backend validation remains authoritative.
- Every API-backed screen includes loading, empty, forbidden, failure and retry behavior where applicable. Do not use a successful toast to hide a failed request.
- Maintain Vietnamese product copy consistently. Use accessible labels, keyboard focus, disabled/loading states and sufficiently large touch targets.

## 5. Backend standards

### Structure

```text
backend/src/
  app.js        Express application composition
  server.js     process startup and shutdown
  config/       validated environment configuration
  modules/      one folder per MVP domain
    <domain>/   route, controller, service, repository, schema, tests
  shared/       auth, validation, errors, response, audit, db and utilities
  jobs/         scheduled reminders and provider callbacks when needed
```

- Routes describe HTTP mapping and middleware only. Controllers parse the request and map the response. Services own business rules. Repositories own Prisma reads/writes.
- Controllers never call Prisma directly. Do not repeat access checks, audit writes, pagination parsing or error mapping in controllers.
- Use one validation middleware based on explicit schemas for body, params and query. Validate and normalize email, phone, UUID, pagination, sort, dates, money and enums once.
- Use one API error format with stable machine codes. Return field-level validation errors in a shape the React form can display.
- Authenticate every protected request. Authorize by permission code and data scope, not solely by a role label sent by the client.
- Use Prisma transactions for changes that must stay atomic: paid payment activation, booking capacity/waitlist promotion, status transitions and audit writes.
- Services must enforce state transitions, unique constraints and time rules on the server. Never trust a client-calculated entitlement, price, status, capacity or authorization decision.

### Shared domain policies

- `membershipAccessPolicy`: active/grace eligibility, entitlement and quota.
- `paymentActivationService`: paid event activates the linked membership once, records audit and triggers notification.
- `bookingCapacityService`: duplicate prevention, capacity check, waitlist ordering and automatic confirmation.
- `coachScopePolicy`: class/Member visibility based on current or historical assignment effective dates.
- `auditService`: actor, action, entity, before/after values, reason, timestamp and request correlation.
- `notificationService`: in-app notifications for membership, class, waitlist and AI reminder events.

Do not create a generic repository or generic service merely to wrap Prisma CRUD. Extract a shared module only when the rule is genuinely reused and has one stable meaning.

## 6. API and Swagger standards

- Version APIs under `/api/v1`.
- Use plural resources, conventional HTTP methods and explicit action endpoints only for real commands, such as `publish`, `cancel`, `approve` or `check-in`.
- List endpoints support documented pagination, allowlisted sorting and documented filters.
- Every endpoint has auth requirements, permission/scope notes, request schema, response schema, error cases and realistic examples in Swagger.
- Update Swagger in the same change set as the route. Swagger is incomplete until an integration test covers the contract.
- Provider callbacks validate signatures, use idempotency keys and never activate a membership from an unverified client request.

## 7. Database and data integrity standards

- Never edit an applied migration. Add a new, ordered Prisma migration for every persistent schema change.
- Store VND as integer values. Derive revenue from successful payments using `paid_at`, never from a client-side total.
- Keep payment events immutable. Record status history and audit sensitive transitions.
- Use database constraints for uniqueness and foreign keys. Use application validation for clear messages, not as the only protection.
- Check-in/check-out is tied to a class session and booking. It is not a general facility-access record in this MVP.
- Never log passwords, raw tokens, connection strings, provider signatures or sensitive personal data.

## 8. Testing and quality rules

- Test every new domain with happy path, invalid input, unauthenticated, forbidden, not found, conflict and business-rule boundary cases.
- Add integration tests for transactions and external callback idempotency.
- Test FE forms against the real API in the completed group. Visual acceptance compares the implemented screen with the Figma reference at desktop and mobile breakpoints.
- Run static checks before commit. Do not weaken lint rules, delete tests or use broad ignore directives to make a check pass.
- Keep test fixtures explicit and isolated. Do not point automated destructive tests to Neon production.

## 9. Git and review rules

- Keep each commit focused on one completed MVP group or a clearly named preparatory task.
- Before commit, inspect `git status`, `git diff --check` and the staged diff. Never stage `.env`, secrets, `node_modules`, generated caches or unrelated user changes.
- Commit messages use an imperative scope, for example `feat(auth): add member approval flow`.
- Push only after all delivery gates pass. Report the branch, commit hash, push result and any verification limits.

## 10. Current MVP exclusions

- Member refund after contract acceptance/use.
- Support ticket workflow.
- Live AI chat and medical advice.
- Any feature not represented by an approved MVP group.

## 11. Visual design system

### Design source and implementation rule

- Match the visual direction in `project/` before inventing a new design: calm B2B sports-operations UI, light work surface, navy navigation, blue primary action and orange operational CTA.
- Copy the system, not page-local inline CSS. Define the approved tokens in `frontend/src/styles/tokens.css` and build reusable components from them.
- Do not introduce a second font family, a second blue, arbitrary border radius, gradients, glass effects, neon colors or decorative animations without an approved design decision.
- Use component-scoped CSS for components and features. Global CSS is reserved for reset, tokens, typography utilities and shared layout primitives.

### Color tokens

| Purpose | Token | Value | Use |
| --- | --- | --- | --- |
| Application background | `--color-bg` | `#F5F8FC` | Main work surface |
| Card surface | `--color-surface` | `#FFFFFF` | Cards, dialogs, tables |
| Muted surface | `--color-surface-muted` | `#EEF3F9` | Secondary controls and selected neutral areas |
| Border | `--color-border` | `#E4EBF5` | Cards, inputs, table separators |
| Main text | `--color-text` | `#102A43` | Headings and body copy |
| Secondary text | `--color-text-secondary` | `#64748B` | Supporting information |
| Muted text | `--color-text-muted` | `#94A3B8` | Timestamps and hints |
| Primary blue | `--color-primary` | `#2563EB` | Primary buttons, links, focus, active navigation |
| Primary hover | `--color-primary-hover` | `#1D4ED8` | Hover state only |
| Operational orange | `--color-accent` | `#F97316` | Check-in, register, renew and create CTA only |
| Progress teal | `--color-teal` | `#0F766E` | Progress and health metrics only |
| Success | `--color-success` | `#16A34A` | Successful status and confirmation |
| Warning | `--color-warning` | `#D97706` | Expiring and attention-required status |
| Danger | `--color-danger` | `#DC2626` | Destructive actions and failed status |
| Information | `--color-info` | `#0284C7` | Informational messages |
| Sidebar | `--color-sidebar` | `#0B1F33` | Persistent desktop navigation |

- Semantic colors communicate status, never decoration. Pair each status color with text and/or an icon.
- Orange is intentionally scarce. A screen should normally have one operational CTA, not several competing orange buttons.
- Disabled controls use reduced contrast and `disabled` semantics; they are not merely visually faded clickable elements.

### Typography and numeric data

- Use **Be Vietnam Pro** for all product text and **JetBrains Mono** only for identifiers, timestamps, transaction codes and aligned financial/table values.
- Use this fixed type scale. Do not choose one-off font sizes in page code.

| Role | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| KPI/display | `26px / 1.15` | 700 | KPI and revenue values |
| Page title | `24px / 1.3` | 700 | One title per page |
| Section title | `18px / 1.4` | 600 | Major content blocks |
| Body | `14px / 1.5` | 400 | Default copy and form content |
| Caption/helper | `12px / 1.5` | 400 | Hints, dates and supporting notes |
| Table overline | `12px / 1.4` | 600, uppercase | Table headers only |
| Badge | `12px / 1` | 500 | Compact state labels |

- Use tabular numbers for amounts, metrics, dates and values that users compare vertically.
- Keep all product copy in Vietnamese. English is allowed only for established provider/product names such as PayOS and technical identifiers.

### Spacing, radius and elevation

- Use an 8px layout grid. `4px` is allowed only for tight internal gaps such as icon-to-label or label-to-hint.
- Approved spacing steps are `4, 8, 12, 16, 20, 24, 32, 40, 48` pixels. Do not add arbitrary gaps.
- Use `8px` for small controls, `10px` for small buttons, `12px` for normal buttons and inputs, `14px` for large buttons, and `16px` for cards/dialogs.
- Cards use a white surface, one subtle `#E4EBF5` border and a soft low-opacity navy shadow. Do not stack cards inside cards without a clear content boundary.
- Use elevation only for dialogs, floating help, menus and raised primary buttons. Avoid heavy shadows in normal content.

### Layout and content hierarchy

- Desktop uses the navy sidebar and top header from the Figma reference. Keep page content in a scrollable main region with `24px` horizontal / `20px` vertical padding.
- A page follows one consistent hierarchy: page title and one primary action, optional filter/action row, KPI summary where meaningful, then primary task content, then secondary detail.
- Put the primary operational task near the top: search/check-in/payment for Receptionist; today’s classes/attendance for Coach; package and upcoming classes for Member; metrics and exceptions for Manager.
- Do not fill dashboards with decorative cards. A card must represent a KPI, a task, a meaningful list or a bounded decision.
- Desktop dashboard grids may use four KPI columns. Tablet uses two columns. Mobile uses one column unless two compact metrics remain readable.
- Tables keep their semantic columns and may horizontally scroll on small screens. Dashboards, forms and action panels must reflow to one column instead of becoming horizontally scrollable.

### Components and states

- Button sizes are fixed: small `30px`, medium `36px`, large `44px`. Mobile primary actions and icon-only actions require a minimum `44px` touch target.
- Use blue for normal primary action, orange for the single operational CTA, secondary for alternate action, ghost for low-emphasis action and danger for irreversible/destructive action.
- Inputs share the same border, radius, label, required marker, helper, error and focus behavior. Focus is a 2px blue visible ring; invalid input uses danger border plus readable error text.
- Dialogs show title, context, close affordance, safe cancellation and an explicit confirmation action. Destructive or audited actions collect a reason when the business rule requires it.
- List screens reuse a search/filter toolbar, loading state, empty state, error state, pagination and row actions. Never present a blank table as an empty state.
- Status badges use the shared enum-to-label mapping. Do not hand-write status colors or Vietnamese labels per page.
- Tooltips are required for unfamiliar icons, icon-only actions, calendar navigation, filters, close/edit/more actions and sidebar collapse.

### Responsive and accessibility rules

- Use breakpoints consistently: mobile below `768px`, tablet `768–1023px`, desktop `1024px` and above.
- On mobile, collapse staff navigation into the drawer. Member navigation may use the bottom navigation from the Figma reference.
- Make dialogs responsive: normal centered dialog on desktop, width-safe sheet or full-screen dialog on narrow screens when a form cannot remain readable.
- Preserve keyboard navigation, visible focus, semantic labels, error announcements and contrast. Icon-only controls require `aria-label` and tooltip.
- Respect reduced motion. Transitions remain short (`120–150ms`) and must not block action completion.

### Visual acceptance before group completion

- Compare every delivered FE screen with its Figma reference at desktop and mobile sizes.
- Check title/action hierarchy, token usage, font scale, alignment, table density, empty/error/loading states, focus, disabled controls and Vietnamese labels.
- Reject a screen that works functionally but introduces unapproved colors, fonts, radii, spacing, duplicated component styling or a layout that diverges from the reference without a documented reason.
