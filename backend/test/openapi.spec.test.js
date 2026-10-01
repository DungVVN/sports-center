import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openApiSpec } from "../src/openapi/spec.js";
import { routeSourceFiles } from "./helpers/route-source-files.js";
import { pageCreateSchema, pageDraftSchema, menuDraftSchema } from "../src/modules/site/domain/site-content.js";

const modulesDirectory = fileURLToPath(new URL("../src/modules/", import.meta.url));
const mounts = { "auth.routes.js": "/auth", "staff.routes.js": "/staff", "member.routes.js": "/members" };
const methods = ["get", "post", "patch", "put", "delete"];

function backendOperations() {
  const operations = ["GET /health"];
  for (const path of routeSourceFiles(modulesDirectory)) {
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(/router\.(get|post|patch|put|delete)\(\s*"([^"]+)"/g)) {
      const route = `${mounts[basename(path)] ?? ""}${match[2]}`.replace(/:([A-Za-z]+)/g, "{$1}").replace(/\/$/, "");
      operations.push(`${match[1].toUpperCase()} ${route}`);
    }
  }
  return operations.sort();
}

describe("OpenAPI contract", () => {
  it("provides CMS examples accepted by the actual request validators", () => {
    for (const [path, method, schema] of [
      ["/admin/site/pages", "post", pageCreateSchema],
      ["/admin/site/pages/{routeKey}/draft", "put", pageDraftSchema],
      ["/admin/site/menus/{location}/draft", "put", menuDraftSchema],
    ]) {
      const example = openApiSpec.paths[path][method].requestBody.content["application/json"].example;
      expect(schema.safeParse(example).success).toBe(true);
    }
  });
  it("resolves every schema reference in the CMS contract", () => {
    const visit = (node) => {
      if (!node || typeof node !== "object") return;
      if (node.$ref?.startsWith("#/components/schemas/")) expect(openApiSpec.components.schemas[node.$ref.split("/").at(-1)]).toBeDefined();
      for (const value of Object.values(node)) visit(value);
    };
    for (const [path, item] of Object.entries(openApiSpec.paths)) if (path.includes("/site/")) visit(item);
    for (const [name, schema] of Object.entries(openApiSpec.components.schemas)) if (name.startsWith("Site")) visit(schema);
  });
  it("documents CMS portal authentication and draft publication boundaries", () => {
    expect(openApiSpec.components.securitySchemes.adminSessionCookie.name).toBe("sports_center_admin_session");
    for (const [path, item] of Object.entries(openApiSpec.paths)) {
      if (!path.includes("/site/")) continue;
      for (const method of methods) {
        const operation = item[method];
        if (!operation) continue;
        expect(operation.security).toEqual(path.startsWith("/admin/") ? [{ adminSessionCookie: [] }, { sessionBearer: [] }] : []);
        expect(operation.responses[200].content["application/json"].schema.properties.data).toBeDefined();
        if (path.startsWith("/admin/") && ["put", "post"].includes(method) && !path.endsWith("/signature") && !(path.endsWith("/draft") && method === "post")) expect(operation.requestBody).toBeDefined();
      }
    }
    expect(openApiSpec.components.schemas.SiteMenuDraftRequest.properties.editRevision.minimum).toBe(0);
    expect(openApiSpec.components.schemas.SitePublishRequest.properties.editRevision.minimum).toBe(1);
    expect(openApiSpec.paths["/admin/site/pages/{routeKey}/publish"].post.responses[409]).toBeDefined();
  });
  it("documents the unauthenticated public package response", () => {
    const operation = openApiSpec.paths["/public/membership-packages"].get;
    expect(operation.security).toEqual([]);
    expect(operation.responses[200].content["application/json"].schema.properties.data.items.required).toEqual(["code", "name", "priceVnd", "durationDays", "benefits"]);
  });
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

  it("documents the facility write responses with their actual API field names", () => {
    for (const [path, method, status, field] of [
      ["/facility-types", "post", 201, "is_active"],
      ["/facilities", "post", 201, "open_minute"],
      ["/facility-days", "post", 201, "open_on"],
      ["/facility-reservations", "post", 201, "requested_start_minute"],
      ["/facility-reservations/{id}/review", "patch", 200, "assigned_start_minute"],
      ["/facility-reservations/{id}/cancel", "patch", 200, "decision_reason"],
    ]) {
      const data = openApiSpec.paths[path][method].responses[status].content["application/json"].schema.properties.data;
      expect(data.properties[field]).toBeDefined();
    }
  });
});
