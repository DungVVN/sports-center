import { describe, expect, it, vi } from "vitest";
import { createScheduledJobRunner } from "../src/jobs/scheduled-job-runner.js";

describe("scheduled job runner", () => {
  it("skips overlapping ticks and permits a later run after completion", async () => {
    let finish;
    const run = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const runOnce = createScheduledJobRunner({ name: "test_job", run });
    const first = runOnce();
    await Promise.all([runOnce(), runOnce()]);
    expect(run).toHaveBeenCalledTimes(1);
    finish();
    await first;
    await runOnce();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("redacts failure details and permits the next scheduled retry", async () => {
    const logger = { error: vi.fn() };
    const run = vi.fn().mockRejectedValueOnce(new Error("postgres://secret; email=private@example.com"));
    const runOnce = createScheduledJobRunner({ name: "membership_lifecycle", run, logger });
    await runOnce();
    expect(logger.error).toHaveBeenCalledExactlyOnceWith({ event: "scheduled_job_failed", job: "membership_lifecycle" });
    await runOnce();
    expect(run).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("handles synchronous exceptions without leaving the job locked", async () => {
    const logger = { error: vi.fn() };
    const run = vi.fn().mockImplementationOnce(() => { throw new Error("private payload"); });
    const runOnce = createScheduledJobRunner({ name: "test_job", run, logger });
    await runOnce();
    await runOnce();
    expect(run).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledExactlyOnceWith({ event: "scheduled_job_failed", job: "test_job" });
  });
});
