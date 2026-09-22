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

## Mandatory controls

- Admin has every granted permission, but each API still enforces server-side scope and audit logging.
- Admin is not creatable, editable, suspendable, or role-changeable through the normal staff API. Bootstrap and recovery use a restricted audited operational procedure with business and technical approval.
- Manager cannot create, edit, suspend, reactivate, or promote Admin or another Manager. A Manager may manage only Receptionist and Coach accounts in its facility scope.
- Admin and Manager require enrolled TOTP before a production session is issued. Receptionist and Coach require email OTP. Member MFA is deferred for this pilot.
- High-risk Admin actions (role changes, security recovery, export, payment configuration, backup restore) require step-up verification and immutable audit events.
- Frontend visibility is convenience only; authorization and hierarchy are enforced by API and database rules.

## Delivery impact

API-00 must add `admin` to the role enum, role-permission seed, authentication/TOTP policy, dashboard/UI routing and OpenAPI. Staff APIs must enforce hierarchy rather than relying only on `staff.manage`.

## Acceptance criteria

- An Admin can authenticate with TOTP and access the complete system workspace.
- A Manager cannot create, modify, suspend, reactivate, or assign the `admin` or `manager` role, even when crafting a direct API request.
- A Manager can manage Receptionist and Coach accounts only within its facility scope.
- A Manager can complete authorised facility operations without access to identity/security administration, global configuration or payment-provider override.
- Receptionist and Coach do not obtain a session until their email OTP is verified.
- Admin bootstrap, role changes, MFA reset and security recovery have immutable audit evidence.
- Production UAT uses the nine-account fixture and records outcome by role without recording passwords, OTPs or TOTP secrets.
