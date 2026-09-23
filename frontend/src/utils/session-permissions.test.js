import { describe, expect, it } from "vitest";
import { hasSessionPermission } from "./session-permissions.js";

describe("hasSessionPermission", () => {
  it("does not restrict Admin based on the session permission list", () => {
    expect(hasSessionPermission({ user: { role: "admin" }, permissions: [] }, "facility.manage")).toBe(true);
  });

  it("uses the permission list for non-Admin roles", () => {
    expect(hasSessionPermission({ user: { role: "manager" }, permissions: [] }, "facility.manage")).toBe(false);
    expect(hasSessionPermission({ user: { role: "manager" }, permissions: ["facility.manage"] }, "facility.manage")).toBe(true);
  });
});
