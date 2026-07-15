import test from "node:test";
import assert from "node:assert/strict";

import { ConfigurationError, loadConfig } from "../src/config.mjs";
import {
  isPublicHttpAddress,
  ReleaseLinkReachabilityChecker
} from "../src/infrastructure/release-link-reachability-checker.mjs";

function createChecker(options = {}, config = {}) {
  return new ReleaseLinkReachabilityChecker({
    timeoutMs: config.timeoutMs ?? 250,
    maxRedirects: config.maxRedirects ?? 3,
    maxHeaderBytes: config.maxHeaderBytes ?? 16_384
  }, options);
}

test("public-address policy blocks private, loopback, link-local, documentation and reserved ranges", () => {
  const blocked = [
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.10.1",
    "172.16.0.1",
    "192.0.0.9",
    "192.0.2.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "2001::1",
    "2001:db8::1",
    "2002::1",
    "3fff::1"
  ];
  const allowed = ["1.1.1.1", "8.8.8.8", "93.184.216.34", "2606:4700:4700::1111", "2a00:1450:400e:80d::200e"];

  for (const address of blocked) assert.equal(isPublicHttpAddress(address), false, address);
  for (const address of allowed) assert.equal(isPublicHttpAddress(address), true, address);
  assert.equal(isPublicHttpAddress("not-an-address"), false);
});

