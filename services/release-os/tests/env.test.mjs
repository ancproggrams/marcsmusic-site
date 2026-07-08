import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConfigError, resolveMailgunConfig } from "../src/config/env.mjs";

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
