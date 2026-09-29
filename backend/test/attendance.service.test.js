import { describe, expect, it, vi } from "vitest";
import { createAttendanceService } from "../src/modules/attendance/index.js";

const coach = { id: "coach-1", role: "coach" };
const admin = { id: "admin-1", role: "admin" };
const activeSession = () => ({
  coach_user_id: coach.id,
  starts_at: new Date(Date.now() - 60_000),
  ends_at: new Date(Date.now() + 60_000),
});

describe("attendance time rules", () => {
  it("allows check-in only while the assigned class is in progress", async () => {
    const repository = {
      booking: vi
        .fn()
        .mockResolvedValue({
          id: "booking-1",
          status: "confirmed",
          class_session_id: "class-1",
          member_id: "member-1",
        }),
      classSession: vi.fn().mockResolvedValue(activeSession()),
      upsert: vi.fn().mockResolvedValue({ id: "attendance-1" }),
    };
    const service = createAttendanceService({
      repository,
      auditService: { record: vi.fn() },
    });

    await expect(service.checkIn("booking-1", coach)).resolves.toEqual({
      id: "attendance-1",
    });
    expect(repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "present" }),
    );
  });

  it("rejects check-in before or after the class time window", async () => {
    const repository = {
      booking: vi
        .fn()
        .mockResolvedValue({
          id: "booking-1",
          status: "confirmed",
          class_session_id: "class-1",
          member_id: "member-1",
        }),
      classSession: vi
        .fn()
        .mockResolvedValue({
          coach_user_id: coach.id,
          starts_at: new Date(Date.now() + 60_000),
          ends_at: new Date(Date.now() + 120_000),
        }),
      upsert: vi.fn(),
    };
    const service = createAttendanceService({
      repository,
      auditService: { record: vi.fn() },
    });

    await expect(service.checkIn("booking-1", coach)).rejects.toMatchObject({
      code: "ATTENDANCE_OUTSIDE_SESSION",
    });
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it("submits one completed class and sends member notifications once", async () => {
    const repository = { classSession: vi.fn().mockResolvedValue(activeSession()), submit: vi.fn().mockResolvedValue({ id: "submission-1", notificationCount: 2 }) };
    const auditService = { record: vi.fn() };
    const service = createAttendanceService({ repository, auditService });

    await expect(service.submit("class-1", [{ bookingId: "booking-1", status: "present" }], coach)).resolves.toMatchObject({ notificationCount: 2 });
    expect(repository.submit).toHaveBeenCalledWith("class-1", [{ bookingId: "booking-1", status: "present" }], coach.id);
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: "attendance.submitted" }));
  });

  it("lets Admin submit attendance for another Coach's class while retaining the session window", async () => {
    const repository = { classSession: vi.fn().mockResolvedValue(activeSession()), submit: vi.fn().mockResolvedValue({ id: "submission-1", pendingCount: 0 }) };
    const service = createAttendanceService({ repository, auditService: { record: vi.fn() } });
    await expect(service.submit("class-1", [{ bookingId: "booking-1", status: "present" }], admin)).resolves.toMatchObject({ id: "submission-1" });
    expect(repository.submit).toHaveBeenCalledWith("class-1", expect.any(Array), admin.id);
  });

  it("lets an authorized Receptionist submit while retaining session-time checks", async () => {
    const repository = { classSession: vi.fn().mockResolvedValue(activeSession()), submit: vi.fn().mockResolvedValue({ pendingCount: 0, alreadySubmitted: true }) };
    const service = createAttendanceService({ repository, auditService: { record: vi.fn() } });
    await expect(service.submit("class-1", [], { id: "receptionist-1", role: "receptionist" })).resolves.toMatchObject({ pendingCount: 0 });
    expect(repository.submit).toHaveBeenCalled();
  });

  it("rejects a submission while a member is still unmarked", async () => {
    const repository = { classSession: vi.fn().mockResolvedValue(activeSession()), submit: vi.fn().mockResolvedValue({ pendingCount: 1 }) };
    const service = createAttendanceService({ repository, auditService: { record: vi.fn() } });

    await expect(service.submit("class-1", [{ bookingId: "booking-1", status: "present" }], coach)).rejects.toMatchObject({ code: "ATTENDANCE_NOT_COMPLETE" });
  });

  it("does not require a correction reason while the class is in progress", async () => {
    const repository = {
      record: vi
        .fn()
        .mockResolvedValue({
          id: "attendance-1",
          class_session_id: "class-1",
          member_id: "member-1",
          booking_id: "booking-1",
          status: "present",
          checked_in_at: new Date(),
        }),
      classSession: vi.fn().mockResolvedValue(activeSession()),
      correct: vi.fn().mockResolvedValue({ id: "correction-1" }),
      upsert: vi.fn().mockResolvedValue({ id: "attendance-1", status: "late" }),
    };
    const service = createAttendanceService({
      repository,
      auditService: { record: vi.fn() },
    });

    await expect(
      service.correct("attendance-1", "late", undefined, coach),
    ).resolves.toMatchObject({ status: "late" });
    expect(repository.correct).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "Điều chỉnh trong thời gian buổi học.",
      }),
    );
  });

  it("requires a correction reason after the class ends", async () => {
    const repository = {
      record: vi
        .fn()
        .mockResolvedValue({
          id: "attendance-1",
          class_session_id: "class-1",
          member_id: "member-1",
          booking_id: "booking-1",
          status: "present",
          checked_in_at: new Date(),
        }),
      classSession: vi
        .fn()
        .mockResolvedValue({
          coach_user_id: coach.id,
          starts_at: new Date(Date.now() - 120_000),
          ends_at: new Date(Date.now() - 60_000),
        }),
      correct: vi.fn(),
      upsert: vi.fn(),
    };
    const service = createAttendanceService({
      repository,
      auditService: { record: vi.fn() },
    });

    await expect(
      service.correct("attendance-1", "late", undefined, coach),
    ).rejects.toMatchObject({ code: "ATTENDANCE_CORRECTION_REASON_REQUIRED" });
    expect(repository.correct).not.toHaveBeenCalled();
  });

  it("accepts the Coach default reason after the class ends", async () => {
    const repository = {
      record: vi.fn().mockResolvedValue({ id: "attendance-1", class_session_id: "class-1", member_id: "member-1", booking_id: "booking-1", status: "present", checked_in_at: new Date() }),
      classSession: vi.fn().mockResolvedValue({ coach_user_id: coach.id, starts_at: new Date(Date.now() - 120_000), ends_at: new Date(Date.now() - 60_000) }),
      correct: vi.fn().mockResolvedValue({ id: "correction-1" }),
      upsert: vi.fn().mockResolvedValue({ id: "attendance-1", status: "late" }),
    };
    const auditService = { record: vi.fn() };
    const service = createAttendanceService({ repository, auditService });

    await expect(service.correct("attendance-1", "late", "Điều chỉnh điểm danh", coach)).resolves.toMatchObject({ status: "late" });
    expect(repository.correct).toHaveBeenCalledWith(expect.objectContaining({ reason: "Điều chỉnh điểm danh" }));
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({ reason: "Điều chỉnh điểm danh" }));
  });
});
