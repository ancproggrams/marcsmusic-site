import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MailgunClient, MailgunClientError } from "../src/infrastructure/mailgun/mailgun-client.mjs";

describe("MailgunClient", () => {
  it("sends multipart form data to the Mailgun messages endpoint", async () => {
    const requests = [];
    const client = new MailgunClient({
      apiKey: "secret",
      domain: "mg.example.com",
      baseUrl: "https://api.mailgun.net/",
      defaultFrom: "MarcsMusic <postmaster@mg.example.com>",
      fetch: async (url, request) => {
        requests.push({ url, request });

        return jsonResponse(200, {
          id: "message-id",
          message: "Queued. Thank you."
        });
      }
    });

    const result = await client.sendMessage({
      to: ["fan@example.com", "fan@example.com"],
      subject: "New mix",
      text: "A new mix is live.",
      tags: ["release"],
      variables: {
        artist: "MarcsMusic"
      },
      correlationId: "corr-123"
    });

    assert.deepEqual(result, {
      id: "message-id",
      message: "Queued. Thank you."
    });
    assert.equal(requests[0].url, "https://api.mailgun.net/v3/mg.example.com/messages");
    assert.equal(requests[0].request.method, "POST");
    assert.equal(requests[0].request.headers.Authorization, "Basic YXBpOnNlY3JldA==");
    assert.equal(requests[0].request.body.get("from"), "MarcsMusic <postmaster@mg.example.com>");
    assert.deepEqual(requests[0].request.body.getAll("to"), ["fan@example.com"]);
    assert.equal(requests[0].request.body.get("subject"), "New mix");
    assert.equal(requests[0].request.body.get("text"), "A new mix is live.");
    assert.equal(requests[0].request.body.get("o:tag"), "release");
    assert.equal(requests[0].request.body.get("v:artist"), "MarcsMusic");
    assert.equal(requests[0].request.body.get("v:correlation-id"), "corr-123");
  });

  it("rejects messages without a body source", async () => {
    const client = new MailgunClient({
      apiKey: "secret",
      domain: "mg.example.com",
      defaultFrom: "MarcsMusic <postmaster@mg.example.com>",
      fetch: async () => jsonResponse(200, {})
    });

    await assert.rejects(
      () =>
        client.sendMessage({
          to: "fan@example.com",
          subject: "Missing body"
        }),
      /text, message.html, or message.template/u
    );
  });

  it("does not retry client validation failures from Mailgun", async () => {
    let calls = 0;
    const client = new MailgunClient({
      apiKey: "secret",
      domain: "mg.example.com",
      defaultFrom: "MarcsMusic <postmaster@mg.example.com>",
      retryPolicy: {
        attempts: 3,
        baseDelayMs: 0,
        maxDelayMs: 0
      },
      fetch: async () => {
        calls += 1;

        return jsonResponse(400, {
          message: "Bad Request"
        });
      }
    });

    await assert.rejects(
      () =>
        client.sendMessage({
          to: "fan@example.com",
          subject: "Bad request",
          text: "Body"
        }),
      (error) =>
        error instanceof MailgunClientError &&
        error.status === 400 &&
        error.retryable === false
    );
    assert.equal(calls, 1);
  });

  it("retries retryable Mailgun failures", async () => {
    let calls = 0;
    const client = new MailgunClient({
      apiKey: "secret",
      domain: "mg.example.com",
      defaultFrom: "MarcsMusic <postmaster@mg.example.com>",
      retryPolicy: {
        attempts: 3,
        baseDelayMs: 0,
        maxDelayMs: 0
      },
      sleep: async () => {},
      fetch: async () => {
        calls += 1;

        if (calls < 3) {
          return jsonResponse(500, {
            message: "Internal Error"
          });
        }

        return jsonResponse(200, {
          id: "message-id",
          message: "Queued. Thank you."
        });
      }
    });

    const result = await client.sendMessage({
      to: "fan@example.com",
      subject: "Retry",
      text: "Body"
    });

    assert.equal(calls, 3);
    assert.equal(result.id, "message-id");
  });

  it("uses Mailgun rate-limit reset headers for bounded retry delay", async () => {
    let calls = 0;
    const delays = [];
    const client = new MailgunClient({
      apiKey: "secret",
      domain: "mg.example.com",
      defaultFrom: "MarcsMusic <postmaster@mg.example.com>",
      retryPolicy: {
        attempts: 2,
        baseDelayMs: 0,
        maxDelayMs: 10
      },
      sleep: async (delayMs) => {
        delays.push(delayMs);
      },
      fetch: async () => {
        calls += 1;

        if (calls === 1) {
          return jsonResponse(
            429,
            {
              message: "Rate Limited"
            },
            {
              "x-ratelimit-reset": String(Date.now() + 60_000)
            }
          );
        }

        return jsonResponse(200, {
          id: "message-id",
          message: "Queued. Thank you."
        });
      }
    });

    await client.sendMessage({
      to: "fan@example.com",
      subject: "Rate limit",
      text: "Body"
    });

    assert.deepEqual(delays, [10]);
  });

  it("rejects unsafe header names", async () => {
    const client = new MailgunClient({
      apiKey: "secret",
      domain: "mg.example.com",
      defaultFrom: "MarcsMusic <postmaster@mg.example.com>",
      fetch: async () => jsonResponse(200, {})
    });

    await assert.rejects(
      () =>
        client.sendMessage({
          to: "fan@example.com",
          subject: "Header",
          text: "Body",
          headers: {
            "X-Bad\nHeader": "value"
          }
        }),
      /header names/u
    );
  });

  it("rejects non-string header values", async () => {
    const client = new MailgunClient({
      apiKey: "secret",
      domain: "mg.example.com",
      defaultFrom: "MarcsMusic <postmaster@mg.example.com>",
      fetch: async () => jsonResponse(200, {})
    });

    await assert.rejects(
      () =>
        client.sendMessage({
          to: "fan@example.com",
          subject: "Header",
          text: "Body",
          headers: {
            "X-Trace": {
              nested: true
            }
          }
        }),
      /headers.X-Trace/u
    );
  });
});

function jsonResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({
      "content-type": "application/json",
      ...headers
    }),
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    }
  };
}
