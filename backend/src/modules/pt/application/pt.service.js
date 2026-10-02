import { AppError } from "../../../shared/errors/app-error.js";
const output = (item) => ({ ...item, priceVnd: (item.price_vnd ?? item.price_vnd_snapshot).toString() });
export function createPtService({ repository, paymentService, auditService }) {
  async function member(actor) {
    const profile = await repository.memberByUser(actor.id);
    if (!profile) throw new AppError({ statusCode: 404, code: "MEMBER_PROFILE_NOT_FOUND", message: "Bạn cần hồ sơ khách hàng để mua PT." });
    return profile;
  }
  return {
    async publicCatalog() { return (await repository.packages(false)).map((item) => ({ id: item.id, name: item.name, description: item.description, priceVnd: item.price_vnd.toString(), sessionCount: item.session_count, durationDays: item.duration_days, sessionMinutes: item.session_minutes, cancellationHours: item.cancellation_hours })); },
    async packages(actor) { return (await repository.packages(["admin", "receptionist", "manager"].includes(actor.role))).map(output); },
    async create(input, actor) {
      const result = await repository.createPackage({ name: input.name, description: input.description ?? null, price_vnd: BigInt(input.priceVnd), session_count: input.sessionCount, duration_days: input.durationDays, session_minutes: input.sessionMinutes, cancellation_hours: input.cancellationHours, created_by: actor.id });
      await auditService.record({ actorUserId: actor.id, action: "pt.package_created", entityType: "pt_package", entityId: result.id, summary: "Đã tạo gói PT." });
      return output(result);
    },
    async purchases(actor) { return (await repository.list(actor)).map(output); },
    async buy(id, actor) { return output(await repository.buy(id, (await member(actor)).id, actor)); },
    async cancelPurchase(id, actor) { return output(await repository.cancelPurchase(id, actor)); },
    async setPackageActive(id, isActive, actor) { return output(await repository.setPackageActive(id, isActive, actor)); },
    resources: () => repository.resources(),
    async assign(id, coachId, actor) { return output(await repository.assign(id, coachId, actor)); },
    async book(id, input, actor) {
      try { return await repository.book(id, input, actor); }
      catch (error) {
        if (/class_schedule_conflict_guard|Coach or room already has an overlapping class|Physical room is already occupied by a rental/.test(error.message)) throw new AppError({ statusCode: 422, code: "PT_SCHEDULE_CONFLICT", message: "Coach hoặc phòng đã có lịch trong khung giờ này." });
        throw error;
      }
    },
    cancel: (id, reason, actor) => repository.finish(id, { status: "cancelled", reason }, actor),
    complete: (id, input, actor) => repository.finish(id, input, actor),
    async payment(id, input, actor) {
      const profile = await member(actor);
      const purchase = await repository.purchase(id);
      if (!purchase || purchase.member_id !== profile.id) throw new AppError({ statusCode: 404, code: "PT_NOT_FOUND", message: "Không tìm thấy gói PT của bạn." });
      const existing = await repository.openPayment(id);
      if (existing) return paymentService.get(existing.id);
      return paymentService.create({ memberId: profile.id, ptPurchaseId: id, amountVnd: purchase.price_vnd_snapshot.toString(), method: input.method, ...(input.method === "online" && { provider: "payos" }) }, actor.id);
    },
  };
}
