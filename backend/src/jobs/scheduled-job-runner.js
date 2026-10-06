export function createScheduledJobRunner({ name, run, logger = console }) {
  let running = false;

  return async function runOnce() {
    if (running) return;
    running = true;
    try {
      await run();
    } catch {
      logger.error({ event: "scheduled_job_failed", job: name });
    } finally {
      running = false;
    }
  };
}
