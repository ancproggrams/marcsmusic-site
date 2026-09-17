import test from "node:test";
import assert from "node:assert/strict";

import { PlunkClient } from "../src/infrastructure/plunk-client.mjs";

const config = Object.freeze({
  baseUrl: "https://mail.example.test",
  apiKey: "sk_test_plunk_secret",
  from: "MarcsMusic <noreply@marcsmusic.nl>",
  replyTo: "marc@marcsmusic.nl",
  timeoutMs: 1_000
});

test("Plunk sends the provider-neutral message contract and returns its email id", async () => {
  const calls = [];
  const client = new PlunkClient(config, {
    async fetch(url, options) {
      calls.push({ url, options });
      return new Response(JSON.stringify({
        success: true,
        data: { emails: [{ email: "plunk-email-1" }] }
      }), { status: 200 });
    }
  });

  const result = await client.send({
    to: "editor@example.test",
    subject: "New release",
    text: "Please listen.",
    tags: ["marcsmusic-outreach"],
    variables: { "send-queue-id": "send-1" },
    correlationId: "attempt-1",
    messageId: "<send-1@marcsmusic.nl>"
  });

  assert.deepEqual(result, { id: "plunk-email-1", message: "Queued", provider: "plunk" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://mail.example.test/v1/send");
  assert.equal(calls[0].options.headers.Authorization, "Bearer sk_test_plunk_secret");
  assert.match(calls[0].options.headers["Idempotency-Key"], /^marcsmusic-[0-9a-f]{64}$/u);
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(body, {
    to: "editor@example.test",
    from: {
      name: "MarcsMusic",
      email: "noreply@marcsmusic.nl"
    },
    reply: "marc@marcsmusic.nl",
    subject: "New release",
    body: "Please listen.",
    headers: {
      "Message-Id": "<send-1@marcsmusic.nl>",
      "X-MarcsMusic-Correlation-Id": "attempt-1"
    },
    data: {
      "send-queue-id": "send-1",
      tags: "[\"marcsmusic-outreach\"]"
    }
  });
});

test("Plunk idempotency conflicts are parked as delivery-unknown", async () => {
  const client = new PlunkClient(config, {
    async fetch() {
      return new Response(JSON.stringify({
        success: false,
        error: { code: "IDEMPOTENCY_KEY_REUSED" }
      }), { status: 409 });
    }
  });
  await assert.rejects(client.send({
    to: "editor@example.test",
    subject: "Subject",
    text: "Body",
    messageId: "<send-1@marcsmusic.nl>"
  }), (error) => {
    assert.equal(error.code, "PLUNK_IDEMPOTENCY_REUSED");
    assert.equal(error.deliveryUnknown, true);
    assert.equal(error.retryable, false);
    return true;
  });
});

test("Plunk idempotency remains stable when a queue retry receives a new correlation id", async () => {
  const keys = [];
  const client = new PlunkClient(config, {
    async fetch(_url, options) {
      keys.push(options.headers["Idempotency-Key"]);
      return new Response(JSON.stringify({ success: true, data: { emails: [{ email: `plunk-${keys.length}` }] } }), { status: 200 });
    }
  });
  await client.send({ to: "editor@example.test", subject: "Subject", text: "Body", messageId: "<send-1@marcsmusic.nl>", correlationId: "attempt-1" });
  await client.send({ to: "editor@example.test", subject: "Subject", text: "Body", messageId: "<send-1@marcsmusic.nl>", correlationId: "attempt-2" });
  assert.equal(keys[0], keys[1]);
});

test("Plunk treats a timeout and server failure as an uncertain outcome", async () => {
  const timeoutClient = new PlunkClient({ ...config, timeoutMs: 5 }, {
    async fetch(_url, { signal }) {
      await new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
      });
    }
  });
  await assert.rejects(timeoutClient.send({ to: "editor@example.test", subject: "Subject", text: "Body" }), (error) => {
    assert.equal(error.code, "PLUNK_TIMEOUT");
    assert.equal(error.deliveryUnknown, true);
    assert.equal(error.retryable, false);
    return true;
  });

  const serverClient = new PlunkClient(config, {
    async fetch() {
      return new Response(JSON.stringify({ success: false, error: { code: "INTERNAL" } }), { status: 500 });
    }
  });
  await assert.rejects(serverClient.send({ to: "editor@example.test", subject: "Subject", text: "Body" }), (error) => {
    assert.equal(error.code, "PLUNK_HTTP_500");
    assert.equal(error.deliveryUnknown, true);
    assert.equal(error.retryable, false);
    return true;
  });
});

test("Plunk rejects invalid production inputs before provider I/O", async () => {
  assert.throws(() => new PlunkClient({ ...config, baseUrl: "http://mail.example.test" }), /HTTPS/u);
  assert.throws(() => new PlunkClient({ ...config, from: "invalid sender" }), /email address|mailbox/u);
  const client = new PlunkClient(config, { async fetch() { throw new Error("must not call provider"); } });
  await assert.rejects(client.send({ to: "not-an-email", subject: "Subject", text: "Body" }), /valid email/u);
  await assert.rejects(client.send({ to: "editor@example.test", subject: "Subject\nInjected", text: "Body" }), /newlines/u);
});

test("Plunk outcome reconciliation is explicit rather than pretending Mailgun Logs compatibility", async () => {
  const client = new PlunkClient(config, { async fetch() { throw new Error("not called"); } });
  await assert.rejects(client.listOutcomeEvents(), (error) => error.code === "PLUNK_OUTCOME_RECONCILIATION_UNSUPPORTED");
  await assert.rejects(client.retrieveStoredMessage(), (error) => error.code === "PLUNK_STORED_MESSAGE_UNSUPPORTED");
});
