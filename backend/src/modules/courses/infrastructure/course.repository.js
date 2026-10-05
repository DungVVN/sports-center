import { randomUUID } from "node:crypto";
import { prisma } from "../../../database.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { expireCourseHolds } from "./course-hold.repository.js";

const unavailable = () =>
  new AppError({ statusCode: 422, code: "COURSE_UNAVAILABLE", message: "Khóa học chưa mở đăng ký hoặc đã bắt đầu." });
const conflict = (code, message) => new AppError({ statusCode: 409, code, message });

async function availableSessions(tx, courseId) {
  await tx.$queryRaw`SELECT id FROM class_sessions WHERE course_id = ${courseId}::uuid ORDER BY id FOR UPDATE`;
  const sessions = await tx.class_sessions.findMany({ where: { course_id: courseId }, orderBy: { id: "asc" } });
  if (!sessions.length || sessions.some((session) => session.status !== "published" || session.starts_at <= new Date()))
    throw unavailable();
  return sessions;
}

async function reserveSessionBookings(tx, enrollment, actorUserId, sessions) {
  for (const session of sessions) {
    await tx.bookings.create({
      data: {
        booking_code: `CRS-${randomUUID()}`,
        member_id: enrollment.member_id,
        class_session_id: session.id,
        status: "confirmed",
        booked_by: actorUserId,
      },
    });
  }
}

export async function activateCourseEnrollment(tx, payment) {
  await tx.$queryRaw`SELECT id FROM course_enrollments WHERE id = ${payment.course_enrollment_id}::uuid FOR UPDATE`;
  const enrollment = await tx.course_enrollments.findUnique({ where: { id: payment.course_enrollment_id } });
  if (
    !enrollment ||
    enrollment.status !== "pending_payment" ||
    (enrollment.payment_expires_at && enrollment.payment_expires_at <= new Date()) ||
    enrollment.member_id !== payment.member_id ||
    enrollment.price_vnd_snapshot !== payment.amount_vnd
  ) {
    throw conflict("COURSE_PAYMENT_NOT_ELIGIBLE", "Đăng ký khóa không còn chờ thanh toán hoặc số tiền không khớp.");
  }
  const sessions = await availableSessions(tx, enrollment.course_id);
  const active = await tx.course_enrollments.update({
    where: { id: enrollment.id },
    data: { status: "active", activated_at: new Date(), activation_payment_id: payment.id },
  });
  await reserveSessionBookings(tx, active, payment.recorded_by, sessions);
  const member = await tx.members.findUnique({ where: { id: active.member_id } });
  if (member?.user_id)
    await tx.notifications.create({
      data: {
        recipient_user_id: member.user_id,
        category: "finance",
        title: "Đã kích hoạt khóa học",
        body: "Thanh toán đã được xác nhận. Các buổi của khóa đã có trong lịch của bạn.",
        link_path: "/my/services",
      },
    });
}

