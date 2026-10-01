import { mkdir, copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const source = dirname(require.resolve("swagger-ui-dist/package.json"));
const destination = new URL("../.wrangler/swagger-assets/", import.meta.url);
await mkdir(destination, { recursive: true });
for (const name of ["swagger-ui.css", "swagger-ui-bundle.js", "swagger-ui-standalone-preset.js"]) {
  await copyFile(join(source, name), new URL(name, destination));
}
console.log("Worker Swagger assets prepared from installed dependencies.");
