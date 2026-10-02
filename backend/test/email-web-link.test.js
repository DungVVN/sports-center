import { describe, expect, it } from "vitest";
import { emailWebLink } from "../src/shared/email/web-link.js";

describe("email web links", () => {
  it.each(["/support", "/my/training", "/my/attendance", "/my/memberships", "/my/payments", "/bookings", "/classes", "/pt", "/courses", "/facilities", "/login"])("uses the public web domain for %s regardless of CORS order", (path) => {
    expect(emailWebLink(path, { corsOrigins: ["http://localhost:5173", "https://admin.kineticsports.io.vn"] })).toBe(`https://kineticsports.io.vn${path}`);
  });
  it("supports an explicit staging web origin and preserves query and fragment", () => {
    expect(emailWebLink("/support?ticket=qa#reply", { publicWebOrigin: "https://staging.example.com/" })).toBe("https://staging.example.com/support?ticket=qa#reply");
  });
  it.each(["http://localhost:5173", "https://localhost", "https://127.0.0.1", "https://[::1]", "https://user:pass@example.com", "https://example.com/api"])("rejects an invalid email origin %s", (publicWebOrigin) => {
    expect(() => emailWebLink("/support", { publicWebOrigin })).toThrow();
  });
  it.each(["//localhost:5173", "/\\localhost:5173", "http://localhost:5173/support", "https://external.example/support"])("rejects an external or malformed stored path %s", (path) => {
    expect(() => emailWebLink(path, {})).toThrow();
  });
});
