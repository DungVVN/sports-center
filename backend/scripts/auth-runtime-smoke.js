const baseUrl = (process.env.API_BASE_URL ?? "http://localhost:8880/api/v1").replace(/\/$/, "");
const password = process.env.DEMO_ACCOUNT_PASSWORD;

if (!password) {
  throw new Error("DEMO_ACCOUNT_PASSWORD là bắt buộc.");
}

const accounts = [
  ["manager", "manager01@sportscenter.local"], ["manager", "manager02@sportscenter.local"],
  ["receptionist", "reception01@sportscenter.local"], ["receptionist", "reception02@sportscenter.local"],
  ["coach", "coach01@sportscenter.local"], ["coach", "coach02@sportscenter.local"],
  ["member", "member01@sportscenter.local"], ["member", "member02@sportscenter.local"],
];

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  if (!response.ok || !body.success) {
    throw new Error(`${options.method ?? "GET"} ${path} thất bại: ${body.error?.code ?? response.status}`);
  }
  return { response, body };
}

for (const [expectedRole, email] of accounts) {
  const { response, body } = await request("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie || body.data.user.role !== expectedRole) {
    throw new Error(`Đăng nhập ${email} không tạo đúng session/role.`);
  }
  const me = await request("/auth/me", { headers: { cookie, accept: "application/json" } });
  if (me.body.data.user.email !== email || me.body.data.user.role !== expectedRole) {
    throw new Error(`Phiên ${email} trả về sai danh tính hoặc role.`);
  }
  await request("/auth/logout", { method: "POST", headers: { cookie, accept: "application/json" } });
  console.log(`PASS ${expectedRole}: ${email}`);
}

console.log(`Đã kiểm tra ${accounts.length} đăng nhập/session thực tại ${baseUrl}.`);
