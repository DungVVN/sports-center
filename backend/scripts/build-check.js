import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const sourceRoot = new URL("../src/", import.meta.url);

async function collectJavaScriptFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryUrl = new URL(entry.name, directoryUrl);
    if (entry.isDirectory()) {
      files.push(...await collectJavaScriptFiles(new URL(`${entry.name}/`, directoryUrl)));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(entryUrl);
    }
  }

  return files;
}

const files = await collectJavaScriptFiles(sourceRoot);
for (const fileUrl of files) {
  const result = spawnSync(process.execPath, ["--check", fileURLToPath(fileUrl)], { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Build check passed for ${files.length} backend JavaScript files.`);