test("checker validates all DNS answers and passes one validated address to the pinned request", async () => {
  const calls = [];
  const checker = createChecker({
    async lookup(hostname, options) {
      assert.equal(hostname, "artist.example.test");
      assert.deepEqual(options, { all: true, verbatim: true });
      return [
        { address: "2606:4700:4700::1111", family: 6 },
        { address: "93.184.216.34", family: 4 }
      ];
    },
    async request(input) {
      calls.push(input);
      return { statusCode: 200, headers: {} };
    }
  });

  const result = await checker.assertReachable("https://artist.example.test/epk?release=one#details");

  assert.deepEqual(result, { reachable: true, statusCode: 200, method: "HEAD", redirects: 0 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.toString(), "https://artist.example.test/epk?release=one");
  assert.equal(calls[0].address, "93.184.216.34");
  assert.equal(calls[0].family, 4);
  assert.equal(calls[0].method, "HEAD");
  assert.equal(calls[0].maxHeaderBytes, 16_384);
});

test("mixed public and non-public DNS answers fail closed before a connection", async () => {
  let requests = 0;
  const checker = createChecker({
    async lookup() {
      return [
        { address: "93.184.216.34", family: 4 },
        { address: "127.0.0.1", family: 4 }
      ];
    },
    async request() {
      requests += 1;
      return { statusCode: 200, headers: {} };
    }
  });

  await assert.rejects(
    checker.assertReachable("https://artist.example.test/epk"),
    (error) => error.code === "RELEASE_LINK_DESTINATION_DISALLOWED" && error.retryable === false
  );
  assert.equal(requests, 0);
});

test("URL policy rejects non-HTTPS, credentials and non-standard ports before DNS", async () => {
  let lookups = 0;
  const checker = createChecker({
    async lookup() {
      lookups += 1;
      return [{ address: "93.184.216.34", family: 4 }];
    },
    async request() {
      throw new Error("request must remain unreachable");
    }
  });

  for (const [url, code] of [
    ["http://artist.example.test/epk", "RELEASE_LINK_HTTPS_REQUIRED"],
    ["https://user:secret@artist.example.test/epk", "RELEASE_LINK_CREDENTIALS_DISALLOWED"],
    ["https://artist.example.test:8443/epk", "RELEASE_LINK_URL_INVALID"],
    ["https://2130706433/epk", "RELEASE_LINK_DESTINATION_DISALLOWED"],
    ["https://[::ffff:127.0.0.1]/epk", "RELEASE_LINK_DESTINATION_DISALLOWED"],
    [`https://artist.example.test/${"a".repeat(2_100)}`, "RELEASE_LINK_URL_TOO_LONG"]
  ]) {
    await assert.rejects(checker.assertReachable(url), (error) => error.code === code && error.retryable === false);
  }
  assert.equal(lookups, 0);
});

test("every redirect hop is re-resolved, revalidated and pinned", async () => {
  const lookups = [];
  const requests = [];
  const addresses = {
    "artist.example.test": "93.184.216.34",
    "cdn.example.test": "1.1.1.1"
  };
  const checker = createChecker({
    async lookup(hostname) {
      lookups.push(hostname);
      return [{ address: addresses[hostname], family: 4 }];
    },
    async request(input) {
      requests.push({ hostname: input.url.hostname, address: input.address, method: input.method });
      return input.url.hostname === "artist.example.test"
        ? { statusCode: 302, headers: { location: "https://cdn.example.test/download" } }
        : { statusCode: 200, headers: {} };
    }
  });

  const result = await checker.assertReachable("https://artist.example.test/epk");

  assert.equal(result.redirects, 1);
  assert.deepEqual(lookups, ["artist.example.test", "cdn.example.test"]);
  assert.deepEqual(requests, [
    { hostname: "artist.example.test", address: "93.184.216.34", method: "HEAD" },
    { hostname: "cdn.example.test", address: "1.1.1.1", method: "HEAD" }
  ]);
});

test("a redirect to a private destination is rejected before the second request", async () => {
  const requests = [];
  const checker = createChecker({
    async lookup(hostname) {
      return [{ address: hostname === "artist.example.test" ? "93.184.216.34" : "169.254.169.254", family: 4 }];
    },
    async request(input) {
      requests.push(input.url.hostname);
      return { statusCode: 302, headers: { location: "https://metadata.internal/latest" } };
    }
  });

  await assert.rejects(
    checker.assertReachable("https://artist.example.test/epk"),
    (error) => error.code === "RELEASE_LINK_DESTINATION_DISALLOWED" && error.retryable === false
  );
  assert.deepEqual(requests, ["artist.example.test"]);
});

test("redirect limit and protocol validation apply to every hop", async (t) => {
  await t.test("bounded redirect count", async () => {
    const checker = createChecker({
      async lookup() { return [{ address: "93.184.216.34", family: 4 }]; },
      async request({ url }) {
        return { statusCode: 302, headers: { location: `https://artist.example.test${url.pathname}/next` } };
      }
    }, { maxRedirects: 1 });

    await assert.rejects(
      checker.assertReachable("https://artist.example.test/epk"),
      (error) => error.code === "RELEASE_LINK_REDIRECT_LIMIT" && error.retryable === false
    );
  });

  await t.test("no HTTPS downgrade", async () => {
    const checker = createChecker({
      async lookup() { return [{ address: "93.184.216.34", family: 4 }]; },
      async request() { return { statusCode: 302, headers: { location: "http://artist.example.test/file" } }; }
    });

    await assert.rejects(
      checker.assertReachable("https://artist.example.test/epk"),
      (error) => error.code === "RELEASE_LINK_HTTPS_REQUIRED" && error.retryable === false
    );
  });
});

test("HEAD falls back once to a minimal GET only when the method is unsupported", async () => {
  const methods = [];
  const checker = createChecker({
    async lookup() { return [{ address: "93.184.216.34", family: 4 }]; },
    async request({ method }) {
      methods.push(method);
      return method === "HEAD" ? { statusCode: 405, headers: {} } : { statusCode: 206, headers: {} };
    }
  });

  const result = await checker.assertReachable("https://artist.example.test/epk");

  assert.equal(result.method, "GET");
  assert.deepEqual(methods, ["HEAD", "GET"]);
});

test("HTTP status classification distinguishes permanent and retryable failures", async (t) => {
  for (const [statusCode, retryable] of [[400, false], [404, false], [408, true], [429, true], [500, true], [503, true]]) {
    await t.test(String(statusCode), async () => {
      const checker = createChecker({
        async lookup() { return [{ address: "93.184.216.34", family: 4 }]; },
        async request() { return { statusCode, headers: {} }; }
      });

      await assert.rejects(
        checker.assertReachable("https://artist.example.test/epk"),
        (error) => error.code === `RELEASE_LINK_HTTP_${statusCode}` && error.retryable === retryable
      );
    });
  }
});

test("timeouts and lifecycle aborts stop the check with retryable classifications", async (t) => {
  await t.test("total timeout", async () => {
    const checker = createChecker({
      async lookup() { return [{ address: "93.184.216.34", family: 4 }]; },
      async request() {
        return new Promise((resolve) => setTimeout(() => resolve({ statusCode: 200, headers: {} }), 100));
      }
    }, { timeoutMs: 10 });

    await assert.rejects(
      checker.assertReachable("https://artist.example.test/epk"),
      (error) => error.code === "RELEASE_LINK_CHECK_TIMEOUT" && error.retryable === true
    );
  });

  await t.test("external abort", async () => {
    const controller = new AbortController();
    const checker = createChecker({
      async lookup() { return [{ address: "93.184.216.34", family: 4 }]; },
      async request({ signal }) {
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      }
    }, { timeoutMs: 200 });
    setTimeout(() => controller.abort(new Error("shutdown")), 5);

    await assert.rejects(
      checker.assertReachable("https://artist.example.test/epk", { signal: controller.signal }),
      (error) => error.code === "RELEASE_LINK_CHECK_ABORTED" && error.retryable === true
    );
  });
});

test("TLS and response-header bound violations are permanent", async (t) => {
  for (const [upstreamCode, expectedCode] of [
    ["ERR_TLS_CERT_ALTNAME_INVALID", "RELEASE_LINK_TLS_INVALID"],
    ["HPE_HEADER_OVERFLOW", "RELEASE_LINK_HEADERS_TOO_LARGE"]
  ]) {
    await t.test(upstreamCode, async () => {
      const checker = createChecker({
        async lookup() { return [{ address: "93.184.216.34", family: 4 }]; },
        async request() { throw Object.assign(new Error("rejected"), { code: upstreamCode }); }
      });

      await assert.rejects(
        checker.assertReachable("https://artist.example.test/epk"),
        (error) => error.code === expectedCode && error.retryable === false
      );
    });
  }
});

test("link-check configuration is bounded and exposed as an immutable group", () => {
  const environment = {
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
    OUTREACH_DATA_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
    OUTREACH_HASH_KEY: "privacy-hash-key-for-tests-at-least-32-characters",
    OUTREACH_UNSUBSCRIBE_KEYRING_JSON: JSON.stringify({
      schemaVersion: 2,
      active: { kid: "unsub-link-test-2026-07", key: "unsubscribe-key-for-tests-at-least-32-characters" },
      verifyOnly: []
    }),
    METRICS_TOKEN: "metrics-token-for-tests-at-least-24",
    COPY_LINK_CHECK_TIMEOUT_MS: "2500",
    COPY_LINK_CHECK_MAX_REDIRECTS: "2",
    COPY_LINK_CHECK_MAX_HEADER_BYTES: "8192"
  };
  const config = loadConfig(environment);

  assert.deepEqual(config.copyLinkCheck, {
    timeoutMs: 2_500,
    maxRedirects: 2,
    maxHeaderBytes: 8_192
  });
  assert.equal(Object.isFrozen(config.copyLinkCheck), true);

  for (const override of [
    { COPY_LINK_CHECK_TIMEOUT_MS: "499" },
    { COPY_LINK_CHECK_MAX_REDIRECTS: "6" },
    { COPY_LINK_CHECK_MAX_HEADER_BYTES: "1023" }
  ]) {
    assert.throws(
      () => loadConfig({ ...environment, ...override }),
      (error) => error instanceof ConfigurationError
    );
  }
});
