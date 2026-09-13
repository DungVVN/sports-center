import { describe, expect, it, vi } from "vitest";
import { createClassService } from "../src/modules/classes/class.service.js";

const input = { name: "Yoga sáng", type: "group", coachUserId: "coach-1", roomId: "room-1", startsAt: "2026-09-15T01:00:00.000Z", endsAt: "2026-09-15T02:00:00.000Z", capacity: 20 };

function dependencies({ room = { id: "room-1" }, coach = { id: "coach-1" } } = {}) {
  return {
    repository: { findRoom: vi.fn().mockResolvedValue(room), findCoach: vi.fn().mockResolvedValue(coach), hasScheduleConflict: vi.fn().mockResolvedValue(null), find: vi.fn().mockResolvedValue({ id: "class-1", status: "published", room_id: "room-1", coach_user_id: "coach-1", starts_at: new Date(input.startsAt), ends_at: new Date(input.endsAt) }), create: vi.fn().mockResolvedValue({ id: "class-1" }), update: vi.fn().mockResolvedValue({ id: "class-1" }), createChange: vi.fn().mockResolvedValue({ id: "change-1" }), change: vi.fn(), reviewChange: vi.fn().mockResolvedValue({ id: "change-1" }), cancelBookings: vi.fn(), notifyClassMembers: vi.fn(), notifyUser: vi.fn() },
    auditService: { record: vi.fn().mockResolvedValue(undefined) },
  };
}

describe("Class service", () => {
  it("rejects an unavailable Coach before creating a class", async () => {
    const { repository, auditService } = dependencies({ coach: null });
    await expect(createClassService({ repository, auditService }).create(input, "manager-1")).rejects.toMatchObject({ code: "COACH_NOT_AVAILABLE" });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects an end time before start time", async () => {
    const { repository, auditService } = dependencies();
    await expect(createClassService({ repository, auditService }).create({ ...input, endsAt: input.startsAt }, "manager-1")).rejects.toMatchObject({ code: "INVALID_CLASS_TIME" });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("creates a draft class with an audit entry", async () => {
    const { repository, auditService } = dependencies();
    await expect(createClassService({ repository, auditService }).create(input, "manager-1")).resolves.toEqual({ id: "class-1" });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Yoga sáng", coach_user_id: "coach-1", room_id: "room-1", capacity: 20 }));
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: "class.created", actorUserId: "manager-1" }));
  });

  it("rejects an overlapping room or Coach schedule", async () => {
    const { repository, auditService } = dependencies(); repository.hasScheduleConflict.mockResolvedValue({ id: "existing-class" });
    await expect(createClassService({ repository, auditService }).create(input, "manager-1")).rejects.toMatchObject({ code: "CLASS_SCHEDULE_CONFLICT" });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("updates schedule, room and coach after validating the referenced resources", async () => {
    const { repository, auditService } = dependencies();
    await createClassService({ repository, auditService }).update("class-1", { roomId: "room-2", coachUserId: "coach-2", startsAt: "2026-09-15T03:00:00.000Z", endsAt: "2026-09-15T04:00:00.000Z", description: "Lớp cập nhật" }, "manager-1");
    expect(repository.update).toHaveBeenCalledWith("class-1", expect.objectContaining({ room_id: "room-2", coach_user_id: "coach-2", description: "Lớp cập nhật" }));
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: "class.updated" }));
  });

  it("rejects a proposed reschedule that overlaps another class", async () => {
    const { repository, auditService } = dependencies();
    repository.hasScheduleConflict.mockResolvedValue({ id: "class-2" });
    await expect(createClassService({ repository, auditService }).requestChange("class-1", { type: "reschedule", startsAt: "2026-09-15T03:00:00.000Z", endsAt: "2026-09-15T04:00:00.000Z", reason: "Đổi lịch" }, "coach-1")).rejects.toMatchObject({ code: "CLASS_SCHEDULE_CONFLICT" });
    expect(repository.createChange).not.toHaveBeenCalled();
  });

  it("notifies the requesting Coach when a change request is rejected", async () => {
    const { repository, auditService } = dependencies();
    repository.change.mockResolvedValue({ id: "change-1", status: "pending", requested_by: "coach-1", class_session_id: "class-1", type: "cancel" });
    await createClassService({ repository, auditService }).reviewChange("change-1", false, "receptionist-1");
    expect(repository.notifyUser).toHaveBeenCalledWith("coach-1", expect.stringContaining("từ chối"), expect.any(String), "/classes/class-1");
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: "class.change_rejected" }));
  });

  it("does not approve a reschedule when the schedule becomes unavailable", async () => {
    const { repository, auditService } = dependencies();
    repository.change.mockResolvedValue({ id: "change-1", status: "pending", requested_by: "coach-1", class_session_id: "class-1", type: "reschedule", proposed_starts_at: new Date("2026-09-15T03:00:00.000Z"), proposed_ends_at: new Date("2026-09-15T04:00:00.000Z") });
    repository.hasScheduleConflict.mockResolvedValue({ id: "class-2" });
    await expect(createClassService({ repository, auditService }).reviewChange("change-1", true, "receptionist-1")).rejects.toMatchObject({ code: "CLASS_SCHEDULE_CONFLICT" });
    expect(repository.reviewChange).not.toHaveBeenCalled();
  });
});
