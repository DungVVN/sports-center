import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { Client } from "pg";

const sourceUrl = process.env.DATABASE_URL;
const verifyUrl = process.env.BACKUP_RESTORE_VERIFY_DATABASE_URL;
const confirmation = process.env.BACKUP_RESTORE_CONFIRM;
const recordPath = process.env.BACKUP_RESTORE_RECORD_PATH ?? join(process.cwd(), "backup-restore-results", `restore-verify-${Date.now()}.json`);

if (!sourceUrl || !verifyUrl) throw new Error("DATABASE_URL và BACKUP_RESTORE_VERIFY_DATABASE_URL là bắt buộc.");
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

const backupDir = join(tmpdir(), "sports-center-backups");
const backupPath = join(backupDir, `restore-verify-${Date.now()}.dump`);
const startedAt = new Date();
await mkdir(backupDir, { recursive: true });
await mkdir(dirname(recordPath), { recursive: true });

try {
  await run("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", `--file=${backupPath}`, sourceUrl]);
  await access(backupPath);
  await run("pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-privileges", `--dbname=${verifyUrl}`, backupPath]);

  const client = new Client({ connectionString: verifyUrl });
  await client.connect();
  const result = await client.query("SELECT 1 AS restored");
  await client.end();
  if (result.rows[0]?.restored !== 1) throw new Error("Database kiểm thử không phản hồi sau restore.");
  const finishedAt = new Date();
  await writeFile(recordPath, JSON.stringify({ status: "passed", startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), recoverySeconds: Number(((finishedAt - startedAt) / 1000).toFixed(3)) }, null, 2));
  console.log(`PASS backup/restore: dump đã khôi phục vào database kiểm thử riêng. Kết quả: ${recordPath}`);
} catch (error) {
  const finishedAt = new Date();
  await writeFile(recordPath, JSON.stringify({ status: "failed", startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), recoverySeconds: Number(((finishedAt - startedAt) / 1000).toFixed(3)), failure: "backup_or_restore_failed" }, null, 2));
  throw error;
} finally {
  await rm(backupPath, { force: true });
}
