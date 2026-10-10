import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

// Use the declared backend ESLint dependency to parse both JavaScript and JSX.
const require = createRequire(new URL("../backend/package.json", import.meta.url));
const { Linter } = require("eslint");
const linter = new Linter();

export function importSpecifiers(source) {
  const paths = [];
  const add = (node) => {
    if (typeof node?.value === "string") paths.push(node.value);
  };
  const diagnostics = linter.verify(source, [{
    languageOptions: { ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { architecture: { rules: { imports: { create: () => ({
      ImportDeclaration: (node) => add(node.source),
      ExportNamedDeclaration: (node) => add(node.source),
      ExportAllDeclaration: (node) => add(node.source),
      ImportExpression: (node) => add(node.source),
    }) } } } },
    rules: { "architecture/imports": "error" },
  }]);
  const fatal = diagnostics.find((item) => item.fatal);
  if (fatal) throw new Error(`Cannot parse source at ${fatal.line}:${fatal.column}: ${fatal.message}`);
  return paths;
}

export function resolveImport(file, specifier, frontendSource, files) {
  const target = specifier.startsWith(".") ? resolve(dirname(file), specifier)
    : specifier.startsWith("@/") ? resolve(frontendSource, specifier.slice(2)) : null;
  if (!target) return specifier;
  return [target, `${target}.js`, `${target}.jsx`, resolve(target, "index.js"), resolve(target, "index.jsx")]
    .find((candidate) => files.has(candidate)) ?? target;
}

export function dependencyCycles(graph) {
  const active = new Set();
  const visited = new Set();
  const stack = [];
  const cycles = [];
  function visit(file) {
    if (active.has(file)) {
      cycles.push([...stack.slice(stack.indexOf(file)), file]);
      return;
    }
    if (visited.has(file)) return;
    visited.add(file);
    active.add(file);
    stack.push(file);
    for (const dependency of graph.get(file) ?? []) visit(dependency);
    stack.pop();
    active.delete(file);
  }
  for (const file of graph.keys()) visit(file);
  return cycles;
}
