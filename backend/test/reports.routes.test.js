import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

function authService(permissions) { return { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "manager-1", role: "manager" }, permissions }) }; }
function insightService() { return { notifications: vi.fn().mockResolvedValue([]), markRead: vi.fn(), dashboard: vi.fn(), revenue: vi.fn().mockResolvedValue({ paid: "0", payments: 0 }), attendance: vi.fn(), exportReport: vi.fn().mockResolvedValue({ filename: "bao-cao.csv", content: "Báo cáo" }) }; }
describe("Revenue report route", () => {
  it("passes a validated reporting period to the manager dashboard", async () => { const service = insightService(); await request(createApp({ authService: authService([]), insightService: service })).get("/api/v1/dashboards/manager?period=quarter").set("Authorization", "Bearer token").expect(200); expect(service.dashboard).toHaveBeenCalledWith("manager", { id: "manager-1", role: "manager" }, { period: "quarter" }); });
  it("passes a validated monthly period to the reporting service", async () => { const service = insightService(); await request(createApp({ authService: authService(["report.read"]), insightService: service })).get("/api/v1/reports/revenue?period=month").set("Authorization", "Bearer token").expect(200); expect(service.revenue).toHaveBeenCalledWith({ period: "month" }); });
  it("requires explicit dates for custom period", async () => { const service = insightService(); await request(createApp({ authService: authService(["report.read"]), insightService: service })).get("/api/v1/reports/revenue?period=custom").set("Authorization", "Bearer token").expect(422); expect(service.revenue).not.toHaveBeenCalled(); });
  it("exports a filtered report as UTF-8 CSV", async () => { const service = insightService(); const response = await request(createApp({ authService: authService(["report.read"]), insightService: service })).get("/api/v1/reports/attendance/export?period=month&coachUserId=00000000-0000-4000-8000-000000000001").set("Authorization", "Bearer token").expect(200); expect(response.headers["content-type"]).toContain("text/csv"); expect(service.exportReport).toHaveBeenCalledWith("attendance", { period: "month", coachUserId: "00000000-0000-4000-8000-000000000001" }); });
});
