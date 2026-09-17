import { createContainer } from "../container.mjs";
import { runMigrations } from "../infrastructure/postgres.mjs";

const controller = new AbortController();
const stop = () => controller.abort(new Error("Outcome reconciliation shutdown requested"));
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

const container = createContainer({ signal: controller.signal });
try {
  await runMigrations(container.pool);
  await container.hashKeyAttestationCheck();
  const result = await container.outcomeReconcileService.run({ signal: controller.signal });
  container.logger.info(result, "one-shot provider outcome reconciliation completed");
} finally {
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  await container.pool.end();
}
