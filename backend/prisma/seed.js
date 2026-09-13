// DEV-only reference data. It is idempotent: re-running it updates no production
// records and does not duplicate packages, rooms, roles, or permissions.
import { prisma } from "../src/database.js";

const permissions = [
  ["member.read", "Xem hồ sơ hội viên"], ["member.write", "Tạo và cập nhật hội viên"],
  ["class.read", "Xem lớp học"], ["class.manage", "Tạo và quản lý lớp học"],
  ["booking.write", "Tạo và hủy đặt chỗ"], ["attendance.write", "Ghi nhận điểm danh"],
  ["payment.record", "Ghi nhận thanh toán"],
  ["registration.approve", "Duyệt tài khoản hội viên đăng ký công khai"],
  ["training.write", "Tạo kế hoạch và kết quả tập luyện"], ["membership.freeze.review", "Duyệt yêu cầu đóng băng gói tập"], ["report.read", "Xem báo cáo"],
  ["staff.manage", "Quản lý nhân viên"], ["audit.read", "Xem nhật ký kiểm toán"],
];

async function main() {
  for (const [code, label] of [["manager", "Quản lý"], ["receptionist", "Lễ tân"], ["coach", "Huấn luyện viên"], ["member", "Hội viên"]]) {
    await prisma.roles.upsert({ where: { code }, update: { label }, create: { code, label } });
  }

  for (const [code, description] of permissions) {
    await prisma.permissions.upsert({ where: { code }, update: { description }, create: { code, description } });
  }

  await prisma.role_permissions.createMany({
    data: permissions.map(([permission_code]) => ({ role_code: "manager", permission_code })),
    skipDuplicates: true,
  });
  await prisma.role_permissions.createMany({
    data: [
      ["receptionist", "member.read"], ["receptionist", "member.write"], ["receptionist", "class.read"], ["receptionist", "booking.write"], ["receptionist", "attendance.write"], ["receptionist", "payment.record"],
      ["receptionist", "registration.approve"], ["receptionist", "membership.freeze.review"],
      ["coach", "class.read"], ["coach", "attendance.write"], ["coach", "training.write"],
      ["member", "class.read"], ["member", "booking.write"],
    ].map(([role_code, permission_code]) => ({ role_code, permission_code })),
    skipDuplicates: true,
  });

  const packageIds = {};
  for (const item of [
    { code: "BASIC", name: "Basic", price_vnd: 490000n, duration_days: 30, tier_rank: 1, benefits: ["Tự do sử dụng phòng tập", "Tủ đồ tiêu chuẩn"] },
    { code: "STANDARD", name: "Standard", price_vnd: 1185000n, duration_days: 90, tier_rank: 2, benefits: ["Phòng tập", "Tủ đồ tiêu chuẩn", "2 buổi lớp nhóm/tuần", "Khăn tắm"] },
    { code: "PREMIUM", name: "Premium", price_vnd: 2490000n, duration_days: 365, tier_rank: 3, benefits: ["Phòng tập", "Tủ đồ cao cấp", "Lớp nhóm không giới hạn", "Khăn tắm", "Hồ bơi", "Xông hơi", "2 buổi PT/tháng"] },
  ]) {
    const membershipPackage = await prisma.membership_packages.upsert({ where: { code: item.code }, update: item, create: item });
    packageIds[item.code] = membershipPackage.id;
  }

  for (const [packageCode, entitlement, usage_limit, limit_period] of [
    ["BASIC", "gym_access", null, null],
    ["STANDARD", "gym_access", null, null], ["STANDARD", "group_class_booking", 2, "weekly"], ["STANDARD", "towel_service", null, null],
    ["PREMIUM", "gym_access", null, null], ["PREMIUM", "group_class_booking", null, null], ["PREMIUM", "towel_service", null, null],
    ["PREMIUM", "pool_access", null, null], ["PREMIUM", "sauna_access", null, null], ["PREMIUM", "premium_locker", null, null], ["PREMIUM", "pt_session", 2, "monthly"],
  ]) {
    const package_id = packageIds[packageCode];
    await prisma.membership_package_entitlements.upsert({
      where: { package_id_entitlement: { package_id, entitlement } },
      update: { usage_limit, limit_period },
      create: { package_id, entitlement, usage_limit, limit_period },
    });
  }

  for (const room of [
    { code: "ROOM-A", name: "Phòng A", capacity: 20 }, { code: "ROOM-B", name: "Phòng B", capacity: 12 },
    { code: "ROOM-C", name: "Phòng C", capacity: 18 }, { code: "POOL", name: "Hồ bơi", capacity: 10 },
  ]) {
    await prisma.rooms.upsert({ where: { code: room.code }, update: room, create: room });
  }
}

main()
  .then(() => console.log("Sports Center DEV seed completed."))
  .finally(() => prisma.$disconnect());
