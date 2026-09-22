# Admin subdomain design

## Product decision

Deploy a separate Admin frontend at `https://admin.kineticsports.io.vn`.

It is intentionally not linked from the public/member/operations frontend. The subdomain is an operational separation, **not** a security control: access is protected by Cloudflare Access, the Admin role, CAPTCHA, strict origin policy and server-side authorization. TOTP is an opt-in user security setting.

## Architecture

```text
admin.kineticsports.io.vn     → separate Admin frontend deployment
www.kineticsports.io.vn       → operations/member frontend
api.kineticsports.io.vn       → shared API, Admin-only routes and role/scope checks
```

- Give Admin its own frontend build and deployment project so its navigation, bundles and release cadence are isolated from the normal application.
- API uses explicit allowed origins for both application hosts. Admin API routes require `admin` role plus relevant permission; the normal frontend never receives Admin navigation.
- Session cookies remain HttpOnly/Secure. Cookie domain stays host-only by default; do not widen to `.kineticsports.io.vn` unless cross-subdomain SSO is explicitly approved and CSRF controls are reviewed.
- Use no public index route, sitemap entry, marketing link or client-side fallback from the normal frontend. This reduces accidental discovery but does not replace authentication.

## Admin information architecture

1. **System overview** — facility health, failed jobs, provider/webhook health, security alerts and release state.
2. **Identity & access** — Manager lifecycle, staff identity operations, role assignments, account suspension/reactivation and TOTP recovery workflow.
3. **Facilities & operations** — cross-facility read/exception view; drill-through to operational records without using Manager write capability.
4. **Finance control** — payment anomalies, reconciliation exceptions, refund approval queue and immutable event history.
5. **Security & audit** — full audit trail, role/MFA/session events, export approvals and incident record.
6. **Platform & recovery** — provider configuration metadata, backup status, restore drills and release checklist. Secrets are never displayed after save.

## Non-negotiable safety controls

- Admin login requires server-verified CAPTCHA. TOTP is offered as an opt-in user security setting and, once enrolled, is required for that user's subsequent sessions.
- Bootstrap Admin creation, Admin recovery, TOTP reset, backup restore and payment/provider configuration require dual approval and immutable audit events.
- Every destructive/high-risk action has a server-generated confirmation record and step-up verification; browser hiding or UI checks are insufficient.
- Admin is the only role with `staff.identity.manage`; Manager does not receive an Admin API token or Admin page access.
- Admin API response payloads are redacted for secrets, MFA seed material, password hashes and provider keys.

## Delivery sequence

1. Implement the revised `admin` role/RBAC/API-00 hierarchy in the shared backend.
2. Build the isolated Admin frontend against Admin-specific API contracts and OpenAPI.
3. Configure DNS and the Admin deployment host for `admin.kineticsports.io.vn`.
4. Add the exact Admin origin to API CORS and deploy; do not expose it to the normal frontend configuration.
5. Provision the single bootstrap Admin through the restricted audited procedure. The user may opt in to TOTP from their security profile.
6. Run Admin UAT: Cloudflare Access denial, CAPTCHA verification, access denial from other roles, optional-TOTP enrollment/login, role hierarchy, audit events, redaction and recovery/backup drill evidence.

## Acceptance criteria

- Visiting `admin.kineticsports.io.vn` presents only the Admin authentication experience; no normal app navigation is shown.
- A non-Admin authenticated session receives 403 from every Admin API route and is redirected to an access-denied screen, without data leakage.
- Admin login cannot create a session without server-verified CAPTCHA; if the Admin has enrolled TOTP, it also cannot create a session without a valid TOTP.
- Manager cannot discover or invoke Admin actions by constructing URLs or API requests.
- High-risk Admin actions have audit evidence and required approvals before execution.
