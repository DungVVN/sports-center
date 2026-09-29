import { describe, expect, it, vi } from "vitest";
import { createAssignmentService } from "../src/modules/assignments/index.js";

describe("coach assignment service", () => {
  it("rejects an effective date in the past", async () => {
    const repository = { member: vi.fn().mockResolvedValue({ id: "member-1" }), coach: vi.fn(), assign: vi.fn() };
    const service = createAssignmentService({ repository, auditService: { record: vi.fn() } });
    await expect(service.assign("member-1", { coachUserId: "coach-1", effectiveFrom: "2020-01-01" }, "receptionist-1")).rejects.toMatchObject({ code: "COACH_ASSIGNMENT_DATE_INVALID" });
    expect(repository.assign).not.toHaveBeenCalled();
  });
});
