import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createCourseService } from "../src/modules/courses/index.js";

const id = "11111111-1111-4111-8111-111111111111";
const actor = { id: "member-user", role: "member" };
const authService = (permissions) => ({ getAuthentication: vi.fn().mockResolvedValue({ user: actor, permissions }) });

describe("course service boundaries", () => {
  it("blocks opening an expired checkout before a background job cancels the enrollment", async () => {
    const repository = { memberByUser: vi.fn().mockResolvedValue({ id: "my-member" }), enrollment: vi.fn().mockResolvedValue({ member_id: "my-member", status: "pending_payment", payment_expires_at: new Date(0) }), openPayment: vi.fn() };
    await expect(createCourseService({ repository }).payment(id, { method: "bank_transfer" }, actor)).rejects.toMatchObject({ code: "COURSE_PAYMENT_NOT_ELIGIBLE" });
    expect(repository.openPayment).not.toHaveBeenCalled();
  });
  it("does not let a customer pay another customer's enrollment", async () => {
    const repository = { memberByUser: vi.fn().mockResolvedValue({ id: "my-member" }), enrollment: vi.fn().mockResolvedValue({ member_id: "other-member", price_vnd_snapshot: 100n }) };
    const paymentService = { create: vi.fn() };
    const service = createCourseService({ repository, paymentService });
    await expect(service.payment(id, { method: "online" }, actor)).rejects.toMatchObject({ code: "COURSE_ENROLLMENT_NOT_FOUND", statusCode: 404 });
    expect(paymentService.create).not.toHaveBeenCalled();
  });
  it("uses the stored price and authenticated owner rather than a client supplied price/member", async () => {
    const repository = { memberByUser: vi.fn().mockResolvedValue({ id: "my-member" }), openPayment: vi.fn().mockResolvedValue(null), enrollment: vi.fn().mockResolvedValue({ member_id: "my-member", status: "pending_payment", price_vnd_snapshot: 500000n }) };
    const paymentService = { create: vi.fn().mockResolvedValue({ id: "payment" }) };
    await createCourseService({ repository, paymentService }).payment(id, { method: "online", amountVnd: "1", memberId: "other" }, actor);
    expect(paymentService.create).toHaveBeenCalledWith({ memberId: "my-member", courseEnrollmentId: id, amountVnd: "500000", method: "online", provider: "payos" }, actor.id);
  });
  it("does not allow adding a session to a published course", async () => {
    const repository = { find: vi.fn().mockResolvedValue({ status: "published" }) };
    const classService = { create: vi.fn() };
    await expect(createCourseService({ repository, classService }).addSession(id, {}, actor)).rejects.toMatchObject({ code: "COURSE_NOT_EDITABLE" });
    expect(classService.create).not.toHaveBeenCalled();
  });
  it("recovers an existing payment instead of creating another invoice", async () => {
    const repository = { memberByUser: vi.fn().mockResolvedValue({ id: "my-member" }), enrollment: vi.fn().mockResolvedValue({ member_id: "my-member", status: "pending_payment" }), openPayment: vi.fn().mockResolvedValue({ id: "existing" }) };
    const paymentService = { create: vi.fn(), get: vi.fn().mockResolvedValue({ id: "existing", checkoutUrl: "https://pay.payos.vn/example" }) };
    await expect(createCourseService({ repository, paymentService }).payment(id, { method: "online" }, actor)).resolves.toMatchObject({ id: "existing" });
    expect(paymentService.create).not.toHaveBeenCalled();
  });
});

describe("course route permissions", () => {
  it("does not expose all enrollments to a self-service customer", async () => {
    const courseService = { enrollments: vi.fn() };
    await request(createApp({ authService: authService(["course.enroll"]), courseService })).get("/api/v1/course-enrollments").set("Authorization", "Bearer test").expect(403);
    expect(courseService.enrollments).not.toHaveBeenCalled();
  });
  it("passes the authenticated user for self enrollment without accepting a member id", async () => {
    const courseService = { enroll: vi.fn().mockResolvedValue({ id: "enrollment" }) };
    await request(createApp({ authService: authService(["course.enroll"]), courseService })).post(`/api/v1/courses/${id}/enroll`).set("Authorization", "Bearer test").send({ memberId: "other" }).expect(201);
    expect(courseService.enroll).toHaveBeenCalledWith(id, actor);
  });
  it("rejects invalid payment methods before calling the payment service", async () => {
    const courseService = { payment: vi.fn() };
    await request(createApp({ authService: authService(["course.enroll"]), courseService })).post(`/api/v1/course-enrollments/${id}/payment`).set("Authorization", "Bearer test").send({ method: "cash" }).expect(422);
    expect(courseService.payment).not.toHaveBeenCalled();
  });
});
