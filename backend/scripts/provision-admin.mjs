import "dotenv/config";
import { hashPassword } from "../src/shared/auth/password.js";
import { prisma } from "../src/database.js";

const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
const confirm = process.env.ADMIN_BOOTSTRAP_CONFIRM;

if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("ADMIN_BOOTSTRAP_EMAIL phải là email hợp lệ.");
if (!password || password.length < 12) throw new Error("ADMIN_BOOTSTRAP_PASSWORD phải có ít nhất 12 ký tự.");
if (confirm !== "PROVISION_SINGLE_ADMIN") throw new Error("Đặt ADMIN_BOOTSTRAP_CONFIRM=PROVISION_SINGLE_ADMIN để xác nhận tạo Admin duy nhất.");

const existingAdmin = await prisma.users.findFirst({ where: { role: "admin" } });
if (existingAdmin && existingAdmin.email !== email) {
  throw new Error("Đã tồn tại Admin khác. Không tạo Admin thứ hai qua script này.");
}

const passwordHash = await hashPassword(password);
const user = await prisma.users.upsert({
  where: { email },
  update: { display_name: "Quản trị hệ thống", password_hash: passwordHash, role: "admin", status: "active" },
  create: { email, display_name: "Quản trị hệ thống", password_hash: passwordHash, role: "admin", status: "active" },
});
await prisma.staff_profiles.upsert({
  where: { user_id: user.id },
  update: { employee_code: "STF-ADM-001" },
  create: { user_id: user.id, employee_code: "STF-ADM-001", specialties: [] },
});

console.log(`Admin duy nhất đã được provision: ${user.email}`);
await prisma.$disconnect();
