import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EspoCrmClient } from "../src/infrastructure/espocrm/espocrm-client.mjs";

describe("EspoCRM HTTP bounds", () => {
  it("keeps the deadline active while consuming a response body", async () => {
    const client = clientWith({
      timeoutMs: 25,
      fetch: async () => new Response(new ReadableStream({ start() {} }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    });
    await assert.rejects(
      () => client.listContacts(),
      (error) => error.code === "ESPOCRM_TIMEOUT" && error.statusCode === 504
    );
  });

  it("rejects declared and streamed responses above the configured cap", async () => {
    for (const response of [
      new Response("{}", { status: 200, headers: { "content-length": "100" } }),
      new Response(JSON.stringify({ list: [{ id: "x", padding: "x".repeat(100) }] }), { status: 200 })
    ]) {
      const client = clientWith({ maxResponseBytes: 32, fetch: async () => response });
      await assert.rejects(
        () => client.listContacts(),
        (error) => error.code === "ESPOCRM_RESPONSE_TOO_LARGE" && error.statusCode === 502
      );
    }
  });

  it("parses a bounded successful contact response", async () => {
    const client = clientWith({
      fetch: async () => new Response(JSON.stringify({
        list: [{ id: "contact-1", emailAddress: "PRESS@EXAMPLE.COM", status: "active" }]
      }), { status: 200, headers: { "content-type": "application/json" } })
    });
    const contacts = await client.listContacts();
    assert.equal(contacts.length, 1);
    assert.equal(contacts[0].email, "press@example.com");
  });
});

function clientWith(options) {
  return new EspoCrmClient({
    baseUrl: "https://crm.example.test",
    apiKey: "api-key",
    ...options
  });
}
