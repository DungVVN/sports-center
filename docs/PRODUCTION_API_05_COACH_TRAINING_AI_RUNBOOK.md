# API-05 — Coach Training and Reviewed AI Drafts

## Safety boundary

- The assistant produces operational reminders only from classes, bookings, unsubmitted attendance, stale plans and expiring memberships.
- It does not diagnose, prescribe, or automatically contact any member.
- Only a Coach can view drafts; the Coach must select an in-scope member, edit/review title and content, then explicitly submit the delivery.
- The server checks Coach scope again at delivery, persists the reviewed delivery, creates a member notification, and writes `ai_suggestion.delivered` to audit log.

## Pilot UAT

1. Log in as Coach and confirm drafts are explicitly labelled `cần Coach duyệt trước khi gửi`.
2. Attempt to call suggestion or delivery endpoints as a Member or Receptionist; expect 403.
3. Edit a draft and send it to an assigned/in-class member. Confirm the member receives one in-app notification and, if enabled, one email through API-03 worker.
4. Attempt the same delivery to an out-of-scope member; expect `AI_ASSIST_MEMBER_SCOPE_DENIED` and no delivery/notification row.
5. Verify the resulting audit event identifies the Coach and delivery record, while no API key, prompt secret or health data is stored in audit data.

This AI is a reviewed operational drafting aid for the pilot, not an autonomous agent or health-advice function.
