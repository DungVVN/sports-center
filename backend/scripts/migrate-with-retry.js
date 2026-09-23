import { spawn } from "node:child_process";

const configuredMaxAttempts = Number.parseInt(process.env.PRISMA_MIGRATE_MAX_ATTEMPTS ?? "5", 10);
const maxAttempts = Number.isInteger(configuredMaxAttempts) && configuredMaxAttempts > 0
  ? configuredMaxAttempts
  : 5;
const retryDelaysMs = [3000, 5000, 10000, 15000];

function runMigration() {
  return new Promise((resolve, reject) => {
    const child = spawn("prisma", ["migrate", "deploy"], {
      env: process.env,
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

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const result = await runMigration();
  if (result.code === 0) process.exit(0);

  const isAdvisoryLockTimeout = result.output.includes("P1002") && result.output.includes("advisory lock");
  if (!isAdvisoryLockTimeout || attempt === maxAttempts) process.exit(result.code ?? 1);

  const delay = retryDelaysMs[Math.min(attempt - 1, retryDelaysMs.length - 1)];
  console.warn(`Migration lock is busy. Retrying ${attempt + 1}/${maxAttempts} in ${delay / 1000}s.`);
  await wait(delay);
}
