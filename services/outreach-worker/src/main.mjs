import { startApi } from "./api.mjs";
import { createContainer } from "./container.mjs";
import { runMigrations } from "./infrastructure/postgres.mjs";
import { startWorker } from "./worker.mjs";

const abortController = new AbortController();
let forceExitTimer;
for (const signalName of ["SIGTERM", "SIGINT"]) {
  process.once(signalName, () => {
    abortController.abort(new Error(`Received ${signalName}`));
    armForcedExit(25_000, signalName);
  });
}

let container;
let api;
let worker;
try {
  container = createContainer({ signal: abortController.signal });
  await runMigrations(container.pool);
  await container.hashKeyAttestationCheck();
  if (["all", "api"].includes(container.config.processMode)) {
    api = await startApi({ ...container, signal: abortController.signal });
  }
  if (["all", "worker"].includes(container.config.processMode)) {
    worker = startWorker(container, { signal: abortController.signal });
  }
  await waitForAbort(abortController.signal);
} catch (error) {
  container?.logger?.fatal({ err: error }, "outreach process failed");
  process.exitCode = 1;
} finally {
  abortController.abort();
  const shutdownTimeoutMs = Math.min(container?.config?.schedules?.shutdownTimeoutMs ?? 25_000, 25_000);
  armForcedExit(shutdownTimeoutMs, "shutdown_deadline");
  await Promise.allSettled([
    api?.close(),
    worker?.shutdown({ timeoutMs: shutdownTimeoutMs })
  ]);
  await container?.pool?.end().catch(() => {});
  if (forceExitTimer) clearTimeout(forceExitTimer);
}

function waitForAbort(signal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
}

function armForcedExit(timeoutMs, reason) {
  if (forceExitTimer) return;
  forceExitTimer = setTimeout(() => {
    container?.logger?.fatal({ reason, timeoutMs }, "outreach shutdown deadline exceeded");
    process.exit(1);
  }, Math.min(timeoutMs, 25_000));
}
