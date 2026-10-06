import { randomUUID, randomInt } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "../src/database.js";
import { withRuntime } from "../src/shared/runtime/request-context.js";
import { paymentRepository } from "../src/modules/payments/index.js";
import { createPaymentService } from "../src/modules/payments/application/payment.service.js";
import { bookingRepository } from "../src/modules/bookings/index.js";
import { memberRepository } from "../src/modules/members/index.js";
import { authRepository } from "../src/modules/auth/index.js";
import { Client } from "pg";
import { readBusinessManifest, verifyBusinessManifest } from "../scripts/backup-manifest.js";

const configuredUrl = process.env.OPERATIONS_TEST_DATABASE_URL;
describe.skipIf(!configuredUrl)("operations PostgreSQL regression", () => {
  let client;
  const suffix = randomUUID().slice(0, 8);
  const ids = Array.from({ length: 4 }, () => randomUUID());
  let members = [];
  const pageMembers = Array.from({ length: 101 }, (_, index) => ({ id: randomUUID(), member_code: `PAGE-${suffix}-${index}`, full_name: `Page ${suffix} ${index}`, phone: `${suffix}-${index}` }));
  let membershipPackage;
  let room;
  let session;
  let payment;
  const run = (action) => withRuntime({ database: client }, action);

  beforeAll(async () => {
    const target = new URL(configuredUrl);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) || !/^\/sports_center_[a-z0-9_]*test$/.test(target.pathname)) throw new Error("A dedicated local test database is required.");
    client = createDatabaseClient(configuredUrl);
    await client.users.createMany({ data: ids.map((id, index) => ({ id, email: `ops-${index}-${suffix}@localhost.test`, display_name: `Operations ${suffix}`, password_hash: "isolated-fixture", role: index < 2 ? "member" : index === 2 ? "receptionist" : "coach", status: "active" })) });
    for (let index = 0; index < 2; index += 1) members.push(await client.members.create({ data: { user_id: ids[index], member_code: `OPS-${suffix}-${index}`, full_name: `Ops ${suffix} ${index}`, phone: `${suffix}${index}` } }));
    await client.members.createMany({ data: pageMembers });
    membershipPackage = await client.membership_packages.create({ data: { code: `OPS-${suffix}`, name: `Operations ${suffix}`, price_vnd: 0n, duration_days: 30, tier_rank: randomInt(100000, 2000000000) } });
    await client.membership_package_entitlements.create({ data: { package_id: membershipPackage.id, entitlement: "group_class_booking" } });
    await client.member_memberships.createMany({ data: members.map((member) => ({ member_id: member.id, package_id: membershipPackage.id, package_name_snapshot: membershipPackage.name, price_vnd_snapshot: 0n, status: "active", starts_on: new Date("2099-01-01"), expires_on: new Date("2099-01-31") })) });
    room = await client.rooms.create({ data: { code: `OPS-${suffix}`, name: `Operations ${suffix}`, capacity: 1 } });
    session = await client.class_sessions.create({ data: { code: `OPS-${suffix}`, name: "Last seat", type: "Yoga", coach_user_id: ids[3], room_id: room.id, starts_at: new Date("2099-01-02T02:00:00Z"), ends_at: new Date("2099-01-02T03:00:00Z"), capacity: 1, status: "published" } });
    payment = await client.payments.create({ data: { transaction_code: `OPS-${suffix}`, member_id: members[0].id, recorded_by: ids[2], amount_vnd: 1000n, method: "cash" } });
  }, 30000);

  afterAll(async () => {
    if (!client) return;
    const memberIds = [...members, ...pageMembers].map((member) => member.id);
    try {
      await client.audit_logs.deleteMany({ where: { actor_user_id: { in: ids } } });
      const payments = await client.payments.findMany({ where: { member_id: { in: memberIds } }, select: { id: true } });
      await client.payment_events.deleteMany({ where: { payment_id: { in: payments.map((item) => item.id) } } });
      await client.payments.deleteMany({ where: { member_id: { in: memberIds } } });
      await client.notifications.deleteMany({ where: { recipient_user_id: { in: ids } } });
      await client.bookings.deleteMany({ where: { member_id: { in: memberIds } } });
      if (session) await client.class_sessions.delete({ where: { id: session.id } });
      if (room) await client.rooms.delete({ where: { id: room.id } });
      await client.member_memberships.deleteMany({ where: { member_id: { in: memberIds } } });
      if (membershipPackage) {
        await client.membership_package_entitlements.deleteMany({ where: { package_id: membershipPackage.id } });
        await client.membership_packages.delete({ where: { id: membershipPackage.id } });
      }
      await client.members.deleteMany({ where: { id: { in: memberIds } } });
      await client.auth_sessions.deleteMany({ where: { user_id: { in: ids } } });
      await client.auth_mfa_login_challenges.deleteMany({ where: { user_id: { in: ids } } });
      await client.auth_mfa_enrollments.deleteMany({ where: { user_id: { in: ids } } });
      await client.auth_totp_factors.deleteMany({ where: { user_id: { in: ids } } });
      await client.account_verifications.deleteMany({ where: { user_id: { in: ids } } });
      await client.users.deleteMany({ where: { id: { in: ids } } });
    } finally { await client.$disconnect(); }
  }, 30000);

  it("rolls back password and session changes if the audit insert fails", async () => {
    const authSession = await client.auth_sessions.create({ data: { user_id: ids[0], expires_at: new Date("2099-01-01") } });
    const challenge = await client.auth_mfa_login_challenges.create({ data: { user_id: ids[0], expires_at: new Date("2099-01-01") } });
    const failingDatabase = { $transaction: (callback) => client.$transaction((transaction) => callback(new Proxy(transaction, {
      get(target, property) {
        if (property === "audit_logs") return { create: async () => { throw new Error("forced audit failure"); } };
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }))) };
    await expect(withRuntime({ database: failingDatabase }, () => authRepository.changePasswordAndRevokeSessions({
      userId: ids[0], passwordHash: "uncommitted-password", expectedPasswordHash: "isolated-fixture",
    }))).rejects.toThrow("forced audit failure");
    expect((await client.users.findUnique({ where: { id: ids[0] } })).password_hash).toBe("isolated-fixture");
    expect((await client.auth_sessions.findUnique({ where: { id: authSession.id } })).revoked_at).toBeNull();
    expect((await client.auth_mfa_login_challenges.findUnique({ where: { id: challenge.id } })).expires_at).toEqual(new Date("2099-01-01"));
  });

  it("allows only one concurrent password change with the same previous hash", async () => {
    const current = await client.auth_sessions.create({ data: { user_id: ids[1], expires_at: new Date("2099-01-01") } });
    const other = await client.auth_sessions.create({ data: { user_id: ids[1], expires_at: new Date("2099-01-01") } });
    const challenge = await client.auth_mfa_login_challenges.create({ data: { user_id: ids[1], expires_at: new Date("2099-01-01"), used_at: new Date() } });
    const enrollment = await client.auth_mfa_enrollments.create({ data: { user_id: ids[1], secret_ciphertext: "isolated-enrollment", expires_at: new Date("2099-01-01") } });
    const results = await Promise.allSettled(["new-hash-a", "new-hash-b"].map((passwordHash) => run(() => authRepository.changePasswordAndRevokeSessions({
      userId: ids[1], passwordHash, expectedPasswordHash: "isolated-fixture", currentSessionId: current.id,
    }))));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.reason?.code === "PASSWORD_CHANGE_CONFLICT")).toHaveLength(1);
    expect((await client.auth_sessions.findUnique({ where: { id: current.id } })).revoked_at).toBeNull();
    expect((await client.auth_sessions.findUnique({ where: { id: other.id } })).revoked_at).not.toBeNull();
    expect(await client.audit_logs.count({ where: { actor_user_id: ids[1], action: "auth.password_changed" } })).toBe(1);
    expect((await client.auth_mfa_login_challenges.findUnique({ where: { id: challenge.id } })).expires_at.getTime()).toBeLessThanOrEqual(Date.now());
    expect((await client.auth_mfa_enrollments.findUnique({ where: { id: enrollment.id } })).expires_at.getTime()).toBeLessThanOrEqual(Date.now());
    await expect(run(() => authRepository.createSession({ userId: ids[1], expiresAt: new Date("2099-01-01"), expectedPasswordHash: "isolated-fixture" }))).rejects.toMatchObject({ statusCode: 401 });
  });

  it("reserves no more than five OTP attempts under concurrent requests", async () => {
    const verification = await client.account_verifications.create({ data: { user_id: ids[0], channel: "email", purpose: "registration", code_hash: "isolated-hash", expires_at: new Date("2099-01-01") } });
    const results = await Promise.all(Array.from({ length: 10 }, () => run(() => authRepository.incrementVerificationAttempts(verification.id))));
    expect(results.filter((result) => result.count === 1)).toHaveLength(5);
    expect((await client.account_verifications.findUnique({ where: { id: verification.id } })).attempts).toBe(5);
  });

  it("moves registration to pending approval and audits exactly once under concurrent confirmation", async () => {
    await client.users.update({ where: { id: ids[0] }, data: { status: "pending_verification" } });
    try {
      const verification = await client.account_verifications.create({ data: { user_id: ids[0], channel: "email", purpose: "registration", code_hash: "isolated-hash", expires_at: new Date("2099-01-01"), attempts: 1 } });
      const results = await Promise.all(Array.from({ length: 2 }, () => run(() => authRepository.completeRegistrationVerification({ verificationId: verification.id, userId: ids[0], channel: "email" }))));
      expect(results.filter(Boolean)).toHaveLength(1);
      expect((await client.users.findUnique({ where: { id: ids[0] } })).status).toBe("pending_approval");
      expect(await client.audit_logs.count({ where: { actor_user_id: ids[0], action: "member.registration.verified" } })).toBe(1);
    } finally { await client.users.update({ where: { id: ids[0] }, data: { status: "active" } }); }
  });

  it("activates MFA while revoking sessions and pending login challenges", async () => {
    const authSession = await client.auth_sessions.create({ data: { user_id: ids[0], expires_at: new Date("2099-01-01") } });
    const challenge = await client.auth_mfa_login_challenges.create({ data: { user_id: ids[0], expires_at: new Date("2099-01-01") } });
    const enrollment = await client.auth_mfa_enrollments.create({ data: { user_id: ids[0], secret_ciphertext: "isolated-encrypted-fixture", expires_at: new Date("2099-01-01") } });
    await run(() => authRepository.activateTotpFactor({ enrollmentId: enrollment.id, userId: ids[0], secretCiphertext: enrollment.secret_ciphertext }));
    expect((await client.auth_sessions.findUnique({ where: { id: authSession.id } })).revoked_at).not.toBeNull();
    expect((await client.auth_mfa_login_challenges.findUnique({ where: { id: challenge.id } })).expires_at.getTime()).toBeLessThanOrEqual(Date.now());
    expect(await client.audit_logs.count({ where: { actor_user_id: ids[0], action: "auth.mfa_enrolled" } })).toBe(1);
    await expect(run(() => authRepository.createSession({ userId: ids[0], expiresAt: new Date("2099-01-01"), expectedPasswordHash: "isolated-fixture" }))).rejects.toMatchObject({ statusCode: 401 });
    await expect(run(() => authRepository.createMfaLoginChallenge({ userId: ids[0], expiresAt: new Date("2099-01-01"), expectedPasswordHash: "stale-hash", expectedFactorCiphertext: enrollment.secret_ciphertext }))).rejects.toMatchObject({ statusCode: 401 });
    const validChallenge = await run(() => authRepository.createMfaLoginChallenge({ userId: ids[0], expiresAt: new Date("2099-01-01"), expectedPasswordHash: "isolated-fixture", expectedFactorCiphertext: enrollment.secret_ciphertext }));
    expect(validChallenge.user_id).toBe(ids[0]);
  });

  it("rolls back payment creation and completion when the audit insert fails", async () => {
    const data = { transaction_code: `OPS-ROLLBACK-${suffix}`, member_id: members[0].id, recorded_by: ids[2], amount_vnd: 1000n, method: "cash", status: "pending" };
    await expect(run(() => paymentRepository.createWithEvent(data, { event_type: "created", new_status: "pending", actor_user_id: ids[2] }, { action: null, summary: "Forced audit failure" }))).rejects.toThrow();
    expect(await client.payments.count({ where: { transaction_code: data.transaction_code } })).toBe(0);
    await expect(run(() => paymentRepository.complete({ id: payment.id, status: "paid", paidAt: new Date(), eventType: "confirmation", actorUserId: ids[2], audit: { action: null, summary: "Forced audit failure" } }))).rejects.toThrow();
    expect((await client.payments.findUnique({ where: { id: payment.id } })).status).toBe("pending");
    expect(await client.payment_events.count({ where: { payment_id: payment.id } })).toBe(0);
  });

  it("commits exactly one event and audit under concurrent confirmation", async () => {
    const confirm = () => run(() => paymentRepository.complete({ id: payment.id, status: "paid", paidAt: new Date(), eventType: "confirmation", actorUserId: ids[2], audit: { action: "payment.paid", summary: "Concurrent confirmation" } }));
    const results = await Promise.all([confirm(), confirm()]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await client.payment_events.count({ where: { payment_id: payment.id } })).toBe(1);
    expect(await client.audit_logs.count({ where: { entity_id: payment.id, action: "payment.paid" } })).toBe(1);
  });

  it("keeps the final class seat within capacity under concurrent booking", async () => {
    const results = await Promise.all(members.map((member, index) => run(() => bookingRepository.createWithCapacity({ bookingCode: `OPS-${suffix}-${index}`, memberId: member.id, classId: session.id, bookedBy: member.user_id }))));
    expect(results.map((result) => result.booking.status).sort()).toEqual(["confirmed", "waitlisted"]);
    expect(await client.bookings.count({ where: { class_session_id: session.id, status: "confirmed" } })).toBe(1);
  });

  it("searches across member pages and keeps payment ownership on the server", async () => {
    const query = { page: 1, pageSize: 1, search: `Ops ${suffix}`, coach: [], package: [], status: [] };
    const first = await run(() => memberRepository.selectPage(query));
    const second = await run(() => memberRepository.selectPage({ ...query, page: 2 }));
    expect(first.total).toBe(2);
    expect(first.ids).toHaveLength(1);
    expect(second.ids).toHaveLength(1);
    expect(first.ids[0]).not.toBe(second.ids[0]);
    const match = await run(() => memberRepository.selectPage({ ...query, search: members[0].phone, status: ["active"] }));
    expect(match.ids).toEqual([members[0].id]);
    expect(match.facets.package).toContain(membershipPackage.name);
    const service = createPaymentService({ repository: paymentRepository });
    const own = await run(() => service.ownPayments({ id: ids[1] }, { page: 1, pageSize: 10, search: "" }));
    expect(own.items).toEqual([]);
    const paid = await run(() => service.page({ page: 1, pageSize: 1, memberId: members[0].id, search: suffix, status: ["paid"], direction: "desc", sort: "amountVnd" }));
    expect(paid.items.map((item) => item.id)).toEqual([payment.id]);
    expect(paid.meta.total).toBe(1);
  });

  it("bounds a 101-member result to 100 rows and can search the remaining page", async () => {
    const query = { page: 1, pageSize: 100, search: `Page ${suffix}`, coach: [], package: [], status: [] };
    const first = await run(() => memberRepository.selectPage(query));
    const second = await run(() => memberRepository.selectPage({ ...query, page: 2 }));
    expect(first.total).toBe(101);
    expect(first.ids).toHaveLength(100);
    expect(second.ids).toHaveLength(1);
    expect(first.ids).not.toContain(second.ids[0]);
    const remaining = pageMembers.find((member) => member.id === second.ids[0]);
    const searched = await run(() => memberRepository.selectPage({ ...query, search: remaining.member_code }));
    expect(searched.ids).toEqual([remaining.id]);
    expect(searched.total).toBe(1);
  });

  it("detects changed business data even when row counts stay the same", async () => {
    const connection = new Client({ connectionString: configuredUrl });
    await connection.connect();
    try {
      await connection.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      const expected = await readBusinessManifest(connection);
      await connection.query("UPDATE members SET full_name = $1 WHERE id = $2", ["Changed restore fixture", members[0].id]);
      const changed = await readBusinessManifest(connection);
      expect(changed.members.rows).toBe(expected.members.rows);
      expect(changed.members).not.toEqual(expected.members);
      expect(() => verifyBusinessManifest(expected, changed)).toThrow("does not match");
    } finally {
      await connection.query("ROLLBACK");
      await connection.end();
    }
  });
});
