import { createContainer } from "../container.mjs";
import { runMigrations } from "../infrastructure/postgres.mjs";

const container = createContainer();
try {
  await runMigrations(container.pool);
  await container.hashKeyAttestationCheck();
  const full = process.argv.includes("--full");
  const result = await container.reconcileService.run({ full });
  container.logger.info(result, "one-shot reconciliation completed");
} finally {
  await container.pool.end();
}
