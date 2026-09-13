import { prisma } from "../../database.js";

export const attendanceRepository = {
  booking: (id) => prisma.bookings.findUnique({ where: { id } }),
  classSession: (id) => prisma.class_sessions.findUnique({ where: { id }, select: { coach_user_id: true } }),
  records: (classId) => prisma.attendance_records.findMany({ where: { class_session_id: classId }, orderBy: { recorded_at: "asc" } }),
  record: (id) => prisma.attendance_records.findUnique({ where: { id } }),
  upsert: (data) => prisma.attendance_records.upsert({
    where: { class_session_id_member_id: { class_session_id: data.classSessionId, member_id: data.memberId } },
    create: { class_session_id: data.classSessionId, member_id: data.memberId, booking_id: data.bookingId, status: data.status, checked_in_at: data.checkedInAt, recorded_by: data.actor },
    update: { status: data.status, checked_in_at: data.checkedInAt, recorded_by: data.actor },
  }),
  checkOut: (id, actor) => prisma.attendance_records.update({
    where: { id },
    data: { checked_out_at: new Date(), recorded_by: actor },
  }),
  correct: (data) => prisma.attendance_corrections.create({ data }),
};
