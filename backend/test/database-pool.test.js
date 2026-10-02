import { EventEmitter } from "node:events";
import pg from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabasePool } from "../src/database-pool.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("database connection acquisition", () => {
  it("recovers a connection timeout before running any SQL", async () => {
    vi.useFakeTimers();
    const client = { release: vi.fn() };
    const connect = vi.spyOn(pg.Pool.prototype, "connect").mockRejectedValueOnce(new Error("Connection terminated due to connection timeout")).mockResolvedValueOnce(client);
    const result = new DatabasePool().connect();
    await vi.runAllTimersAsync();
    expect(await result).toBe(client);
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it("bounds repeated connection failures to two attempts", async () => {
    vi.useFakeTimers();
    const error = Object.assign(new Error("Connection refused"), { code: "ECONNREFUSED" });
    const connect = vi.spyOn(pg.Pool.prototype, "connect").mockRejectedValue(error);
    const result = expect(new DatabasePool().connect()).rejects.toBe(error);
    await vi.runAllTimersAsync();
    await result;
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it("does not retry authentication failures", async () => {
    const error = Object.assign(new Error("Invalid password"), { code: "28P01" });
    const connect = vi.spyOn(pg.Pool.prototype, "connect").mockRejectedValue(error);
    await expect(new DatabasePool().connect()).rejects.toBe(error);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("preserves callback acquisition and release", async () => {
    const client = { release: vi.fn() };
    vi.spyOn(pg.Pool.prototype, "connect").mockResolvedValue(client);
    await new Promise((resolve, reject) => new DatabasePool().connect((error, received, release) => {
      if (error) return reject(error);
      expect(received).toBe(client);
      release();
      resolve();
    }));
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("never replays a query after its connection fails during execution", async () => {
    const error = Object.assign(new Error("Connection reset"), { code: "ECONNRESET" });
    const client = Object.assign(new EventEmitter(), { release: vi.fn(), query: vi.fn((_sql, _values, callback) => callback(error)) });
    const connect = vi.spyOn(pg.Pool.prototype, "connect").mockResolvedValue(client);
    await expect(new DatabasePool().query("INSERT INTO example VALUES (1)")).rejects.toBe(error);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledTimes(1);
  });
});
