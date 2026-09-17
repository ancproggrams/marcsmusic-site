import { createContainer } from "../container.mjs";
import { runMigrations } from "../infrastructure/postgres.mjs";

const container = createContainer();
try {
  await runMigrations(container.pool);
  await container.hashKeyAttestationCheck();
  const result = await container.healthService.evaluate();
  container.logger.info(result, "one-shot outreach health check completed");
} finally {
  await container.pool.end();
}
