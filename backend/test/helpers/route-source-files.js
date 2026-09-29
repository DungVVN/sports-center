import { readdirSync } from "node:fs";
import { join } from "node:path";

export function routeSourceFiles(modulesDirectory) {
  const files = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.endsWith(".routes.js")) files.push(path);
    }
  }
  visit(modulesDirectory);
  return files;
}
