import { randomBytes } from "node:crypto";
import { AppError } from "../../../shared/errors/app-error.js";

const output = (item) => ({ ...item, ...(item.price_vnd !== undefined && { priceVnd: item.price_vnd.toString() }), ...(item.price_vnd_snapshot !== undefined && { priceVnd: item.price_vnd_snapshot.toString() }), ...(item.course && { course: { ...item.course, priceVnd: item.course.price_vnd.toString() } }) });

export function createCourseService({ repository, classService, paymentService, auditService }) {
  async function ownMember(actor) {
    const member = await repository.memberByUser(actor.id);
    if (!member) throw new AppError({ statusCode: 404, code: "MEMBER_PROFILE_NOT_FOUND", message: "Bạn cần hồ sơ khách hàng để đăng ký dịch vụ." });
    return member;
  }
  return {
    async publicCatalog() {
      await repository.expireHolds();
      const courses = await repository.list(false);
      return courses.filter((course) => course.sessions.length && course.sessions.every((session) => session.status === "published" && session.starts_at > new Date())).map((course) => ({
        id: course.id, name: course.name, description: course.description, priceVnd: course.price_vnd.toString(),
        capacity: course.capacity, availableSeats: Math.max(0, course.capacity - course.reservedSeats),
        sessions: course.sessions.map((session) => ({ name: session.name, startsAt: session.starts_at, endsAt: session.ends_at })),
      }));
    },
    async list(actor) { await repository.expireHolds(); return (await repository.list(["admin", "manager", "receptionist"].includes(actor.role))).map(output); },
    async create(input, actor) {
      const result = await repository.create({ code: `COURSE-${randomBytes(6).toString("hex").toUpperCase()}`, name: input.name, description: input.description ?? null, price_vnd: BigInt(input.priceVnd), capacity: input.capacity, payment_hold_minutes: input.paymentHoldMinutes ?? 60, created_by: actor.id });
      await auditService.record({ actorUserId: actor.id, action: "course.created", entityType: "course", entityId: result.id, summary: "Đã tạo khóa học nháp." });
      return output(result);
    },
    async addSession(id, input, actor) {
      const course = await repository.find(id);
      if (!course || course.status !== "draft") throw new AppError({ statusCode: 422, code: "COURSE_NOT_EDITABLE", message: "Chỉ bổ sung buổi cho khóa nháp." });
      return classService.create({ ...input, name: input.name ?? course.name, type: "group", capacity: course.capacity, courseId: id }, actor.id);
    },
    async publish(id, actor) { return output(await repository.publish(id, actor.id)); },
    async complete(id, actor) { return output(await repository.complete(id, actor.id)); },
    async mine(actor) { await repository.expireHolds(); return (await repository.enrollments((await ownMember(actor)).id)).map(output); },
    async enrollments() { return (await repository.enrollments()).map(output); },
    async enroll(id, actor) { await repository.expireHolds(); return output(await repository.enroll(id, (await ownMember(actor)).id, actor.id)); },
    async cancel(id, actor) { return output(await repository.cancelPending(id, (await ownMember(actor)).id, actor.id)); },
    async payment(id, input, actor) {
      const member = await ownMember(actor);
      const enrollment = await repository.enrollment(id);
      if (!enrollment || enrollment.member_id !== member.id) throw new AppError({ statusCode: 404, code: "COURSE_ENROLLMENT_NOT_FOUND", message: "Không tìm thấy đăng ký của bạn." });
      if (enrollment.status !== "pending_payment" || enrollment.payment_expires_at && enrollment.payment_expires_at <= new Date()) throw new AppError({ statusCode: 422, code: "COURSE_PAYMENT_NOT_ELIGIBLE", message: "Đăng ký đã hết hạn giữ chỗ hoặc không còn chờ thanh toán." });
      const existing = await repository.openPayment(id);
      if (existing) return paymentService.get(existing.id);
      return paymentService.create({ memberId: member.id, courseEnrollmentId: id, amountVnd: enrollment.price_vnd_snapshot.toString(), method: input.method, ...(input.method === "online" && { provider: "payos" }) }, actor.id);
    },
  };
}
