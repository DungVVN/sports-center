import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import { dependencyCycles, importSpecifiers, resolveImport } from "./architecture-analysis.mjs";

test("collects multiline imports, re-exports and literal dynamic imports in JSX", () => {
  assert.deepEqual(importSpecifiers(`
    import { first,
      second } from "./module.js";
    export { value } from "./exports.js";
    export * from "./all.js";
    const page = import("@/features/site/index.js");
    const element = <div>{first}{second}</div>;
  `), ["./module.js", "./exports.js", "./all.js", "@/features/site/index.js"]);
});

test("ignores import-looking comments, strings and computed runtime imports", () => {
  assert.deepEqual(importSpecifiers(`
    // import wrong from "./comment.js";
    const text = 'import wrong from "./string.js"';
    const page = import(text);
  `), []);
});

test("reports malformed source instead of silently skipping dependency checks", () => {
  assert.throws(() => importSpecifiers("import { from"), /Cannot parse source/);
});

test("resolves frontend aliases, relative extensionless files and directory entries", () => {
  const source = resolve("frontend/src");
  const file = resolve(source, "features/a/ui/Page.jsx");
  const api = resolve(source, "features/a/api/client.js");
  const feature = resolve(source, "features/b/index.js");
  const files = new Set([api, feature]);
  assert.equal(resolveImport(file, "../api/client", source, files), api);
  assert.equal(resolveImport(file, "@/features/b", source, files), feature);
  assert.equal(resolveImport(file, "react", source, files), "react");
});

test("detects source cycles including self imports and dynamic import edges", () => {
  const graph = new Map([["a", ["b"]], ["b", ["c"]], ["c", ["a"]], ["self", ["self"]]]);
  assert.deepEqual(dependencyCycles(graph), [["a", "b", "c", "a"], ["self", "self"]]);
});

test("allows shared dependencies and imports without further source edges", () => {
  assert.deepEqual(dependencyCycles(new Map([["a", ["shared"]], ["b", ["shared", "external"]], ["shared", []]])), []);
});
