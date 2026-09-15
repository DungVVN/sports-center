const baseUrl = (process.env.API_BASE_URL ?? "http://localhost:8880/api/v1").replace(/\/$/, "");
const email = process.env.RUNTIME_RATE_LIMIT_EMAIL;
const attempts = Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS ?? 5);

if (!email) throw new Error("RUNTIME_RATE_LIMIT_EMAIL là bắt buộc.");
if (process.env.RUNTIME_RATE_LIMIT_CONFIRM !== "rate-limit-probe") {
  throw new Error("Đặt RUNTIME_RATE_LIMIT_CONFIRM=rate-limit-probe để xác nhận khóa tạm tài khoản probe.");
}

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ email, password: `invalid-runtime-probe-${attempt}` }),
  });
  const payload = await response.json();
  const expectedStatus = attempt === attempts ? 429 : 401;
  if (response.status !== expectedStatus || payload.success !== false) {
    throw new Error(`Lần thử ${attempt} nhận ${response.status}; cần ${expectedStatus}.`);
  }
}

console.log(`PASS rate limit: ${attempts} lần đăng nhập sai của tài khoản probe bị giới hạn đúng cấu hình.`);
