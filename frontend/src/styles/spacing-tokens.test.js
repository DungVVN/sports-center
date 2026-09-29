import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const stylesRoot = join(import.meta.dirname, "..");

function cssFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? cssFiles(path) : entry.name.endsWith(".css") ? [path] : [];
  });
}

describe("shared spacing tokens", () => {
  it("defines every spacing token used by frontend CSS", () => {
    const definitions = readFileSync(join(import.meta.dirname, "tokens.css"), "utf8");
    const defined = new Set([...definitions.matchAll(/(--space-\d+):/g)].map((match) => match[1]));
    const missing = cssFiles(stylesRoot).flatMap((path) => {
      const css = readFileSync(path, "utf8");
      return [...css.matchAll(/var\((--space-\d+)\)/g)]
        .filter((match) => !defined.has(match[1]))
        .map((match) => `${path}: ${match[1]}`);
    });

    expect(missing).toEqual([]);
  });
});
