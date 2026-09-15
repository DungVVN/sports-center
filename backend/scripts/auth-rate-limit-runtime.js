const baseUrl = (process.env.API_BASE_URL ?? "http://localhost:8880/api/v1").replace(/\/$/, "");
const email = process.env.RUNTIME_RATE_LIMIT_EMAIL;
const maximumAttempts = Number(process.env.RUNTIME_RATE_LIMIT_MAX_ATTEMPTS ?? 20);

if (!email) throw new Error("RUNTIME_RATE_LIMIT_EMAIL là bắt buộc.");
if (process.env.RUNTIME_RATE_LIMIT_CONFIRM !== "rate-limit-probe") {
  throw new Error("Đặt RUNTIME_RATE_LIMIT_CONFIRM=rate-limit-probe để xác nhận khóa tạm tài khoản probe.");
}

for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ email, password: `invalid-runtime-probe-${attempt}` }),
  });
  const payload = await response.json();
  if (response.status === 429 && payload.success === false) {
    console.log(`PASS rate limit: API chặn lần đăng nhập sai thứ ${attempt} của tài khoản probe.`);
    process.exit(0);
  }
  if (response.status !== 401 || payload.success !== false) {
    throw new Error(`Lần thử ${attempt} nhận ${response.status}; cần 401 hoặc 429.`);
  }
}

throw new Error(`API không giới hạn đăng nhập sai trong ${maximumAttempts} lần thử.`);
