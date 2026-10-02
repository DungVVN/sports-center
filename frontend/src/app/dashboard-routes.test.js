import { describe, expect, it } from "vitest";
import { dashboardPath, dashboardView, isDashboardView } from "./dashboard-routes.js";

describe("dashboard routes", () => {
  it("restores each facility tab from its own URL", () => {
    for (const [view, path] of [["facility-calendar", "/facilities"], ["facility-reservations", "/facilities/reservations"], ["facility-settings", "/facilities/settings"]]) {
      expect(dashboardPath(view)).toBe(path);
      expect(dashboardView(path)).toBe(view);
    }
  });
  it("maps every membership workspace view to a stable URL", () => {
    expect(dashboardPath("packageCreate")).toBe("/packages/create");
    expect(dashboardPath("packageCatalog")).toBe("/packages/catalog");
    expect(dashboardPath("memberMemberships")).toBe("/memberships/assign");
  });

  it("maps dashboard URLs back to workspace views", () => {
    expect(dashboardView("/classes")).toBe("classes");
    expect(dashboardView("/my/payments")).toBe("my-payments");
    expect(dashboardView("/unknown")).toBeNull();
    expect(isDashboardView("packageCreate")).toBe(true);
    expect(isDashboardView("login")).toBe(false);
  });
});
