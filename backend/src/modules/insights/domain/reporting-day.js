// Vietnam business dates use UTC+07:00, independently of the process timezone.
const offsetMs = 7 * 60 * 60 * 1000;

export function reportingDay(value) {
  return new Date(new Date(value).getTime() + offsetMs).toISOString().slice(0, 10);
}

export function reportingRange(query = {}, now = new Date()) {
  const period = query.period ?? "day";
  if (period === "custom") return {
    from: new Date(`${query.from}T00:00:00.000+07:00`),
    to: new Date(`${query.to}T23:59:59.999+07:00`),
    period,
  };
  const from = new Date(now.getTime() + offsetMs);
  const to = new Date(from);
  from.setUTCHours(0, 0, 0, 0);
  to.setUTCHours(23, 59, 59, 999);
  if (period === "week") from.setUTCDate(from.getUTCDate() - ((from.getUTCDay() + 6) % 7));
  if (period === "month") from.setUTCDate(1);
  if (period === "quarter") from.setUTCMonth(Math.floor(from.getUTCMonth() / 3) * 3, 1);
  if (period === "year") from.setUTCMonth(0, 1);
  return { from: new Date(from.getTime() - offsetMs), to: new Date(to.getTime() - offsetMs), period };
}
