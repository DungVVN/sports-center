import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export function migrationDatabaseUrl(environment = process.env) {
  const configuredUrl = environment.MIGRATE_DATABASE_URL || environment.DATABASE_URL;
  if (!configuredUrl) return undefined;

  const url = new URL(configuredUrl);
  if (!url.hostname.includes("-pooler.")) return configuredUrl;

  // Prisma's advisory lock must stay on one PostgreSQL connection. Neon pooler
  // endpoints can move a migration between backend connections, so use Neon’s
  // matching direct endpoint for the migration process only.
  url.hostname = url.hostname.replace("-pooler.", ".");
  return url.toString();
}

const retryDelaysMs = [3000, 5000, 10000, 15000, 20000, 30000];

function runMigration(migrationUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn("prisma", ["migrate", "deploy"], {
      env: { ...process.env, MIGRATE_DATABASE_URL: migrationUrl },
      stdio: ["inherit", "pipe", "pipe"],
    });
    let output = "";

    for (const stream of [child.stdout, child.stderr]) {
      stream.on("data", (chunk) => {
        const text = chunk.toString();
        output += text;
        stream === child.stdout ? process.stdout.write(text) : process.stderr.write(text);
      });
    }

    child.once("error", reject);
    child.once("close", (code) => resolve({ code, output }));
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runMigrations(environment = process.env) {
  const configuredMaxAttempts = Number.parseInt(environment.PRISMA_MIGRATE_MAX_ATTEMPTS ?? "8", 10);
  const maxAttempts = Number.isInteger(configuredMaxAttempts) && configuredMaxAttempts > 0
    ? configuredMaxAttempts
    : 8;
  const migrationUrl = migrationDatabaseUrl(environment);
  if (!migrationUrl) throw new Error("MIGRATE_DATABASE_URL hoặc DATABASE_URL là bắt buộc để chạy Prisma migration.");
  if (migrationUrl !== (environment.MIGRATE_DATABASE_URL || environment.DATABASE_URL)) {
    console.warn("Migration URL uses a Neon pooler endpoint; using the matching direct endpoint for Prisma advisory locking.");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await runMigration(migrationUrl);
    if (result.code === 0) return 0;

    const isAdvisoryLockTimeout = result.output.includes("P1002") && result.output.includes("advisory lock");
    if (!isAdvisoryLockTimeout || attempt === maxAttempts) return result.code ?? 1;

    const delay = retryDelaysMs[Math.min(attempt - 1, retryDelaysMs.length - 1)];
    console.warn(`Migration lock is busy. Retrying ${attempt + 1}/${maxAttempts} in ${delay / 1000}s.`);
    await wait(delay);
  }

  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await runMigrations();
}
