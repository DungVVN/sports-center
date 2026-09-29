import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceRoots = [
  join(root, "backend", "src", "modules", "support"),
  join(root, "backend", "src", "modules", "notifications"),
  join(root, "frontend", "src", "features"),
  join(root, "frontend", "src", "app", "composition"),
  join(root, "frontend", "src", "shared"),
];
const errors = [];

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : entry.isFile() && /\.[cm]?[jt]sx?$/.test(path) ? [path] : [];
  });
}

for (const legacyRoot of ["api", "components", "contexts", "hooks", "lib", "pages", "utils"]) {
  const directory = join(root, "frontend", "src", legacyRoot);
  if (existsSync(directory) && filesUnder(directory).length) {
    errors.push(`${directory}: product code remains outside app/features/shared`);
  }
}

for (const file of sourceRoots.flatMap(filesUnder)) {
  const source = readFileSync(file, "utf8");
  const supportInfrastructure = join(root, "backend", "src", "modules", "support", "infrastructure") + sep;
  if (file.startsWith(supportInfrastructure) && /\bprisma\.(?:members|notifications)\b/.test(source)) {
    errors.push(`${file}: Support repository accesses another module's table`);
  }
  const paths = [...source.matchAll(/(?:\b(?:import|export)\s+(?:[^'"\n]*?\s+from\s*)?|\bimport\s*\()\s*["']([^"']+)["']/g)].map((match) => match[1]);
  for (const specifier of paths) {
    const target = specifier.startsWith(".") ? resolve(file, "..", specifier) : specifier;
    const backendApplications = ["support", "notifications"].map((name) => join(root, "backend", "src", "modules", name, "application") + sep);
    const backendPresentations = ["support", "notifications"].map((name) => join(root, "backend", "src", "modules", name, "presentation") + sep);
    const frontendShared = join(root, "frontend", "src", "shared") + sep;
    const frontendFeatures = join(root, "frontend", "src", "features") + sep;
    const frontendApp = join(root, "frontend", "src", "app") + sep;
    if (backendApplications.some((directory) => file.startsWith(directory)) && (specifier === "express" || target.includes(`${sep}infrastructure${sep}`) || target.endsWith(`${sep}database.js`) || specifier.startsWith("@prisma/"))) {
      errors.push(`${file}: application imports runtime/data dependency ${specifier}`);
    }
    if (backendPresentations.some((directory) => file.startsWith(directory)) && (target.endsWith(`${sep}database.js`) || target.includes(`${sep}infrastructure${sep}`))) {
      errors.push(`${file}: presentation imports persistence ${specifier}`);
    }
    if (file.startsWith(frontendShared) && (target.includes(`${sep}features${sep}`) || target.includes(`${sep}app${sep}`))) {
      errors.push(`${file}: shared imports product layer ${specifier}`);
    }
    if (file.startsWith(frontendFeatures) && target.startsWith(frontendApp)) {
      errors.push(`${file}: feature imports app composition ${specifier}`);
    }
    const migratedOwner = ["site", "support"]
      .map((name) => join(frontendFeatures, name) + sep)
      .find((directory) => file.startsWith(directory));
    if (migratedOwner && target.startsWith(frontendFeatures) && !target.startsWith(migratedOwner) && !target.endsWith(`${sep}index.js`)) {
      errors.push(`${file}: feature deep-imports another feature ${specifier}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Migrated module boundaries passed (Support, Notifications, Site, Auth, app composition and frontend shared).");
}
