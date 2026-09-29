import { describe, expect, it } from "vitest";
import { portalSurfaceForHostname } from "./portal.js";

describe("portal hostname", () => {
  it("keeps the public domains on the main portal even when a shared build has the Admin flag", () => {
    expect(portalSurfaceForHostname("www.kineticsports.io.vn", true)).toBe("main");
    expect(portalSurfaceForHostname("kineticsports.io.vn", true)).toBe("main");
  });

  it("selects the Admin portal only for the Admin hostname or an explicitly configured preview", () => {
    expect(portalSurfaceForHostname("admin.kineticsports.io.vn", false)).toBe("admin");
    expect(portalSurfaceForHostname("localhost", true)).toBe("admin");
  });
});
