import "dotenv/config";
import { hashPassword } from "../src/shared/auth/password.js";
import { prisma } from "../src/database.js";

const password = process.env.DEMO_ACCOUNT_PASSWORD;

if (!password || password.length < 12) {
  throw new Error("DEMO_ACCOUNT_PASSWORD phải có ít nhất 12 ký tự.");
}

const accounts = [
  { email: "manager01@sportscenter.local", name: "Quản lý Minh", role: "manager", code: "STF-MGR-001", phone: "0901000001" },
  { email: "manager02@sportscenter.local", name: "Quản lý Lan", role: "manager", code: "STF-MGR-002", phone: "0901000002" },
  { email: "reception01@sportscenter.local", name: "Lễ tân Hương", role: "receptionist", code: "STF-REC-001", phone: "0901000011" },
  { email: "reception02@sportscenter.local", name: "Lễ tân Nam", role: "receptionist", code: "STF-REC-002", phone: "0901000012" },
  { email: "coach01@sportscenter.local", name: "Coach An", role: "coach", code: "STF-COA-001", phone: "0901000021" },
  { email: "coach02@sportscenter.local", name: "Coach Bình", role: "coach", code: "STF-COA-002", phone: "0901000022" },
  { email: "member01@sportscenter.local", name: "Hội viên Hà", role: "member", code: "MBR-001", phone: "0901000031" },
  { email: "member02@sportscenter.local", name: "Hội viên Duy", role: "member", code: "MBR-002", phone: "0901000032" },
];

const staffRoles = new Set(["manager", "receptionist", "coach"]);
const passwordHash = await hashPassword(password);

await prisma.$transaction(async (transaction) => {
  for (const account of accounts) {
    const user = await transaction.users.upsert({
      where: { email: account.email },
      update: { display_name: account.name, password_hash: passwordHash, role: account.role, status: "active" },
      create: { email: account.email, display_name: account.name, password_hash: passwordHash, role: account.role, status: "active" },
    });

    if (staffRoles.has(account.role)) {
      await transaction.staff_profiles.upsert({
        where: { user_id: user.id },
        update: { employee_code: account.code, phone: account.phone, specialties: account.role === "coach" ? ["Tập thể lực"] : [] },
        create: { user_id: user.id, employee_code: account.code, phone: account.phone, specialties: account.role === "coach" ? ["Tập thể lực"] : [] },
      });
    } else {
      await transaction.members.upsert({
        where: { user_id: user.id },
        update: { member_code: account.code, full_name: account.name, phone: account.phone, email: account.email },
        create: { user_id: user.id, member_code: account.code, full_name: account.name, phone: account.phone, email: account.email },
      });
    }
  }
});

console.log(`Đã đồng bộ ${accounts.length} tài khoản demo.`);
await prisma.$disconnect();
