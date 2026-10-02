import { describe, expect, it } from "vitest";
import { upcomingSchedule } from "./upcoming-schedule.js";

describe("upcoming schedule", () => {
  it("uses the assigned facility slot in Vietnam time when it differs from the requested slot", () => {
    const events = upcomingSchedule([], [{
      id: "field", status: "approved", facilityName: "Sân bóng", date: "2026-10-03",
      requestedStartMinute: 480, requestedEndMinute: 540,
      assignedStartMinute: 600, assignedEndMinute: 660, cancellationPending: true,
    }], Date.parse("2026-10-03T02:00:00Z"));
    expect(events).toHaveLength(1);
    expect(events[0].startsAt).toBe(Date.parse("2026-10-03T03:00:00Z"));
    expect(events[0].time).toContain("10:00–11:00");
    expect(events[0].detail).toContain("Có yêu cầu xác nhận hủy");
  });

  it("excludes events at or before now and preserves the waitlist warning", () => {
    const session = { name: "Yoga", starts_at: "2026-10-03T01:00:00Z" };
    const events = upcomingSchedule([
      { id: "started", status: "confirmed", class_session: session },
      { id: "waiting", status: "waitlisted", class_session: { ...session, starts_at: "2026-10-03T02:00:00Z" } },
      { id: "missing", status: "confirmed", class_session: null },
    ], [], Date.parse(session.starts_at));
    expect(events.map((event) => event.id)).toEqual(["class-waiting"]);
    expect(events[0].detail).toContain("chưa được xác nhận");
  });
});
