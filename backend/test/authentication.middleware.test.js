import { describe, expect, it, vi } from "vitest";
import { requirePermission } from "../src/shared/auth/authentication.middleware.js";
import { AppError } from "../src/shared/errors/app-error.js";

describe("requirePermission", () => {
  it("always permits an authenticated Admin", () => {
    const next = vi.fn();

    requirePermission("facility.manage")({ auth: { user: { role: "admin" }, permissions: [] } }, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("still rejects a non-Admin without the required permission", () => {
    const next = vi.fn();

    requirePermission("facility.manage")({ auth: { user: { role: "manager" }, permissions: [] } }, {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});
