import { afterEach, describe, expect, it, vi } from "vitest";
import { createAssignmentService } from "../src/modules/assignments/index.js";

describe("coach assignment service", () => {
  afterEach(() => vi.useRealTimers());
  it("uses the Vietnam business date when UTC is still the previous day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T17:05:00Z"));
    const repository = { member: vi.fn().mockResolvedValue({ id: "member-1" }), coach: vi.fn().mockResolvedValue({ id: "coach-1", role: "coach", status: "active" }), assign: vi.fn().mockResolvedValue({ id: "assignment-1" }) };
    const record = vi.fn();
    const service = createAssignmentService({ repository, auditService: { record } });
    await expect(service.assign("member-1", { coachUserId: "coach-1", effectiveFrom: "2026-10-05" }, "staff-1")).rejects.toMatchObject({ code: "COACH_ASSIGNMENT_DATE_INVALID" });
    expect(repository.assign).not.toHaveBeenCalled();
    await expect(service.assign("member-1", { coachUserId: "coach-1", effectiveFrom: "2026-10-06" }, "staff-1")).resolves.toMatchObject({ id: "assignment-1" });
    expect(record).toHaveBeenCalledOnce();
  });
  it("rejects an effective date in the past", async () => {
    const repository = { member: vi.fn().mockResolvedValue({ id: "member-1" }), coach: vi.fn(), assign: vi.fn() };
    const service = createAssignmentService({ repository, auditService: { record: vi.fn() } });
    await expect(service.assign("member-1", { coachUserId: "coach-1", effectiveFrom: "2020-01-01" }, "receptionist-1")).rejects.toMatchObject({ code: "COACH_ASSIGNMENT_DATE_INVALID" });
    expect(repository.assign).not.toHaveBeenCalled();
  });
});
