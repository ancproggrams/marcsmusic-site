import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConfigError, resolveMailgunConfig, resolvePlunkConfig } from "../src/config/env.mjs";

describe("resolveMailgunConfig", () => {
  it("builds US defaults", () => {
    const config = resolveMailgunConfig({
      MAILGUN_API_KEY: " key ",
      MAILGUN_DOMAIN: " mg.example.com ",
      MAILGUN_FROM: "MarcsMusic <postmaster@mg.example.com>"
    });

    assert.deepEqual(config, {
      apiKey: "key",
      domain: "mg.example.com",
      region: "us",
      baseUrl: "https://api.mailgun.net",
      defaultFrom: "MarcsMusic <postmaster@mg.example.com>",
      timeoutMs: 10_000
    });
  });

  it("builds EU defaults", () => {
    const config = resolveMailgunConfig({
      MAILGUN_API_KEY: "key",
      MAILGUN_DOMAIN: "mg.example.com",
      MAILGUN_REGION: "eu"
    });

    assert.equal(config.baseUrl, "https://api.eu.mailgun.net");
  });

  it("rejects missing required values", () => {
    assert.throws(
      () => resolveMailgunConfig({ MAILGUN_DOMAIN: "mg.example.com" }),
      ConfigError
    );
  });

  it("rejects non-https base URLs", () => {
    assert.throws(
      () =>
        resolveMailgunConfig({
          MAILGUN_API_KEY: "key",
          MAILGUN_DOMAIN: "mg.example.com",
          MAILGUN_BASE_URL: "http://api.mailgun.net"
        }),
      /https/u
    );
  });
});

describe("resolvePlunkConfig", () => {
  const base = {
    EMAIL_PROVIDER: "plunk",
    PLUNK_SECRET_KEY: "sk_test_secret",
    PLUNK_BASE_URL: "https://mail.example.com",
    EMAIL_FROM: "MarcsMusic <noreply@example.com>"
  };

  it("builds the production-safe Plunk contract", () => {
    assert.deepEqual(resolvePlunkConfig({ ...base, PLUNK_SEND_ENABLED: "true" }), {
      provider: "plunk",
      secretKey: "sk_test_secret",
      baseUrl: "https://mail.example.com",
      sendPath: "/v1/send",
      defaultFrom: "MarcsMusic <noreply@example.com>",
      fromName: "MarcsMusic",
      timeoutMs: 15_000,
      maxAttempts: 2,
      sendEnabled: true,
      maxResponseBytes: 65_536
    });
  });

  it("requires a secret and sender instead of falling back to Mailgun", () => {
    assert.throws(() => resolvePlunkConfig({ EMAIL_PROVIDER: "plunk" }), /PLUNK_SECRET_KEY/u);
    assert.throws(() => resolvePlunkConfig({ ...base, EMAIL_FROM: "" }), /EMAIL_FROM.*PLUNK_FROM/u);
  });

  it("rejects unsafe production HTTP endpoints", () => {
    assert.throws(
      () => resolvePlunkConfig({ ...base, PLUNK_BASE_URL: "http://mail.example.com", NODE_ENV: "production" }),
      /https/u
    );
    assert.throws(
      () => resolvePlunkConfig({ ...base, PLUNK_BASE_URL: "https://user:pass@mail.example.com" }),
      /credentials/u
    );
  });

  it("allows localhost HTTP only outside production", () => {
    assert.equal(
      resolvePlunkConfig({ ...base, PLUNK_BASE_URL: "http://127.0.0.1:8080" }).baseUrl,
      "http://127.0.0.1:8080"
    );
  });

  it("validates the explicit production send gate", () => {
    assert.throws(() => resolvePlunkConfig({ ...base, PLUNK_SEND_ENABLED: "yes" }), /PLUNK_SEND_ENABLED/u);
  });
});
