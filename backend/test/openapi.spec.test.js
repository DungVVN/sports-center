import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openApiSpec } from "../src/openapi/spec.js";

const modulesDirectory = fileURLToPath(new URL("../src/modules/", import.meta.url));
const mounts = { "auth.routes.js": "/auth", "staff.routes.js": "/staff", "member.routes.js": "/members" };
const methods = ["get", "post", "patch", "put", "delete"];

function backendOperations() {
  const operations = ["GET /health"];
  for (const moduleName of readdirSync(modulesDirectory)) {
    const moduleDirectory = join(modulesDirectory, moduleName);
    for (const filename of readdirSync(moduleDirectory).filter((name) => name.endsWith(".routes.js"))) {
      const source = readFileSync(join(moduleDirectory, filename), "utf8");
      for (const match of source.matchAll(/router\.(get|post|patch|put|delete)\(\s*"([^"]+)"/g)) {
        const route = `${mounts[filename] ?? ""}${match[2]}`.replace(/:([A-Za-z]+)/g, "{$1}").replace(/\/$/, "");
        operations.push(`${match[1].toUpperCase()} ${route}`);
      }
    }
  }
  return operations.sort();
}

describe("OpenAPI contract", () => {
  it("documents every mounted backend operation without advertising nonexistent operations", () => {
    const documented = Object.entries(openApiSpec.paths)
      .flatMap(([path, item]) => methods.filter((method) => item[method]).map((method) => `${method.toUpperCase()} ${path}`))
      .sort();
    expect(documented).toEqual(backendOperations());
  });

  it("declares every path parameter required by the path template", () => {
    for (const [path, item] of Object.entries(openApiSpec.paths)) {
      const names = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
      for (const method of methods) {
        if (!item[method]) continue;
        for (const name of names) {
          expect(item[method].parameters).toContainEqual(expect.objectContaining({ name, in: "path", required: true }));
        }
      }
    }
  });

  it("exposes the new onboarding contract and write request bodies", () => {
    expect(openApiSpec.paths["/auth/me"].get.responses[200].content["application/json"].schema.$ref).toBe("#/components/schemas/CurrentSessionResponse");
    expect(openApiSpec.components.schemas.AuthUser.properties.profileSetupRequired.type).toBe("boolean");
    for (const [path, method] of [["/auth/password/change", "post"], ["/training-plans/{id}/sessions", "post"], ["/payments", "post"], ["/staff", "post"], ["/attendance/check-in", "post"]]) {
      expect(openApiSpec.paths[path][method].requestBody.content["application/json"].schema).toBeDefined();
    }
  });
});
