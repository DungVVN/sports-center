export function recordDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}
