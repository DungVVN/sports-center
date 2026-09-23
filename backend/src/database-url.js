const legacySslModes = new Set(["prefer", "require", "verify-ca"]);

export function normalizeDatabaseConnectionString(connectionString) {
  const url = new URL(connectionString);
  if (legacySslModes.has(url.searchParams.get("sslmode"))) {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}
