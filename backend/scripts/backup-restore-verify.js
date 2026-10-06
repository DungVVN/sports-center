import "dotenv/config";
import { existsSync } from "node:fs";
import { access, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { Client } from "pg";
import { readBusinessManifest, verifyBusinessManifest } from "./backup-manifest.js";

const sourceUrl = process.env.DATABASE_URL ?? process.env.MIGRATE_DATABASE_URL;
const verifyUrl = process.env.BACKUP_RESTORE_VERIFY_DATABASE_URL;
const confirmation = process.env.BACKUP_RESTORE_CONFIRM;
const recordPath = process.env.BACKUP_RESTORE_RECORD_PATH ?? join(process.cwd(), "backup-restore-results", `restore-verify-${Date.now()}.json`);

if (!sourceUrl) throw new Error("DATABASE_URL hoặc MIGRATE_DATABASE_URL là bắt buộc cho database nguồn.");
if (!verifyUrl) throw new Error("BACKUP_RESTORE_VERIFY_DATABASE_URL là bắt buộc cho database kiểm thử riêng.");
if (confirmation !== "restore-verify") throw new Error("Đặt BACKUP_RESTORE_CONFIRM=restore-verify để xác nhận ghi đè database kiểm thử.");

const source = new URL(sourceUrl);
const target = new URL(verifyUrl);
if (source.host === target.host && source.pathname === target.pathname) {
  throw new Error("Database kiểm thử restore phải khác database nguồn.");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", (error) => reject(new Error(`${command} không chạy được: ${error.message}`)));
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} thất bại với mã ${code}.`)));
  });
}

async function postgresBinary(command) {
  const environmentKey = command === "pg_dump" ? "PG_DUMP_BIN" : "PG_RESTORE_BIN";
  if (process.env[environmentKey]) return process.env[environmentKey];

  const executable = process.platform === "win32" ? `${command}.exe` : command;
  if (process.env.POSTGRES_BIN_DIR) return join(process.env.POSTGRES_BIN_DIR, executable);
  if (process.platform !== "win32") return command;

  const installRoot = join(process.env.ProgramFiles ?? "C:\\Program Files", "PostgreSQL");
  try {
    const versions = await readdir(installRoot, { withFileTypes: true });
    const candidates = versions
      .filter((entry) => entry.isDirectory() && /^\d+(?:\.\d+)?$/.test(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => Number(right) - Number(left));
    const detected = candidates
      .map((version) => join(installRoot, version, "bin", executable))
      .find((path) => existsSync(path));
    if (detected) return detected;
  } catch {
    // Fall back to PATH so non-standard installations remain supported.
  }
  return executable;
}

const backupDir = join(tmpdir(), "sports-center-backups");
const backupPath = join(backupDir, `restore-verify-${Date.now()}.dump`);
const startedAt = new Date();
await mkdir(backupDir, { recursive: true });
await mkdir(dirname(recordPath), { recursive: true });
const pgDump = await postgresBinary("pg_dump");
const pgRestore = await postgresBinary("pg_restore");
const sourceClient = new Client({ connectionString: sourceUrl });
const restoredClient = new Client({ connectionString: verifyUrl });

try {
  await sourceClient.connect();
  await sourceClient.query("SET TIME ZONE 'UTC'");
  await sourceClient.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const { rows: [{ snapshot }] } = await sourceClient.query("SELECT pg_export_snapshot() AS snapshot");
  const expected = await readBusinessManifest(sourceClient);
  await run(pgDump, ["--format=custom", "--no-owner", "--no-privileges", `--snapshot=${snapshot}`, `--file=${backupPath}`, sourceUrl]);
  await sourceClient.query("COMMIT");
  await access(backupPath);
  await run(pgRestore, ["--clean", "--if-exists", "--no-owner", "--no-privileges", `--dbname=${verifyUrl}`, backupPath]);

  await restoredClient.connect();
  await restoredClient.query("SET TIME ZONE 'UTC'");
  await restoredClient.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const restored = await readBusinessManifest(restoredClient);
  verifyBusinessManifest(expected, restored);
  await restoredClient.query("COMMIT");
  const finishedAt = new Date();
  await writeFile(recordPath, JSON.stringify({ status: "passed", startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), recoverySeconds: Number(((finishedAt - startedAt) / 1000).toFixed(3)), verifiedTables: Object.keys(expected).length, verification: "business_snapshot_fingerprints", manifest: restored }, null, 2));
  console.log(`PASS backup/restore: dump đã khôi phục vào database kiểm thử riêng. Kết quả: ${recordPath}`);
} catch (error) {
  const finishedAt = new Date();
  await writeFile(recordPath, JSON.stringify({ status: "failed", startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), recoverySeconds: Number(((finishedAt - startedAt) / 1000).toFixed(3)), failure: "backup_or_restore_failed" }, null, 2));
  throw error;
} finally {
  await Promise.allSettled([sourceClient.end(), restoredClient.end()]);
  await rm(backupPath, { force: true });
}
