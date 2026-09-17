import { createContainer } from "../container.mjs";
import { runMigrations } from "../infrastructure/postgres.mjs";

const REQUIRED_CONFIRMATION = "reviewed-health-and-delivery-unknown";
const reason = String(process.env.OUTREACH_CIRCUIT_RESET_REASON ?? "").trim();

if (process.env.OUTREACH_CIRCUIT_RESET_CONFIRM !== REQUIRED_CONFIRMATION) {
  throw new Error(`Refusing circuit reset: OUTREACH_CIRCUIT_RESET_CONFIRM must equal ${REQUIRED_CONFIRMATION}`);
}
if (reason.length < 12 || reason.length > 240) {
  throw new Error("Refusing circuit reset: OUTREACH_CIRCUIT_RESET_REASON must contain 12-240 characters");
}

const container = createContainer();
try {
  await runMigrations(container.pool);
  await container.hashKeyAttestationCheck();
  const before = await container.repository.getCircuit();
  if (before?.state !== "open") {
    throw new Error("Refusing circuit reset: global send circuit is not open");
  }
  await container.repository.setCircuit({ open: false, reason: `operator_reset:${reason}` });
  const after = await container.repository.getCircuit();
  if (after?.state !== "closed") {
    throw new Error("Circuit reset did not persist a closed state");
  }
  container.logger.warn(
    { previousReason: before.reason, resetReason: reason },
    "outreach safety circuit explicitly reset by operator"
  );
} finally {
  await container.pool.end();
}
