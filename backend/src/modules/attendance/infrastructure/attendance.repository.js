import { prisma } from "../../../database.js";

export const attendanceRepository = {
  booking: (id) => prisma.bookings.findUnique({ where: { id } }),
  classSession: (id) =>
    prisma.class_sessions.findUnique({
      where: { id },
      select: { coach_user_id: true, starts_at: true, ends_at: true, pt_purchase_id: true },
    }),
  records: async (classId) => {
    const records = await prisma.attendance_records.findMany({
      where: { class_session_id: classId },
      orderBy: { recorded_at: "asc" },
    });
    const members = await prisma.members.findMany({
      where: { id: { in: records.map((record) => record.member_id) } },
      select: { id: true, full_name: true, member_code: true },
    });
    const memberById = new Map(members.map((member) => [member.id, member]));
    return records.map((record) => ({
      ...record,
      member: memberById.get(record.member_id) ?? null,
    }));
  },
  memberByUser: (userId) =>
    prisma.members.findUnique({
      where: { user_id: userId },
      select: { id: true },
    }),
  recordsForMember: (memberId) =>
    prisma.attendance_records.findMany({
      where: { member_id: memberId },
      orderBy: { recorded_at: "desc" },
    }),
  record: (id) => prisma.attendance_records.findUnique({ where: { id } }),
  upsert: async (data) => {
    const record = await prisma.attendance_records.upsert({
      where: {
        class_session_id_member_id: {
          class_session_id: data.classSessionId,
          member_id: data.memberId,
        },
      },
      create: {
        class_session_id: data.classSessionId,
        member_id: data.memberId,
        booking_id: data.bookingId,
        status: data.status,
        checked_in_at: data.checkedInAt,
        recorded_by: data.actor,
      },
      update: {
        status: data.status,
        recorded_by: data.actor,
      },
    });
    if (record.checked_in_at || !data.checkedInAt) return record;
    await prisma.attendance_records.updateMany({ where: { id: record.id, checked_in_at: null }, data: { checked_in_at: data.checkedInAt } });
    return prisma.attendance_records.findUnique({ where: { id: record.id } });
  },
  checkOut: (id, actor) =>
    prisma.attendance_records.update({
      where: { id },
      data: { checked_out_at: new Date(), recorded_by: actor },
    }),
  correct: (data) => prisma.attendance_corrections.create({ data }),
  submission: (classSessionId) => prisma.attendance_submissions.findUnique({ where: { class_session_id: classSessionId } }),
  async submit(classSessionId, entries, actorUserId) {
    try {
      return await prisma.$transaction(async (tx) => {
      const [session, bookings] = await Promise.all([
        tx.class_sessions.findUnique({ where: { id: classSessionId }, select: { id: true, name: true } }),
        tx.bookings.findMany({ where: { class_session_id: classSessionId, status: { in: ["confirmed", "attended"] } }, select: { id: true, member_id: true } }),
      ]);
      const entryByBooking = new Map(entries.map((entry) => [entry.bookingId, entry]));
      const pending = bookings.filter((booking) => !entryByBooking.has(booking.id));
      if (pending.length || entryByBooking.size !== bookings.length) return { pendingCount: pending.length || 1 };
      const existing = await tx.attendance_submissions.findUnique({ where: { class_session_id: classSessionId } });
      if (existing) return { alreadySubmitted: true, ...existing };
      const recorded = await tx.attendance_records.findMany({ where: { class_session_id: classSessionId }, select: { member_id: true, checked_in_at: true } });
      const checkInByMember = new Map(recorded.map((item) => [item.member_id, item.checked_in_at]));
      const submittedAt = new Date();
      for (const booking of bookings) {
        const entry = entryByBooking.get(booking.id);
        const checkInTime = entry.status === "absent" ? null : (checkInByMember.get(booking.member_id) ?? submittedAt);
        await tx.attendance_records.upsert({ where: { class_session_id_member_id: { class_session_id: classSessionId, member_id: booking.member_id } }, create: { class_session_id: classSessionId, member_id: booking.member_id, booking_id: booking.id, status: entry.status, checked_in_at: checkInTime, recorded_by: actorUserId }, update: { status: entry.status, checked_in_at: checkInTime, recorded_by: actorUserId } });
      }
      const submission = await tx.attendance_submissions.create({ data: { class_session_id: classSessionId, submitted_by: actorUserId } });
      const members = await tx.members.findMany({ where: { id: { in: bookings.map((booking) => booking.member_id) } }, select: { id: true, user_id: true } });
      const notifications = members.filter((member) => member.user_id).map((member) => {
        const status = entryByBooking.get(bookings.find((booking) => booking.member_id === member.id).id).status;
        const label = { present: "có mặt", absent: "vắng", late: "đi trễ" }[status] ?? "đã được ghi nhận";
        return { recipient_user_id: member.user_id, category: "member", title: "Kết quả điểm danh đã được chốt", body: `Buổi ${session.name}: bạn ${label}.`, link_path: "/my/attendance" };
      });
      if (notifications.length) await tx.notifications.createMany({ data: notifications });
      return { ...submission, notificationCount: notifications.length };
      });
    } catch (error) {
      // Two operators can pass the pre-check together. The unique submission
      // record is the final guard; make the losing request idempotent instead
      // of surfacing an unexplained database 500.
      if (error?.code === "P2002") {
        const existing = await this.submission(classSessionId);
        if (existing) return { alreadySubmitted: true, ...existing };
      }
      throw error;
    }
  },
};
