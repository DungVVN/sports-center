import { describe, expect, it } from "vitest";
import { parseEnvBoolean } from "./env.js";

describe("environment boolean parsing", () => {
  it.each([
    ["true", true], ["1", true], ["false", false], ["0", false],
  ])("parses %s as %s", (input, expected) => {
    expect(parseEnvBoolean(input)).toBe(expected);
  });

  it("leaves an invalid value for schema validation", () => {
    expect(parseEnvBoolean("not-a-boolean")).toBe("not-a-boolean");
  });
});
