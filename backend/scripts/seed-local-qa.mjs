import { hashPassword } from "../src/shared/auth/password.js";
import { prisma } from "../src/database.js";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
const qaPort = process.env.QA_SEED_PORT ?? "54329";
if (databaseUrl.hostname !== "127.0.0.1" || databaseUrl.port !== qaPort || databaseUrl.pathname !== "/sports_center_qa" || process.env.QA_SEED_CONFIRM !== "LOCAL_QA_ONLY") {
  throw new Error("Refusing to seed a database other than the isolated local QA database.");
}

const qaPassword = process.env.QA_SEED_PASSWORD;
if (!qaPassword || qaPassword.length < 8) {
  throw new Error("QA_SEED_PASSWORD must be at least 8 characters for isolated QA accounts.");
}

const passwordHash = await hashPassword(qaPassword);
const staff = [
  ["manager", "QA Manager", "STF-QA-MGR"],
  ["receptionist", "QA Receptionist", "STF-QA-REC"],
  ["coach", "QA Coach", "STF-QA-COA"],
];

try {
  await prisma.users.upsert({
    where: { email: "qa-admin@localhost.test" },
    update: { role: "admin", status: "active", password_hash: passwordHash, must_change_password: false, profile_setup_required: false },
    create: { email: "qa-admin@localhost.test", display_name: "QA Admin", role: "admin", status: "active", password_hash: passwordHash },
  });
  for (const [role, displayName, employeeCode] of staff) {
    const email = `qa-${role}@localhost.test`;
    const user = await prisma.users.upsert({
      where: { email },
      update: { role, status: "active", password_hash: passwordHash, must_change_password: false, profile_setup_required: false },
      create: { email, display_name: displayName, role, status: "active", password_hash: passwordHash },
    });
    await prisma.staff_profiles.upsert({
      where: { user_id: user.id },
      update: { employee_code: employeeCode },
      create: { user_id: user.id, employee_code: employeeCode },
    });
  }

  const email = "qa-member@localhost.test";
  const memberUser = await prisma.users.upsert({
    where: { email },
    update: { role: "member", status: "active", password_hash: passwordHash, must_change_password: false, profile_setup_required: false },
    create: { email, display_name: "QA Member", role: "member", status: "active", password_hash: passwordHash },
  });
  await prisma.members.upsert({
    where: { user_id: memberUser.id },
    update: { full_name: "QA Member", email, phone: "0900000029" },
    create: { user_id: memberUser.id, member_code: "MEM-QA-0029", full_name: "QA Member", email, phone: "0900000029" },
  });
  await prisma.rooms.upsert({
    where: { code: "ROOM-QA-01" },
    update: { name: "Phòng QA", capacity: 20, is_active: true },
    create: { code: "ROOM-QA-01", name: "Phòng QA", capacity: 20 },
  });

  // The facility migration defines permissions but intentionally does not assign them
  // to roles. Give only the disposable QA roles the workflow permissions under test.
  const facilityPermissions = {
    manager: ["facility.manage", "facility.day.manage", "facility.booking.read", "facility.booking.approve", "facility.booking.cancel"],
    receptionist: ["facility.booking.read", "facility.booking.approve", "facility.booking.cancel"],
    member: ["facility.booking.self.read", "facility.booking.request", "facility.booking.cancel"],
  };
  await prisma.role_permissions.createMany({
    data: Object.entries(facilityPermissions).flatMap(([role_code, codes]) =>
      codes.map((permission_code) => ({ role_code, permission_code }))),
    skipDuplicates: true,
  });
  console.log("Created five disposable QA accounts in the isolated local database.");
} finally {
  await prisma.$disconnect();
}
