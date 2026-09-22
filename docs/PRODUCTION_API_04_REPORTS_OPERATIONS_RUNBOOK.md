# API-04 — Reports, Export, Operations

## Delivered contract and controls

- `GET /api/v1/reports/revenue` reports confirmed revenue strictly from `paid_at`; pending transaction value is shown separately and never counted as revenue.
- `GET /api/v1/reports/attendance` returns attendance totals/trend and permits an optional Coach UUID filter.
- `GET /api/v1/reports/{revenue|attendance}/export` downloads UTF-8 BOM CSV using the same validated range/filter as the API view.
- Report routes require `report.read`. Manager dashboard role must equal the authenticated role; a member or Coach cannot request Manager metrics.
- `GET /api/v1/audit-logs` requires `audit.read`, pages at most 100 rows, resolves the actor and relevant entity labels, and does not expose secrets or session credentials.
- Manager UI exposes range selection, revenue/attendance summaries, CSV actions, and audit-log navigation.

## Pilot UAT

1. Log in as Manager and select a custom range. Compare paid revenue with the sum of payment records whose `paid_at` falls in the same range.
2. Create a pending PayOS payment during the range. Verify it appears in `Chờ xác nhận` but not `Thực thu`.
3. Download both CSV files, open in Excel, verify Vietnamese diacritics, date range, and totals match the UI/API response.
4. Call reports and audit log as a role without permissions; expect 403 with no aggregate data.
5. Perform a controlled action (booking cancellation, payment reconciliation, or support reply); verify actor, action, target entity and time occur in audit log.

## Acceptance evidence

Record the API request filters, exported filenames/checksums, Manager role, expected totals and one non-authorized 403 response. This group is not production-accepted until deployed role UAT is complete.
