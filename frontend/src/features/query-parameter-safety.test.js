import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../shared/api/client.js";
import { bookingApi } from "./bookings/api/booking-api.js";
import { classApi } from "./classes/api/class-api.js";
import { membershipApi } from "./memberships/api/membership-api.js";
import { paymentApi } from "./payments/api/payment-api.js";
import { trainingApi } from "./training/api/training-api.js";

vi.mock("../shared/api/client.js", () => ({ apiClient: { get: vi.fn() } }));

describe("optional query parameters", () => {
  beforeEach(() => { vi.clearAllMocks(); apiClient.get.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 100, total: 0 } }); });

  it("never serializes a React Query context object into an API URL", async () => {
    const queryContext = { queryKey: ["query"], signal: new AbortController().signal };

    trainingApi.plans(queryContext);
    bookingApi.list(queryContext);
    const payments = paymentApi.list(queryContext);
    classApi.changeRequests(queryContext);
    membershipApi.freezeRequests(queryContext);

    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/training-plans");
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/bookings");
    await payments;
    expect(apiClient.get).toHaveBeenNthCalledWith(3, "/payments?page=1&pageSize=100", { includeMeta: true });
    expect(apiClient.get).toHaveBeenNthCalledWith(4, "/class-change-requests?status=pending");
    expect(apiClient.get).toHaveBeenNthCalledWith(5, "/membership-freeze-requests?status=pending");
    expect(apiClient.get.mock.calls.map(([path]) => path).join(" ")).not.toContain("[object Object]");
  });

  it("keeps valid query values encoded", () => {
    trainingApi.plans("member 01");
    classApi.changeRequests("pending review");

    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/training-plans?memberId=member%2001");
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/class-change-requests?status=pending%20review");
  });
});
