import assert from "node:assert/strict";
import test from "node:test";

import { ConfigurationError, loadConfig } from "../src/config.mjs";
import {
  configuredInboundRouteEvidence,
  EmailValidationHealthProbe,
  MailgunDomainHealthProbe
} from "../src/infrastructure/provider-capability-probes.mjs";

const FIXED_TIME = Date.parse("2026-07-15T10:00:00.000Z");

test("Mailgun capability probe performs one non-mutating domain GET and returns sanitized health", async () => {
  const requests = [];
  const probe = new MailgunDomainHealthProbe(mailgunConfig(), {
    now: () => FIXED_TIME,
    fetch: async (url, options) => {
      requests.push({ url, options });
      return jsonResponse({
        domain: {
          name: "mg.example.test",
          state: "active",
          is_disabled: false,
          smtp_password: "must-never-leave-the-adapter"
        },
        receiving_dns_records: [{ value: "example" }]
      });
    }
  });

  const result = await probe.check();

  assert.deepEqual(result, {
    configured: true,
    available: true,
    health: "available",
    checkedAt: "2026-07-15T10:00:00.000Z"
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.eu.mailgun.net/v4/domains/mg.example.test");
  assert.equal(requests[0].options.method, "GET");
  assert.equal(Object.hasOwn(requests[0].options, "body"), false);
  assert.equal(requests[0].options.headers.authorization, `Basic ${Buffer.from("api:test-mailgun-key").toString("base64")}`);
  assert.doesNotMatch(JSON.stringify(result), /smtp_password|must-never|test-mailgun-key/u);
  assert.doesNotMatch(requests[0].url, /messages|routes/u);
});

test("Mailgun revoked key and 401 fail closed with a cached redacted reason code", async () => {
  let calls = 0;
  const probe = new MailgunDomainHealthProbe(mailgunConfig(), {
    now: () => FIXED_TIME,
    cacheTtlMs: 1_000,
    fetch: async () => {
      calls += 1;
      return jsonResponse({ message: "revoked key test-mailgun-key" }, { status: 401 });
    }
  });

  const first = await probe.check();
  const cached = await probe.check();

  assert.deepEqual(first, {
    configured: true,
    available: false,
    health: "unavailable",
    reason: "mailgun_auth_rejected",
    checkedAt: "2026-07-15T10:00:00.000Z"
  });
  assert.strictEqual(cached, first);
  assert.equal(calls, 1);
  assert.doesNotMatch(JSON.stringify(first), /revoked|test-mailgun-key/u);
});

test("Mailgun probe enforces its deadline and reports timeout without transport details", async () => {
  const probe = new MailgunDomainHealthProbe(mailgunConfig({ healthTimeoutMs: 15 }), {
    now: () => FIXED_TIME,
    fetch: async (_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => {
        const error = new Error("network stack included test-mailgun-key");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    })
  });

  const result = await probe.check();

  assert.equal(result.available, false);
  assert.equal(result.reason, "mailgun_timeout");
  assert.doesNotMatch(JSON.stringify(result), /network stack|test-mailgun-key/u);
});

test("Mailgun probe rejects malformed and oversized responses fail closed", async (t) => {
  await t.test("malformed JSON", async () => {
    const probe = new MailgunDomainHealthProbe(mailgunConfig(), {
      now: () => FIXED_TIME,
      fetch: async () => new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    });
    assert.equal((await probe.check()).reason, "mailgun_response_invalid");
  });

  await t.test("missing required domain fields", async () => {
    const probe = new MailgunDomainHealthProbe(mailgunConfig(), {
      now: () => FIXED_TIME,
      fetch: async () => jsonResponse({ domain: { name: "mg.example.test", state: "active" } })
    });
    assert.equal((await probe.check()).reason, "mailgun_response_invalid");
  });

  await t.test("declared response exceeds the byte cap", async () => {
    const probe = new MailgunDomainHealthProbe(mailgunConfig({ healthMaxResponseBytes: 1_024 }), {
      now: () => FIXED_TIME,
      fetch: async () => new Response("{}", {
        status: 200,
        headers: {
          "content-length": "2048",
          "content-type": "application/json"
        }
      })
    });
    assert.equal((await probe.check()).reason, "mailgun_response_too_large");
  });
});

test("Mailgun cache coalesces concurrency and re-probes only after bounded TTL", async () => {
  let now = FIXED_TIME;
  let calls = 0;
  let resolveFirst;
  const firstResponse = new Promise((resolve) => { resolveFirst = resolve; });
  const probe = new MailgunDomainHealthProbe(mailgunConfig(), {
    now: () => now,
    cacheTtlMs: 1_000,
    fetch: async () => {
      calls += 1;
      if (calls === 1) return firstResponse;
      return activeMailgunResponse();
    }
  });

  const concurrent = Array.from({ length: 20 }, () => probe.check());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  resolveFirst(activeMailgunResponse());
  const results = await Promise.all(concurrent);
  assert.equal(results.every((result) => result.available), true);
  assert.equal(results.every((result) => result === results[0]), true);

  assert.strictEqual(await probe.check(), results[0]);
  assert.equal(calls, 1);
  now += 1_001;
  assert.equal((await probe.check()).available, true);
  assert.equal(calls, 2);
});

test("email validation capability probes only an explicit non-mutating HTTP health endpoint", async (t) => {
  await t.test("disabled provider", async () => {
    const probe = new EmailValidationHealthProbe({ enabled: false, type: "http" }, {
      fetch: async () => assert.fail("disabled provider must not use the transport")
    });
    assert.deepEqual(await probe.check(), {
      configured: false,
      available: false,
      health: "disabled",
      type: "http",
      reason: "email_validation_disabled"
    });
  });

  await t.test("configured provider without health evidence", async () => {
    const probe = new EmailValidationHealthProbe({ enabled: true, type: "http" }, {
      fetch: async () => assert.fail("validation endpoint must not be used as a health endpoint")
    });
    assert.deepEqual(await probe.check(), {
      configured: true,
      available: false,
      health: "unknown",
      type: "http",
      reason: "email_validation_health_unknown"
    });
  });

  await t.test("SMTP is configured evidence with unknown live health", async () => {
    const probe = new EmailValidationHealthProbe({ enabled: true, type: "smtp" }, {
      fetch: async () => assert.fail("SMTP health must not validate a recipient")
    });
    assert.deepEqual(await probe.check(), {
      configured: true,
      available: false,
      health: "unknown",
      type: "smtp",
      reason: "email_validation_health_unknown"
    });
  });

  await t.test("explicit HTTP health endpoint", async () => {
    const requests = [];
    const probe = new EmailValidationHealthProbe({
      enabled: true,
      type: "http",
      healthUrl: "https://validator.example.test/healthz",
      token: "validator-token",
      healthTimeoutMs: 100,
      healthMaxResponseBytes: 1_024
    }, {
      now: () => FIXED_TIME,
      fetch: async (url, options) => {
        requests.push({ url, options });
        return jsonResponse({ status: "ok" });
      }
    });
    assert.deepEqual(await probe.check(), {
      configured: true,
      available: true,
      health: "available",
      type: "http",
      checkedAt: "2026-07-15T10:00:00.000Z"
    });
    assert.equal(requests[0].url, "https://validator.example.test/healthz");
    assert.equal(requests[0].options.method, "GET");
    assert.equal(Object.hasOwn(requests[0].options, "body"), false);
  });
});

test("inbound routing is never inferred from Mailgun domain health", () => {
  assert.deepEqual(configuredInboundRouteEvidence({
    inboundRouteEvidence: "unknown",
    inboundRouteEvidenceReference: undefined
  }), {
    status: "unknown",
    reason: "inbound_route_evidence_unknown"
  });
  assert.deepEqual(configuredInboundRouteEvidence({
    inboundRouteEvidence: "configured",
    inboundRouteEvidenceReference: "ops/mailgun-route/2026-07-15"
  }), {
    status: "configured",
    reason: "inbound_route_configured_evidence"
  });
});

test("provider capability configuration is bounded and requires inbound evidence", () => {
  const configured = loadConfig({
    ...validEnvironment(),
    PROVIDER_CAPABILITY_CACHE_TTL_MS: "45000",
    MAILGUN_HEALTH_TIMEOUT_MS: "2500",
    MAILGUN_HEALTH_MAX_RESPONSE_BYTES: "8192",
    MAILGUN_INBOUND_ROUTE_EVIDENCE: "configured",
    MAILGUN_INBOUND_ROUTE_EVIDENCE_REFERENCE: "ops/mailgun-route/2026-07-15",
    EMAIL_VALIDATION_PROVIDER_ENABLED: "true",
    EMAIL_VALIDATION_PROVIDER_TYPE: "http",
    EMAIL_VALIDATION_PROVIDER_URL: "https://validator.example.test/validate",
    EMAIL_VALIDATION_PROVIDER_TOKEN: "validation-test-token",
    EMAIL_VALIDATION_PROVIDER_HEALTH_URL: "https://validator.example.test/healthz"
  });

  assert.equal(configured.providerCapabilities.cacheTtlMs, 45_000);
  assert.equal(configured.mailgun.healthTimeoutMs, 2_500);
  assert.equal(configured.mailgun.healthMaxResponseBytes, 8_192);
  assert.equal(configured.mailgun.inboundRouteEvidence, "configured");
  assert.equal(configured.emailValidation.healthUrl, "https://validator.example.test/healthz");

  assert.throws(
    () => loadConfig({
      ...validEnvironment(),
      MAILGUN_INBOUND_ROUTE_EVIDENCE: "configured"
    }),
    (error) => error instanceof ConfigurationError
      && error.issues.some(({ path }) => path[0] === "MAILGUN_INBOUND_ROUTE_EVIDENCE_REFERENCE")
  );
  assert.throws(
    () => loadConfig({
      ...validEnvironment(),
      PROVIDER_CAPABILITY_CACHE_TTL_MS: "999"
    }),
    (error) => error instanceof ConfigurationError
  );
  assert.throws(
    () => loadConfig({
      ...validEnvironment(),
      MAILGUN_HEALTH_MAX_RESPONSE_BYTES: "65537"
    }),
    (error) => error instanceof ConfigurationError
  );

  assert.throws(
    () => loadConfig({
      ...validEnvironment(),
      EMAIL_VALIDATION_PROVIDER_ENABLED: "true",
      EMAIL_VALIDATION_PROVIDER_TYPE: "http",
      EMAIL_VALIDATION_PROVIDER_URL: "https://validator.example.test/validate",
      EMAIL_VALIDATION_PROVIDER_TOKEN: "validation-test-token",
      EMAIL_VALIDATION_PROVIDER_HEALTH_URL: "https://attacker.example.test/healthz"
    }),
    (error) => error instanceof ConfigurationError
      && error.issues.some(({ path }) => path[0] === "EMAIL_VALIDATION_PROVIDER_HEALTH_URL")
  );

  assert.throws(
    () => loadConfig({
      ...validEnvironment(),
      EMAIL_VALIDATION_PROVIDER_ENABLED: "true",
      EMAIL_VALIDATION_PROVIDER_TYPE: "http",
      EMAIL_VALIDATION_PROVIDER_URL: "https://validator.example.test/validate?token=leak",
      EMAIL_VALIDATION_PROVIDER_TOKEN: "validation-test-token"
    }),
    (error) => error instanceof ConfigurationError
      && error.issues.some(({ path }) => path[0] === "EMAIL_VALIDATION_PROVIDER_URL")
  );

  assert.throws(
    () => loadConfig({
      ...validEnvironment(),
      OUTREACH_SEND_ENABLED: "true"
    }),
    (error) => error instanceof ConfigurationError
      && error.issues.some(({ path }) => path[0] === "MAILGUN_INBOUND_ROUTE_EVIDENCE")
  );

  assert.throws(
    () => loadConfig({
      ...validEnvironment(),
      OUTREACH_SEND_ENABLED: "true",
      MAILGUN_INBOUND_ROUTE_EVIDENCE: "configured",
      MAILGUN_INBOUND_ROUTE_EVIDENCE_REFERENCE: "ops/mailgun-route/2026-07-15"
    }),
    (error) => error instanceof ConfigurationError
      && error.issues.some(({ path }) => path[0] === "EMAIL_VALIDATION_PROVIDER_ENABLED")
  );

  assert.throws(
    () => loadConfig({
      ...validEnvironment(),
      NODE_ENV: "production",
      ESPOCRM_WEBHOOK_SECRETS_JSON: JSON.stringify({ release: "webhook-secret-for-production-tests" }),
      MAILGUN_BASE_URL: "https://mailgun-proxy.example.org"
    }),
    (error) => error instanceof ConfigurationError
      && error.issues.some(({ path }) => path[0] === "MAILGUN_BASE_URL")
  );
});

function mailgunConfig(overrides = {}) {
  return {
    apiKey: "test-mailgun-key",
    domain: "mg.example.test",
    baseUrl: "https://api.eu.mailgun.net",
    healthTimeoutMs: 100,
    healthMaxResponseBytes: 16_384,
    ...overrides
  };
}

function activeMailgunResponse() {
  return jsonResponse({
    domain: { name: "mg.example.test", state: "active", is_disabled: false }
  });
}

function jsonResponse(body, { status = 200 } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function validEnvironment() {
  return {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://user:password@localhost:5432/outreach",
    ESPOCRM_BASE_URL: "https://crm.example.test",
    ESPOCRM_API_KEY: "espo-api-key-for-tests",
    MAILGUN_API_KEY: "mailgun-test-key",
    MAILGUN_DOMAIN: "mail.example.test",
    MAILGUN_FROM: "MarcsMusic <music@example.test>",
    MAILGUN_REPLY_TO: "music@example.test",
    MAILGUN_WEBHOOK_SIGNING_KEY: "mailgun-signing-key-for-tests",
    OUTREACH_PUBLIC_BASE_URL: "https://outreach.example.test",
    OUTREACH_DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    OUTREACH_HASH_KEY: "privacy-hash-key-for-tests-at-least-32-characters",
    OUTREACH_UNSUBSCRIBE_KEYRING_JSON: JSON.stringify({
      schemaVersion: 2,
      active: { kid: "unsub-provider-test", key: "u".repeat(48) },
      verifyOnly: []
    }),
    METRICS_TOKEN: "metrics-token-for-tests-at-least-24"
  };
}
