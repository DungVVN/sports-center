import { prisma } from "../../../database.js";
const entityLabels = Object.freeze({
  attendance: "Lượt điểm danh", auth_attempt: "Lần đăng nhập", auth_session: "Phiên đăng nhập", booking: "Đặt chỗ", class_session: "Lớp học", member: "Hội viên", membership: "Gói tập của hội viên", membership_package: "Gói tập", payment: "Phiếu thu", staff: "Nhân sự", training_plan: "Giáo án", training_template: "Mẫu giáo án", user: "Tài khoản",
});

function idsFor(logs, entityType) { return logs.filter((item) => item.entity_type === entityType && item.entity_id).map((item) => item.entity_id); }
function actorIdsFor(logs) { return [...new Set(logs.map((item) => item.actor_user_id).filter(Boolean))]; }

export const auditRepository = {
  async list({ page, pageSize }) {
    const total = await prisma.audit_logs.count();
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const resolvedPage = Math.min(page, totalPages);
    const logs = await prisma.audit_logs.findMany({
      orderBy: { occurred_at: "desc" },
      skip: (resolvedPage - 1) * pageSize,
      take: pageSize,
    });
    const [actors, classes, staff, bookings, members, memberships, payments, plans, templates] = await Promise.all([
      prisma.users.findMany({ where: { id: { in: actorIdsFor(logs) } }, select: { id: true, display_name: true } }),
      prisma.class_sessions.findMany({ where: { id: { in: idsFor(logs, "class_session") } }, select: { id: true, code: true, name: true } }),
      prisma.users.findMany({ where: { id: { in: idsFor(logs, "staff") } }, select: { id: true, display_name: true } }),
      prisma.bookings.findMany({ where: { id: { in: idsFor(logs, "booking") } }, select: { id: true, booking_code: true } }),
      prisma.members.findMany({ where: { id: { in: idsFor(logs, "member") } }, select: { id: true, full_name: true, member_code: true } }),
      prisma.member_memberships.findMany({ where: { id: { in: idsFor(logs, "membership") } }, select: { id: true, package_name_snapshot: true } }),
      prisma.payments.findMany({ where: { id: { in: idsFor(logs, "payment") } }, select: { id: true, transaction_code: true } }),
      prisma.training_plans.findMany({ where: { id: { in: idsFor(logs, "training_plan") } }, select: { id: true, name: true } }),
      prisma.training_plan_templates.findMany({ where: { id: { in: idsFor(logs, "training_template") } }, select: { id: true, name: true } }),
    ]);
    const details = new Map([
      ...classes.map((item) => [`class_session:${item.id}`, { label: "Lớp học", value: `${item.name} · ${item.code}` }]),
      ...staff.map((item) => [`staff:${item.id}`, { label: "Nhân sự", value: item.display_name }]),
      ...bookings.map((item) => [`booking:${item.id}`, { label: "Đặt chỗ", value: item.booking_code }]),
      ...members.map((item) => [`member:${item.id}`, { label: "Hội viên", value: `${item.full_name} · ${item.member_code}` }]),
      ...memberships.map((item) => [`membership:${item.id}`, { label: "Gói tập của hội viên", value: item.package_name_snapshot }]),
      ...payments.map((item) => [`payment:${item.id}`, { label: "Phiếu thu", value: item.transaction_code }]),
      ...plans.map((item) => [`training_plan:${item.id}`, { label: "Giáo án", value: item.name }]),
      ...templates.map((item) => [`training_template:${item.id}`, { label: "Mẫu giáo án", value: item.name }]),
    ]);
    const actorNames = new Map(actors.map((item) => [item.id, item.display_name]));
    const items = logs.map((item) => ({
      ...item,
      actor: item.actor_user_id ? { id: item.actor_user_id, name: actorNames.get(item.actor_user_id) ?? "Không xác định" } : { id: null, name: "Hệ thống" },
      entity: details.get(`${item.entity_type}:${item.entity_id}`) ?? { label: entityLabels[item.entity_type] ?? "Đối tượng hệ thống", value: item.entity_type === "auth_session" ? "Phiên làm việc" : null },
    }));

    return {
      items,
      pagination: {
        page: resolvedPage,
        pageSize,
        total,
        totalPages,
      },
    };
  },
};