export const courseRepository = {
  expireHolds: expireCourseHolds,
  find: (id) => prisma.courses.findUnique({ where: { id } }),
  sessions: (courseId) =>
    prisma.class_sessions.findMany({ where: { course_id: courseId }, orderBy: { starts_at: "asc" } }),
  memberByUser: (userId) => prisma.members.findUnique({ where: { user_id: userId } }),
  openPayment: (id) =>
    prisma.payments.findFirst({ where: { course_enrollment_id: id, status: { in: ["pending", "paid"] } } }),
  enrollment: (id) => prisma.course_enrollments.findUnique({ where: { id } }),
  async list(staff) {
    const courses = await prisma.courses.findMany({
      where: staff ? undefined : { status: "published" },
      orderBy: { created_at: "desc" },
    });
    const ids = courses.map((course) => course.id);
    const [sessions, reservations] = await Promise.all([
      prisma.class_sessions.findMany({ where: { course_id: { in: ids } }, orderBy: { starts_at: "asc" } }),
      prisma.course_enrollments.groupBy({
        by: ["course_id"],
        where: { course_id: { in: ids }, status: { not: "cancelled" } },
        _count: { id: true },
      }),
    ]);
    const counts = new Map(reservations.map((item) => [item.course_id, item._count.id]));
    const sessionsByCourse = new Map();
    for (const session of sessions) {
      if (!sessionsByCourse.has(session.course_id)) sessionsByCourse.set(session.course_id, []);
      sessionsByCourse.get(session.course_id).push(session);
    }
    return courses.map((course) => ({
      ...course,
      sessions: sessionsByCourse.get(course.id) ?? [],
      reservedSeats: counts.get(course.id) ?? 0,
    }));
  },
  async enrollments(memberId) {
    const enrollments = await prisma.course_enrollments.findMany({
      where: memberId ? { member_id: memberId } : undefined,
      orderBy: { enrolled_at: "desc" },
    });
    const courses = await prisma.courses.findMany({ where: { id: { in: enrollments.map((item) => item.course_id) } } });
    const byId = new Map(courses.map((course) => [course.id, course]));
    return enrollments.map((item) => ({ ...item, course: byId.get(item.course_id) }));
  },
  create: (data) => prisma.courses.create({ data }),
  async complete(id, actorUserId) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM courses WHERE id=${id}::uuid FOR UPDATE`;
      const course = await tx.courses.findUnique({ where: { id } });
      if (!course || course.status !== "published")
        throw conflict("COURSE_NOT_COMPLETABLE", "Khóa không còn ở trạng thái đang triển khai.");
      await tx.$queryRaw`SELECT id FROM class_sessions WHERE course_id=${id}::uuid ORDER BY id FOR UPDATE`;
      const sessions = await tx.class_sessions.findMany({ where: { course_id: id } });
      if (
        !sessions.length ||
        sessions.some((item) => item.ends_at > new Date() || !["completed", "cancelled"].includes(item.status))
      )
        throw conflict("COURSE_SESSIONS_NOT_FINAL", "Cần kết thúc hoặc xử lý hủy toàn bộ buổi trước khi chốt khóa.");
      if (await tx.course_enrollments.count({ where: { course_id: id, status: "pending_payment" } }))
        throw conflict("COURSE_PENDING_ENROLLMENTS", "Cần xử lý đăng ký chờ thanh toán trước khi chốt khóa.");
      const enrollments = await tx.course_enrollments.findMany({ where: { course_id: id, status: "active" } });
      const result = await tx.courses.update({ where: { id }, data: { status: "completed" } });
      await tx.course_enrollments.updateMany({
        where: { course_id: id, status: "active" },
        data: { status: "completed" },
      });
      const members = await tx.members.findMany({
        where: { id: { in: enrollments.map((item) => item.member_id) }, user_id: { not: null } },
        select: { user_id: true },
      });
      if (members.length)
        await tx.notifications.createMany({
          data: members.map((member) => ({
            recipient_user_id: member.user_id,
            category: "operations",
            title: "Khóa đã kết thúc",
            body: `Trung tâm đã chốt khóa ${course.name}. Lịch sử học và điểm danh vẫn được lưu.`,
            link_path: "/my/services",
          })),
        });
      await tx.audit_logs.create({
        data: {
          actor_user_id: actorUserId,
          action: "course.completed",
          entity_type: "course",
          entity_id: id,
          summary: "Đã chốt khóa và các đăng ký đang sử dụng.",
        },
      });
      return result;
    });
  },
  async publish(id, actorUserId) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM courses WHERE id = ${id}::uuid FOR UPDATE`;
      const course = await tx.courses.findUnique({ where: { id } });
      if (!course || course.status !== "draft") throw unavailable();
      const sessions = await tx.class_sessions.findMany({ where: { course_id: id }, orderBy: { id: "asc" } });
      if (
        !sessions.length ||
        sessions.some(
          (session) =>
            session.status !== "draft" || session.starts_at <= new Date() || session.capacity < course.capacity,
        )
      )
        throw unavailable();
      const [rooms, coaches] = await Promise.all([
        tx.rooms.findMany({ where: { id: { in: sessions.map((item) => item.room_id) }, is_active: true } }),
        tx.users.findMany({
          where: { id: { in: sessions.map((item) => item.coach_user_id) }, role: "coach", status: "active" },
          select: { id: true },
        }),
      ]);
      const roomById = new Map(rooms.map((room) => [room.id, room]));
      const coachIds = new Set(coaches.map((coach) => coach.id));
      if (
        sessions.some(
          (item) =>
            !coachIds.has(item.coach_user_id) ||
            !roomById.has(item.room_id) ||
            item.capacity > roomById.get(item.room_id).capacity,
        )
      )
        throw unavailable();
      for (const session of sessions)
        await tx.class_sessions.update({ where: { id: session.id }, data: { status: "published" } });
      const result = await tx.courses.update({ where: { id }, data: { status: "published" } });
      await tx.audit_logs.create({
        data: {
          actor_user_id: actorUserId,
          action: "course.published",
          entity_type: "course",
          entity_id: id,
          summary: "Đã công bố khóa và toàn bộ lịch học.",
        },
      });
      return result;
    });
  },
  async enroll(courseId, memberId, actorUserId) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM courses WHERE id = ${courseId}::uuid FOR UPDATE`;
      const course = await tx.courses.findUnique({ where: { id: courseId } });
      if (!course || course.status !== "published") throw unavailable();
      const existing = await tx.course_enrollments.findFirst({
        where: { course_id: courseId, member_id: memberId, status: { not: "cancelled" } },
      });
      if (existing) throw conflict("COURSE_ALREADY_ENROLLED", "Bạn đã có đăng ký còn hiệu lực cho khóa này.");
      const occupied = await tx.course_enrollments.count({
        where: { course_id: courseId, status: { not: "cancelled" } },
      });
      if (occupied >= course.capacity)
        throw conflict("COURSE_FULL", "Khóa đã đủ chỗ, bao gồm đăng ký đang chờ thanh toán.");
      const sessions = await availableSessions(tx, courseId);
      const free = course.price_vnd === 0n;
      const enrollment = await tx.course_enrollments.create({
        data: {
          course_id: courseId,
          member_id: memberId,
          price_vnd_snapshot: course.price_vnd,
          status: free ? "active" : "pending_payment",
          ...(free && { activated_at: new Date() }),
        },
      });
      if (free) await reserveSessionBookings(tx, enrollment, actorUserId, sessions);
      await tx.audit_logs.create({
        data: {
          actor_user_id: actorUserId,
          action: "course.enrolled",
          entity_type: "course_enrollment",
          entity_id: enrollment.id,
          summary: free ? "Đã đăng ký và kích hoạt khóa miễn phí." : "Đã giữ chỗ khóa, chờ thanh toán.",
        },
      });
      return enrollment;
    });
  },
  async cancelPending(id, memberId, actorUserId) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM course_enrollments WHERE id = ${id}::uuid FOR UPDATE`;
      const enrollment = await tx.course_enrollments.findUnique({ where: { id } });
      if (!enrollment || enrollment.member_id !== memberId)
        throw new AppError({
          statusCode: 404,
          code: "COURSE_ENROLLMENT_NOT_FOUND",
          message: "Không tìm thấy đăng ký của bạn.",
        });
      if (
        enrollment.status !== "pending_payment" ||
        (await tx.payments.count({ where: { course_enrollment_id: id, status: { in: ["pending", "paid"] } } }))
      ) {
        throw conflict(
          "COURSE_ENROLLMENT_NOT_CANCELLABLE",
          "Chỉ hủy đăng ký chưa có giao dịch đang xử lý hoặc đã thanh toán. Liên hệ trung tâm để xử lý giao dịch.",
        );
      }
      const result = await tx.course_enrollments.update({
        where: { id },
        data: { status: "cancelled", cancelled_at: new Date() },
      });
      await tx.audit_logs.create({
        data: {
          actor_user_id: actorUserId,
          action: "course.enrollment_cancelled",
          entity_type: "course_enrollment",
          entity_id: id,
          summary: "Đã hủy đăng ký chưa thanh toán và trả chỗ khóa.",
        },
      });
      return result;
    });
  },
};
