import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PlunkClient,
  PlunkClientError,
  PlunkSendDisabledError
} from "../src/infrastructure/plunk/plunk-client.mjs";

const DEFAULT_OPTIONS = Object.freeze({
  secretKey: "sk_test_secret",
  baseUrl: "https://mail.example.com",
  defaultFrom: "MarcsMusic <noreply@marcsmusic.nl>",
  sendEnabled: true,
  retryPolicy: { baseDelayMs: 0, maxDelayMs: 0 }
});

describe("PlunkClient", () => {
  it("fails closed until the explicit Plunk send gate is enabled", async () => {
    let calls = 0;
    const client = new PlunkClient({
      ...DEFAULT_OPTIONS,
      sendEnabled: false,
      env: { NODE_ENV: "production" },
      fetch: async () => {
        calls += 1;
        return jsonResponse(200, successBody());
      }
    });

    await assert.rejects(
      () => client.sendMessage({ to: "test@example.com", subject: "Blocked", text: "Body" }),
      (error) => error instanceof PlunkSendDisabledError && error.code === "PLUNK_SEND_DISABLED"
    );
    assert.equal(calls, 0);
  });

  it("rejects an unsafe HTTP endpoint in production", () => {
    assert.throws(
      () => new PlunkClient({
        ...DEFAULT_OPTIONS,
        baseUrl: "http://mail.example.com",
        env: { NODE_ENV: "production" }
      }),
      /https in production/u
    );
  });

  it("sends the Plunk JSON contract with bearer auth and idempotency", async () => {
    const requests = [];
    const client = new PlunkClient({
      ...DEFAULT_OPTIONS,
      fetch: async (url, request) => {
        requests.push({ url, request, body: JSON.parse(request.body) });
        return jsonResponse(200, successBody("plunk-email-1"));
      }
    });

    const result = await client.sendMessage({
      to: ["FAN@example.com", "fan@example.com"],
      from: "MarcsMusic <noreply@marcsmusic.nl>",
      subject: "New mix",
      text: "A new mix is live.",
      variables: { releaseId: "release-1", contactId: "contact-1" },
      tags: ["new-music"],
      correlationId: "campaign-1:contact-1"
    });

    assert.deepEqual(result, {
      id: "plunk-email-1",
      providerMessageId: "plunk-email-1",
      provider: "plunk",
      message: "Accepted by Plunk",
      idempotencyKey: "campaign-1:contact-1"
    });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://mail.example.com/v1/send");
    assert.equal(requests[0].request.method, "POST");
    assert.equal(requests[0].request.headers.Authorization, "Bearer sk_test_secret");
    assert.equal(requests[0].request.headers["Content-Type"], "application/json");
    assert.equal(requests[0].request.headers["Idempotency-Key"], "campaign-1:contact-1");
    assert.deepEqual(requests[0].body.to, "fan@example.com");
    assert.deepEqual(requests[0].body.from, { name: "MarcsMusic", email: "noreply@marcsmusic.nl" });
    assert.equal(requests[0].body.body, "A new mix is live.");
    assert.deepEqual(requests[0].body.data, { releaseId: "release-1", contactId: "contact-1" });
  });

  it("escapes plain text before using Plunk's HTML body field", async () => {
    let body;
    const client = new PlunkClient({
      ...DEFAULT_OPTIONS,
      fetch: async (_, request) => {
        body = JSON.parse(request.body);
        return jsonResponse(200, successBody());
      }
    });
    await client.sendMessage({
      to: "test@example.com",
      subject: "Text",
      text: "<script>alert(1)</script>\nline"
    });
    assert.equal(body.body, "&lt;script&gt;alert(1)&lt;/script&gt;<br>\nline");
  });

  it("parks a server failure as uncertain instead of retrying blindly", async () => {
    let calls = 0;
    const keys = [];
    const client = new PlunkClient({
      ...DEFAULT_OPTIONS,
      maxAttempts: 2,
      sleep: async () => {},
      fetch: async (_, request) => {
        calls += 1;
        keys.push(request.headers["Idempotency-Key"]);
        return jsonResponse(503, { error: { message: "temporarily unavailable" } });
      }
    });
    await assert.rejects(() => client.sendMessage({
      to: "test@example.com",
      subject: "Retry",
      text: "Body",
      correlationId: "retry-correlation"
    }), (error) => error instanceof PlunkClientError &&
      error.outcomeUncertain === true &&
      error.retryable === false);
    assert.equal(calls, 1);
    assert.deepEqual(keys, ["retry-correlation"]);
  });

  it("does not retry a timeout because delivery outcome is uncertain", async () => {
    let calls = 0;
    const client = new PlunkClient({
      ...DEFAULT_OPTIONS,
      timeoutMs: 10,
      maxAttempts: 3,
      fetch: async () => {
        calls += 1;
        return new Promise(() => {});
      }
    });
    await assert.rejects(
      () => client.sendMessage({ to: "test@example.com", subject: "Timeout", text: "Body" }),
      (error) => error instanceof PlunkClientError &&
        error.code === "PLUNK_TIMEOUT" &&
        error.outcomeUncertain === true &&
        error.retryable === false
    );
    assert.equal(calls, 1);
  });

  it("parks a reused idempotency key instead of retrying", async () => {
    let calls = 0;
    const client = new PlunkClient({
      ...DEFAULT_OPTIONS,
      maxAttempts: 3,
      fetch: async () => {
        calls += 1;
        return jsonResponse(409, { error: { code: "IDEMPOTENCY_KEY_REUSED" } });
      }
    });
    await assert.rejects(
      () => client.sendMessage({
        to: "test@example.com",
        subject: "Duplicate",
        text: "Body",
        correlationId: "same-send"
      }),
      (error) => error.code === "PLUNK_IDEMPOTENCY_REUSED" && error.outcomeUncertain === true
    );
    assert.equal(calls, 1);
  });

  it("rejects a sender override that is not the centrally configured address", async () => {
    const client = new PlunkClient({
      ...DEFAULT_OPTIONS,
      fetch: async () => jsonResponse(200, successBody())
    });
    await assert.rejects(
      () => client.sendMessage({
        to: "test@example.com",
        from: "attacker@example.net",
        subject: "Spoof",
        text: "Body"
      }),
      /configured EMAIL_FROM address/u
    );
  });

  it("rejects unsafe headers and invalid recipients before provider I/O", async () => {
    let calls = 0;
    const client = new PlunkClient({
      ...DEFAULT_OPTIONS,
      fetch: async () => {
        calls += 1;
        return jsonResponse(200, successBody());
      }
    });
    await assert.rejects(
      () => client.sendMessage({ to: "not-an-email", subject: "Bad", text: "Body" }),
      /valid email/u
    );
    await assert.rejects(
      () => client.sendMessage({
        to: "test@example.com",
        subject: "Bad",
        text: "Body",
        headers: { "X-Bad\nHeader": "value" }
      }),
      /header names/u
    );
    assert.equal(calls, 0);
  });
});

function successBody(id = "plunk-email-id") {
  return {
    success: true,
    data: {
      emails: [{ email: id }],
      timestamp: "2026-07-15T00:00:00.000Z"
    }
  };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    async text() {
      return JSON.stringify(body);
    }
  };
}
