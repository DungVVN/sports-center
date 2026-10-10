import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { importSpecifiers, resolveImport, dependencyCycles } from "./architecture-analysis.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const backendModules = join(root, "backend", "src", "modules") + sep;
const sourceRoots = [join(root, "backend", "src"), join(root, "frontend", "src")];
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

const sourceFiles = sourceRoots.flatMap(filesUnder);
const fileSet = new Set(sourceFiles);
const graph = new Map();
for (const file of sourceFiles) {
  const source = readFileSync(file, "utf8");
  if (file.startsWith(backendModules)) {
    const moduleRoot = join(backendModules, file.slice(backendModules.length).split(sep)[0]);
    if (dirname(file) === moduleRoot && basename(file) !== "index.js") {
      errors.push(`${file}: module root may only expose index.js`);
    }
  }
  const frontendFeaturesRoot = join(root, "frontend", "src", "features") + sep;
  if (file.startsWith(frontendFeaturesRoot)) {
    const featureRoot = join(frontendFeaturesRoot, file.slice(frontendFeaturesRoot.length).split(sep)[0]);
    if (dirname(file) === featureRoot && basename(file) !== "index.js") {
      errors.push(`${file}: feature root may only expose index.js`);
    }
  }
  const supportInfrastructure = join(root, "backend", "src", "modules", "support", "infrastructure") + sep;
  if (file.startsWith(supportInfrastructure) && /\bprisma\.(?:members|notifications)\b/.test(source)) {
    errors.push(`${file}: Support repository accesses another module's table`);
  }
  const paths = importSpecifiers(source);
  const dependencies = [];
  for (const specifier of paths) {
    const target = resolveImport(file, specifier, join(root, "frontend", "src"), fileSet);
    if (fileSet.has(target) && !/\.test\.[cm]?[jt]sx?$/.test(target)) dependencies.push(target);
    const backendApplication = file.startsWith(backendModules) && file.includes(`${sep}application${sep}`);
    const backendPresentation = file.startsWith(backendModules) && file.includes(`${sep}presentation${sep}`);
    const frontendShared = join(root, "frontend", "src", "shared") + sep;
    const frontendFeatures = join(root, "frontend", "src", "features") + sep;
    const frontendApp = join(root, "frontend", "src", "app") + sep;
    const backendDomain = file.startsWith(backendModules) && file.includes(`${sep}domain${sep}`);
    const frontendDomain = file.startsWith(frontendFeatures) && file.includes(`${sep}domain${sep}`);
    if (backendDomain && (specifier === "express" || specifier.startsWith("@prisma/") ||
      /[\\/](?:application|presentation|infrastructure|app|worker)[\\/]/.test(target) ||
      /[\\/]database(?:-pool|-url)?\.js$/.test(target))) {
      errors.push(`${file}: domain imports runtime/product dependency ${specifier}`);
    }
    if (frontendDomain && (specifier === "react" || specifier.startsWith("@tanstack/") ||
      /[\\/](?:ui|api|app)[\\/]/.test(target))) {
      errors.push(`${file}: domain imports UI/HTTP dependency ${specifier}`);
    }
    if (backendApplication && (specifier === "express" || target.includes(`${sep}infrastructure${sep}`) || target.endsWith(`${sep}database.js`) || specifier.startsWith("@prisma/"))) {
      errors.push(`${file}: application imports runtime/data dependency ${specifier}`);
    }
    if (backendPresentation && (target.endsWith(`${sep}database.js`) || target.includes(`${sep}infrastructure${sep}`))) {
      errors.push(`${file}: presentation imports persistence ${specifier}`);
    }
    if (file.startsWith(backendModules) && target.startsWith(backendModules)) {
      const owner = file.slice(backendModules.length).split(sep)[0];
      const dependency = target.slice(backendModules.length).split(sep)[0];
      if (owner !== dependency && !target.endsWith(`${sep}index.js`)) {
        errors.push(`${file}: module deep-imports another module ${specifier}`);
      }
    }
    if (file.startsWith(frontendShared) && (target.includes(`${sep}features${sep}`) || target.includes(`${sep}app${sep}`))) {
      errors.push(`${file}: shared imports product layer ${specifier}`);
    }
    if (file.startsWith(frontendFeatures) && target.startsWith(frontendApp)) {
      errors.push(`${file}: feature imports app composition ${specifier}`);
    }
    const featureParts = file.startsWith(frontendFeatures) ? file.slice(frontendFeatures.length).split(sep) : [];
    const featureOwner = featureParts.length > 1 ? featureParts[0] : null;
    const featureDependency = target.startsWith(frontendFeatures) ? target.slice(frontendFeatures.length).split(sep)[0] : null;
    if (featureOwner && featureDependency && featureOwner !== featureDependency && !target.endsWith(`${sep}index.js`)) {
      errors.push(`${file}: feature deep-imports another feature ${specifier}`);
    }
  }
  if (!/\.test\.[cm]?[jt]sx?$/.test(file)) graph.set(file, dependencies);
}

for (const cycle of dependencyCycles(graph)) {
  errors.push(`Circular source dependency: ${cycle.map((file) => file.slice(root.length + 1)).join(" -> ")}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Backend/frontend boundaries, domain isolation and source dependency cycles passed.");
}
