import assert from "node:assert/strict";
import { connect } from "node:net";
import { createMusicApiServer } from "../src/interfaces/http/music-api-server.mjs";
import { describe, it } from "node:test";

describe("Release OS access boundary", () => {
  it("exposes only liveness and never accepts the execution token as identity", async () => {
    await withServer({ env: { MUSIC_API_EXECUTION_TOKEN: "not-an-identity" } }, async (baseUrl) => {
      const live = await fetch(`${baseUrl}/livez`);
      assert.equal(live.status, 200);
      assert.equal(live.headers.get("cache-control"), "no-store");
      assert.deepEqual(await live.json(), { status: "ok" });

      const response = await fetch(`${baseUrl}/music/platforms`, {
        headers: { "x-music-api-token": "not-an-identity" }
      });
      assert.equal(response.status, 503);
      assert.equal((await response.json()).error.code, "AUTHENTICATION_UNAVAILABLE");
    });
  });

  it("distinguishes missing credentials from broken authentication", async () => {
    await withServer({ authenticateRequest: async () => null }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/music/platforms`);
      assert.equal(response.status, 401);
      assert.equal(response.headers.get("www-authenticate"), null);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
    });
    for (const authenticateRequest of [
      async () => { throw new Error("private provider detail"); },
      async () => ({ kind: "human", subject: "broken", roles: ["viewer"] })
    ]) {
      await withServer({ authenticateRequest }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/music/platforms`);
        const body = await response.json();
        assert.equal(response.status, 503);
        assert.ok(!JSON.stringify(body).includes("private provider detail"));
      });
    }
  });

  it("bypasses the authenticator for exact GET liveness only", async () => {
    let calls = 0;
    await withServer({ authenticateRequest: async () => { calls += 1; return null; } }, async (baseUrl) => {
      assert.equal((await fetch(`${baseUrl}/livez`)).status, 200);
      assert.equal(calls, 0);
      assert.equal((await fetch(`${baseUrl}/livez`, { method: "HEAD" })).status, 401);
      assert.equal(calls, 1);
    });
  });

  it("enforces human RBAC, Origin and CSRF before handlers", async () => {
    const principals = {
      viewer: { kind: "human", subject: "viewer", roles: ["viewer"], csrfToken: "viewer-csrf" },
      editor: { kind: "human", subject: "editor", roles: ["editor"], csrfToken: "editor-csrf" },
      admin: { kind: "human", subject: "admin", roles: ["administrator"], csrfToken: "admin-csrf" },
      writer: { kind: "service", subject: "writer-job", permissions: ["releases:write"] },
      reader: { kind: "service", subject: "reader-job", permissions: ["releases:read"] }
    };
    await withServer(
      {
        allowedOrigins: ["https://release.test"],
        authenticateRequest: async (request) => principals[request.headers["x-test-principal"]]
      },
      async (baseUrl) => {
        assert.equal((await request(baseUrl, "viewer", "GET", "/music/platforms")).status, 200);
        assert.equal((await plan(baseUrl, "viewer", "viewer-csrf")).status, 403);
        assert.equal((await plan(baseUrl, "editor", "wrong", "https://release.test")).status, 403);
        assert.equal((await plan(baseUrl, "editor", "editor-csrf", "https://evil.test")).status, 403);
        assert.equal((await plan(baseUrl, "editor", "editor-csrf", "https://release.test")).status, 200);
        assert.equal((await plan(baseUrl, "writer")).status, 200);
        assert.equal((await plan(baseUrl, "reader")).status, 403);
        assert.equal((await request(baseUrl, "writer", "POST", "/graphql")).status, 403);
        assert.equal((await request(baseUrl, "editor", "GET", "/unknown")).status, 403);
        assert.equal((await request(baseUrl, "admin", "GET", "/unknown")).status, 403);
      }
    );
  });

  it("rejects unfinished bodies before reading them or granting 100 Continue", async () => {
    await withServer({}, async (baseUrl) => {
      const chunkedLive = await rawRequest(
        baseUrl,
        "GET /livez HTTP/1.1\r\nHost: localhost\r\nTransfer-Encoding: chunked\r\n\r\n1\r\nx\r\n"
      );
      assert.match(chunkedLive, /^HTTP\/1\.1 400 /u);
      assert.match(chunkedLive, /\r\nconnection: close\r\n/iu);

      const chunkedProtected = await rawRequest(
        baseUrl,
        "GET /music/platforms HTTP/1.1\r\nHost: localhost\r\nTransfer-Encoding: chunked\r\n\r\n1\r\nx\r\n"
      );
      assert.match(chunkedProtected, /^HTTP\/1\.1 503 /u);
      assert.match(chunkedProtected, /\r\nconnection: close\r\n/iu);

      const expected = await rawRequest(
        baseUrl,
        "POST /music/releases HTTP/1.1\r\nHost: localhost\r\nContent-Length: 100\r\nExpect: 100-continue\r\n\r\n"
      );
      assert.doesNotMatch(expected, /HTTP\/1\.1 100 Continue/iu);
      assert.match(expected, /^HTTP\/1\.1 503 /u);
      assert.match(expected, /\r\nconnection: close\r\n/iu);
    });
  });

});

function plan(baseUrl, principal, csrfToken, origin) {
  return request(baseUrl, principal, "POST", "/music/releases/plan", {
    ...(origin ? { origin } : {}),
    ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
    "content-type": "application/json"
  }, JSON.stringify({ title: "Test", artist: "Artist", audioSource: "test.wav" }));
}

function request(baseUrl, principal, method, path, headers = {}, body = undefined) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { "x-test-principal": principal, ...headers },
    body
  });
}

async function withServer(options, work) {
  const server = createMusicApiServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await work(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function rawRequest(baseUrl, requestText) {
  const { port } = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    let response = "";
    const socket = connect(Number(port), "127.0.0.1", () => socket.write(requestText));
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Server did not reject and close the request within two seconds"));
    }, 2_000);
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => { response += chunk; });
    socket.on("error", (error) => { clearTimeout(timeout); reject(error); });
    socket.on("close", () => { clearTimeout(timeout); resolve(response); });
  });
}
