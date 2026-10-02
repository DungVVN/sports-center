export function rentalTotal(rateVnd, startMinute, endMinute) {
  return (BigInt(rateVnd) * BigInt(endMinute - startMinute) + 59n) / 60n;
}

export function rentalInstant(date, minute) {
  return new Date(new Date(`${date}T00:00:00+07:00`).getTime() + minute * 60_000);
}
