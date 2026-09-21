import { prisma } from "../src/database.js";

const api = process.env.E2E_API_BASE_URL ?? "https://sports-center-api.onrender.com/api/v1";
const password = process.env.E2E_PASSWORD;
if (!password) throw new Error("E2E_PASSWORD is required.");

async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, options);
  const contentType = response.headers.get("content-type") ?? "";
  return { response, body: contentType.includes("application/json") ? await response.json() : await response.text() };
}

async function login(email) {
  const { response } = await request("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Login failed for ${email}: ${response.status}`);
  return response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
}

function headers(cookie) {
  return { cookie, "content-type": "application/json" };
}

async function expectStatus(label, action, status) {
  const result = await action();
  if (result.response.status !== status) throw new Error(`${label}: expected ${status}, received ${result.response.status}`);
  return result;
}

const managerCookie = await login("manager01@sportscenter.local");
const receptionCookie = await login("reception01@sportscenter.local");
const memberOneCookie = await login("member01@sportscenter.local");
const memberTwoCookie = await login("member02@sportscenter.local");

const revenue = await expectStatus("revenue report", () => request("/reports/revenue?period=month", { headers: headers(managerCookie) }), 200);
if (!revenue.body.data || typeof revenue.body.data !== "object") throw new Error("Revenue report has no data.");
const attendance = await expectStatus("attendance report", () => request("/reports/attendance?period=month", { headers: headers(managerCookie) }), 200);
if (!attendance.body.data || typeof attendance.body.data !== "object") throw new Error("Attendance report has no data.");
const exported = await expectStatus("revenue export", () => request("/reports/revenue/export?period=month", { headers: { cookie: managerCookie } }), 200);
if (!String(exported.body).includes("Báo cáo doanh thu")) throw new Error("Revenue export is not CSV content.");
await expectStatus("custom report validation", () => request("/reports/revenue?period=custom", { headers: headers(managerCookie) }), 422);

const notifications = await expectStatus("member notifications", () => request("/notifications", { headers: headers(memberTwoCookie) }), 200);
if (!Array.isArray(notifications.body.data)) throw new Error("Notifications are not a list.");
await expectStatus("notification preferences", () => request("/notification-preferences", { headers: headers(memberTwoCookie) }), 200);

const members = await expectStatus("member list", () => request("/members", { headers: headers(receptionCookie) }), 200);
const memberTwo = members.body.data.find((member) => member.email === "member02@sportscenter.local");
const memberOne = members.body.data.find((member) => member.email === "member01@sportscenter.local");
if (!memberOne || !memberTwo) throw new Error("Member concurrency fixtures are missing.");
const packages = await expectStatus("package list", () => request("/membership-packages", { headers: headers(receptionCookie) }), 200);
const standard = packages.body.data.find((item) => item.code === "STANDARD");
if (!standard) throw new Error("STANDARD package is missing.");

const memberOneAccess = await prisma.member_memberships.findFirst({ where: {
  member_id: memberOne.id, package_id: standard.id, status: { in: ["active", "expiring_soon"] }, expires_on: { gte: new Date("2026-09-28") },
} });
if (!memberOneAccess) await prisma.member_memberships.create({ data: {
  member_id: memberOne.id, package_id: standard.id, package_name_snapshot: standard.name, price_vnd_snapshot: BigInt(standard.priceVnd), status: "active",
  starts_on: new Date("2026-09-01"), expires_on: new Date("2026-12-31"), contract_expires_at: new Date("2026-12-31T17:00:00.000Z"), grace_expires_at: new Date("2027-01-03T17:00:00.000Z"), activated_at: new Date(),
} });

const startsOn = "2026-09-21";
const membership = await expectStatus("pending payment membership", () => request(`/members/${memberTwo.id}/memberships`, {
  method: "POST", headers: headers(receptionCookie), body: JSON.stringify({ packageId: standard.id, startsOn }),
}), 201);
const payment = await expectStatus("online sandbox payment", () => request("/payments", {
  method: "POST", headers: headers(receptionCookie), body: JSON.stringify({ memberId: memberTwo.id, membershipId: membership.body.data.id, amountVnd: Number(standard.priceVnd), method: "online", provider: "vnpay", notes: "E2E full regression" }),
}), 201);
const sandbox = new URL(payment.body.data.sandboxPaymentUrl);
if (sandbox.origin !== new URL(api).origin) throw new Error("Sandbox URL does not target the API host.");
if (!(await fetch(sandbox)).ok) throw new Error("Sandbox page is unavailable.");
const transactionCode = payment.body.data.transaction_code;
const amount = Number(sandbox.searchParams.get("amount"));
await expectStatus("invalid callback rejected", () => request("/payments/callbacks/vnpay", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ transactionCode, status: "paid", amount, signature: "invalid" }),
}), 401);
const callback = { transactionCode, status: "paid", amount, signature: sandbox.searchParams.get("signature") };
await expectStatus("valid callback", () => request("/payments/callbacks/vnpay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(callback) }), 200);
const duplicate = await expectStatus("duplicate callback idempotency", () => request("/payments/callbacks/vnpay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(callback) }), 200);
if (duplicate.body.data.status !== "paid") throw new Error("Duplicate callback changed the paid result.");

const [room, coach, creator] = await Promise.all([
  prisma.rooms.findFirst({ where: { is_active: true } }),
  prisma.users.findFirst({ where: { role: "coach", status: "active" } }),
  prisma.users.findFirst({ where: { role: "manager", status: "active" } }),
]);
if (!room || !coach || !creator) throw new Error("Concurrency fixture dependencies are missing.");
const run = Date.now().toString().slice(-8);
const session = await prisma.class_sessions.create({ data: {
  code: `E2E-RACE-${run}`, name: `E2E concurrent booking ${run}`, type: "group", room_id: room.id, coach_user_id: coach.id,
  starts_at: new Date("2026-09-28T12:00:00.000Z"), ends_at: new Date("2026-09-28T13:00:00.000Z"), capacity: 1, status: "published", created_by: creator.id,
} });
const race = await Promise.all([
  request("/bookings", { method: "POST", headers: headers(memberOneCookie), body: JSON.stringify({ classId: session.id }) }),
  request("/bookings", { method: "POST", headers: headers(memberTwoCookie), body: JSON.stringify({ classId: session.id }) }),
]);
if (race.some((result) => result.response.status !== 201)) throw new Error(`Concurrent booking returned ${race.map((result) => result.response.status).join(", ")}`);
const statuses = race.map((result) => result.body.data.status).sort().join(",");
if (statuses !== "confirmed,waitlisted") throw new Error(`Concurrent booking statuses: ${statuses}`);

console.log(JSON.stringify({ reports: "passed", notifications: notifications.body.data.length, paymentCallbacks: "invalid-rejected-valid-idempotent", concurrentBooking: statuses }));
await prisma.$disconnect();
