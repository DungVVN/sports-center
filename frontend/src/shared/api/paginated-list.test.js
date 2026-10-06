import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client.js";
import { readListChoices, readListPage } from "./paginated-list.js";

vi.mock("./client.js", () => ({ apiClient: { get: vi.fn() } }));
describe("paginated lists", () => {
  beforeEach(() => vi.resetAllMocks());
  it("keeps selections outside the first page without an unbounded request", async () => {
    apiClient.get.mockResolvedValueOnce({ items: [{ id: "first" }], meta: { total: 101, page: 1, pageSize: 100 } }).mockResolvedValueOnce({ items: [{ id: "last" }], meta: { total: 101, page: 2, pageSize: 100 } });
    expect(await readListChoices("/members")).toEqual([{ id: "first" }, { id: "last" }]);
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/members?page=2&pageSize=100", { includeMeta: true });
  });
  it("encodes multi-select filters as repeated parameters", async () => {
    apiClient.get.mockResolvedValue({ items: [], meta: { total: 0 } });
    await readListPage("/members", { page: 2, search: "An & Bình", status: ["active", "frozen"] });
    const query = new URL(apiClient.get.mock.calls[0][0], "http://localhost").searchParams;
    expect(query.getAll("status")).toEqual(["active", "frozen"]);
    expect(query.get("search")).toBe("An & Bình");
  });
});
