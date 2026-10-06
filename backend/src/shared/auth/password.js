import bcrypt from "bcryptjs";
import { AppError } from "../errors/app-error.js";

const saltRounds = 12;

export async function hashPassword(password) {
  if (bcrypt.truncates(password)) {
    throw new AppError({ statusCode: 422, code: "PASSWORD_TOO_LONG", message: "Mật khẩu quá dài khi dùng ký tự có dấu hoặc emoji. Vui lòng dùng mật khẩu ngắn hơn." });
  }
  return bcrypt.hash(password, saltRounds);
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}
