import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertLegacyOutreachSendEnabled,
  isLegacyOutreachSendEnabled,
  isProductionRuntime
} from "../src/domain/legacy-outreach-send-policy.mjs";

describe("legacy outreach send policy", () => {
  for (const value of [undefined, "", "false", "TRUE", "1", "invalid"]) {
    it(`fails closed for ${String(value)}`, () => {
      const env = { LEGACY_OUTREACH_SEND_ENABLED: value };
      assert.equal(isLegacyOutreachSendEnabled(env), false);
      assert.throws(
        () => assertLegacyOutreachSendEnabled(env),
        (error) => error?.code === "LEGACY_OUTREACH_SEND_DISABLED" && error?.statusCode === 503
      );
    });
  }

  it("accepts only the exact reviewed true value", () => {
    const env = { LEGACY_OUTREACH_SEND_ENABLED: "true" };
    assert.equal(isLegacyOutreachSendEnabled(env), true);
    assert.doesNotThrow(() => assertLegacyOutreachSendEnabled(env));
  });

  it("cannot be enabled in production or any Railway runtime", () => {
    for (const marker of [
      { NODE_ENV: "production" },
      { RAILWAY_ENVIRONMENT: "staging" },
      { RAILWAY_ENVIRONMENT_ID: "environment-id" },
      { RAILWAY_PROJECT_ID: "project-id" },
      { RAILWAY_SERVICE_ID: "service-id" }
    ]) {
      const env = { LEGACY_OUTREACH_SEND_ENABLED: "true", ...marker };
      assert.equal(isProductionRuntime(env), true);
      assert.equal(isLegacyOutreachSendEnabled(env), false);
      assert.throws(() => assertLegacyOutreachSendEnabled(env), (error) => error?.code === "LEGACY_OUTREACH_SEND_DISABLED");
    }
  });
});
