# Production requirement: Role hierarchy and authority

## Decision

The production pilot has five roles in a strict authority model:

1. **Admin** — one bootstrap account; highest system authority.
2. **Manager** — facility operations authority, subordinate to Admin.
3. **Receptionist** — front-desk operations.
4. **Coach** — training and attendance within assigned scope.
5. **Member** — self-service access to only their own data.

The pilot UAT fixture is **nine accounts**: one Admin, two Managers, two Receptionists, two Coaches, and two Members.

## Authority boundaries

| Capability | Admin | Manager | Receptionist | Coach | Member |
| --- | --- | --- | --- | --- | --- |
| System configuration, backup/restore approval, security recovery | Full, audited | No | No | No | No |
| Create/suspend/change Manager | Full, audited | No | No | No | No |
| Create/suspend Receptionist or Coach | Full | Facility scope | No | No | No |
| View audit log | Full | Operational audit only | No | No | No |
| Operational members, classes, packages and reports | Full | Facility scope | Front-desk scope | Assigned scope | Own data only |
| Payments | Oversight and audit | Read-only | Create/reconcile approved methods | No | Own history only |
| Training and AI | Oversight | Template/operational visibility | No | Assigned learners only | Own approved plan only |

## Manager: Facility Operations Manager

Manager owns day-to-day operations for an assigned facility, but is not a system or identity administrator.

### Allowed

- Manage members, membership packages, class schedules, rooms, bookings, attendance oversight, coach assignment, training templates and support escalation within the facility.
- View facility operations dashboards, reports, pending-reconciliation queues and operational audit events.
- Allocate day-to-day work for existing Receptionist and Coach accounts in the facility, including specialty and operational notes.
- Read payment records and approve operational follow-up; the Receptionist remains responsible for payment entry and approved bank-transfer reconciliation.

### Explicitly blocked

- Creating, modifying, suspending, reactivating or role-changing Admin or Manager accounts.
- Changing any user's role, password, MFA factor, session, email address, access scope or security status.
- Changing PayOS/email-provider credentials, domains, CORS, database, retention, backup/restore or other platform configuration.
- Refunding, payout, provider override, direct online-payment confirmation, or bypass of callback/reconciliation controls.
- Unapproved export of personal data.

### API enforcement

- Replace broad `staff.manage` with `staff.operational.read`, `staff.operational.assign`, and Admin-only `staff.identity.manage`.
- Filter every Manager query/write by actor facility scope; never trust a frontend-selected facility ID.
- Reject `admin` and `manager` staff targets for a Manager actor before any database write.
- Restrict Manager audit access to facility operational events; exclude identity/security recovery and platform configuration.

## Shared page contracts: same name, different data and actions

The same route/page label must never imply the same authority. Each shared page receives an explicit server-side data scope and action capability set.

| Shared page | Admin | Manager | Receptionist | Coach | Member |
| --- | --- | --- | --- | --- | --- |
| Dashboard | System-wide, security/operations overview | Facility KPI and exception queues | Today’s counter operations | Assigned classes and learners | Own activity only |
| Profile | Own profile plus restricted Admin security setup | Own profile and TOTP | Own profile and email-OTP status | Own profile and email-OTP status | Own profile and contacts |
| Members | All facilities; account governance entry point | Facility member lifecycle | Create/update/registration workflow | Read assigned learners only | No list; own profile only |
| Packages | Global catalogue and policy | Facility catalogue and operational assignment view | Assign/manage member memberships | No access | Own memberships only |
| Classes | All facilities; policy oversight | Create/edit/publish within facility | Read and submit operational change request | Assigned classes only | Published classes only |
| Bookings | System audit view | Facility read/exception view | Create/cancel for a member | Read assigned-class roster | Create/cancel own booking |
| Attendance | Audit read-only | Facility oversight read-only | Read/check-in support if explicitly granted | Record/correct/submit assigned class only | Own history only |
| Payments | Audit and exception oversight | Facility read/approval queue only | Create/reconcile approved cash or transfer | No access | Own payment history only |
| Training | Governance and template oversight | Facility templates/operational visibility | No access | Plans/results/AI delivery for assigned learners | Own approved plan/results only |
| Support | All tickets and escalation policy | Facility escalation/response | Facility response | No access unless specifically assigned | Own tickets and own replies only |
| Audit logs | Complete, redacted as required | Facility operational events only | No access | No access | No access |

### Frontend and API rules for shared pages

- The frontend selects a role-specific page mode, not a generic page with hidden buttons. For example `BookingsPage` must receive an explicit `scopeMode` and capabilities, not infer authority only from a label.
- API responses must omit out-of-scope records, columns and action metadata. A disabled frontend action is never sufficient authorization.
- Every page declares `read scope`, `write scope`, `approved actions`, and `forbidden actions` in OpenAPI and role UAT.
- Admin must receive an explicit Admin shell/dashboard mapping; falling back to the Member page is forbidden.
- Manager and Admin must not reuse one unrestricted operational mode. The API must distinguish facility scope from system scope.

## Mandatory controls

- Admin has every granted permission, but each API still enforces server-side scope and audit logging.
- Admin is not creatable, editable, suspendable, or role-changeable through the normal staff API. Bootstrap and recovery use a restricted audited operational procedure with business and technical approval.
- Manager cannot create, edit, suspend, reactivate, or promote Admin or another Manager. A Manager may manage only Receptionist and Coach accounts in its facility scope.
- CAPTCHA is verified server-side for public registration and login attempts. It is also required after rate-limit/risk signals and before sensitive account-recovery flows; a browser-only CAPTCHA check is not accepted.
- TOTP 2FA is an opt-in user security setting for every role. After a user enrolls, a valid TOTP is required before that user's subsequent sessions are issued. Receptionist and Coach do not receive forced email OTP under this policy.
- High-risk Admin actions (role changes, security recovery, export, payment configuration, backup restore) require step-up verification and immutable audit events.
- Frontend visibility is convenience only; authorization and hierarchy are enforced by API and database rules.

## Delivery impact

API-00 must add `admin` to the role enum, role-permission seed, CAPTCHA verification, optional-TOTP policy, dashboard/UI routing and OpenAPI. Staff APIs must enforce hierarchy rather than relying only on `staff.manage`.

## Acceptance criteria

- An Admin can authenticate with server-verified CAPTCHA and access the complete system workspace; TOTP is required only after that user opts in.
- A Manager cannot create, modify, suspend, reactivate, or assign the `admin` or `manager` role, even when crafting a direct API request.
- A Manager can manage Receptionist and Coach accounts only within its facility scope.
- A Manager can complete authorised facility operations without access to identity/security administration, global configuration or payment-provider override.
- Each shared page returns only the role's permitted data and exposes only the actions listed in the shared-page contract, even when called directly through the API.
- CAPTCHA failures and missing/invalid CAPTCHA tokens are rejected server-side without issuing a session.
- Any user who has enrolled TOTP cannot get a session after password alone.
- Admin bootstrap, role changes, MFA reset and security recovery have immutable audit evidence.
- Production UAT uses the nine-account fixture and records outcome by role without recording passwords, OTPs or TOTP secrets.
