# API-02 Production runbook: Classes, bookings, attendance and waitlist

## Pilot scope

- Manager/Receptionist creates a draft class, assigns an active room and Coach, then publishes only after the schedule is conflict-free.
- A Member may book only a published future class when their membership is active at the class start and includes the resolved `group_class_booking` entitlement.
- Capacity is decided by the backend transaction. A full class places the next eligible booking on the waitlist in booking-time order.
- Cancelling a confirmed booking promotes the earliest waitlisted Member who remains eligible. The promotion creates an in-app notification.
- Only the assigned Coach can check in, submit attendance or correct attendance for their own class. A correction after the class has begun needs an audit reason; an after-session correction is rejected without one.

## Deployment and UAT sequence

1. Confirm the backend and database are on the intended release; run migrations with the approved `MIGRATE_DATABASE_URL` only after a backup has completed.
2. Seed or create one Coach, one room and three Members: two eligible Members and one Member without a booking entitlement.
3. Create a future class with capacity `1`, publish it, and verify that a room/Coach scheduling conflict is rejected.
4. Book the two eligible Members concurrently or in quick succession. Verify exactly one `confirmed` booking and one `waitlisted` booking; the ineligible Member must be rejected.
5. Cancel the confirmed booking as the Member or Receptionist. Verify exactly one eligible waitlisted booking is promoted and receives the notification; repeat cancellation/retry without a second promotion.
6. During the class window, sign in as its assigned Coach, check in the confirmed booking and submit a complete attendance list. Verify the Member history and notification.
7. Attempt the same attendance action as a different Coach and outside the class window; both must be rejected. After the session, attempt a correction without a reason (reject), then with a reason (success with immutable correction/audit record).
8. Capture API/browser evidence for capacity, waitlist order, promotion, Coach scope and attendance correction. Do not treat static tests as pilot UAT proof.

## Acceptance criteria

- No over-capacity confirmed booking under concurrent requests.
- Waitlist promotion is ordered, eligibility-checked, idempotent and visible to the promoted Member.
- A Member cannot see or alter another Member's booking; a Coach cannot access another Coach's attendance roster.
- A class cannot be booked before publication, after it starts, or without an eligible membership entitlement.
- Attendance is restricted to the session window and assigned Coach; corrections preserve a reasoned audit trail.
