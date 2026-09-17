import { isProductionRuntime } from "../config/runtime-environment.mjs";

export { isProductionRuntime } from "../config/runtime-environment.mjs";

export class LegacyOutreachSendDisabledError extends Error {
  constructor() {
    super("Direct legacy outreach sending is disabled; use the central outreach worker.");
    this.name = "LegacyOutreachSendDisabledError";
    this.code = "LEGACY_OUTREACH_SEND_DISABLED";
    this.statusCode = 503;
    this.retryable = false;
  }
}

export function isLegacyOutreachSendEnabled(env = process.env) {
  return env?.LEGACY_OUTREACH_SEND_ENABLED === "true" && !isProductionRuntime(env);
}

export function assertLegacyOutreachSendEnabled(env = process.env) {
  if (!isLegacyOutreachSendEnabled(env)) {
    throw new LegacyOutreachSendDisabledError();
  }
}
