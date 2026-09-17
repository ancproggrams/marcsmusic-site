import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("rate limiting ignores spoofed forwarding headers from an untrusted peer", async (t) => {
  const site = await startSiteProcess(t, { TRUSTED_PROXY_CIDRS: "203.0.113.0/24" });
  const statuses = [];

  for (let index = 0; index < 31; index += 1) {
    const response = await fetch(`${site.baseUrl}/api/booking/config`, {
      headers: {
        "x-real-ip": `203.0.113.${(index % 200) + 1}`,
        "cf-connecting-ip": `198.51.100.${(index % 200) + 1}`,
        "x-forwarded-for": `192.0.2.${(index % 200) + 1}`
      }
    });
    statuses.push(response.status);
  }

  assert.deepEqual(statuses.slice(0, 30), Array(30).fill(200));
  assert.equal(statuses[30], 429);
});

test("a configured trusted proxy may identify separate clients with one canonical IP header", async (t) => {
  const site = await startSiteProcess(t, { TRUSTED_PROXY_CIDRS: "127.0.0.1/32" });

  for (let index = 0; index < 30; index += 1) {
    const response = await fetch(`${site.baseUrl}/api/booking/config`, {
      headers: {
        "x-real-ip": "198.51.100.10",
        "cf-connecting-ip": `192.0.2.${(index % 200) + 1}`,
        "x-forwarded-for": `203.0.113.${(index % 200) + 1}`
      }
    });
    assert.equal(response.status, 200);
  }

  assert.equal((await fetch(`${site.baseUrl}/api/booking/config`, {
    headers: { "x-real-ip": "198.51.100.10", "x-forwarded-for": "192.0.2.99" }
  })).status, 429);
  assert.equal((await fetch(`${site.baseUrl}/api/booking/config`, {
    headers: { "x-real-ip": "198.51.100.11", "x-forwarded-for": "198.51.100.10" }
  })).status, 200);

  for (let index = 0; index < 30; index += 1) {
    const response = await fetch(`${site.baseUrl}/api/booking/config`, {
      headers: {
        "x-real-ip": "198.51.100.11, 192.0.2.44",
        "cf-connecting-ip": `192.0.2.${(index % 200) + 1}`,
        "x-forwarded-for": `203.0.113.${(index % 200) + 1}`
      }
    });
    assert.equal(response.status, 200);
  }
  assert.equal((await fetch(`${site.baseUrl}/api/booking/config`, {
    headers: {
      "x-real-ip": "198.51.100.11, 192.0.2.44",
      "cf-connecting-ip": "192.0.2.250"
    }
  })).status, 429, "an ambiguous highest-priority header falls back to the peer instead of a weaker header");
});

test("Railway without an attested proxy range uses a bounded peer-wide fallback capacity", async (t) => {
  const site = await startSiteProcess(t, {
    TRUSTED_PROXY_CIDRS: "",
    RAILWAY_ENVIRONMENT: "production",
    RATE_LIMIT_RAILWAY_FALLBACK_MAX_REQUESTS: "300",
    RATE_LIMIT_GLOBAL_MAX_REQUESTS: "1000"
  });

  for (let index = 0; index < 300; index += 1) {
    const response = await fetch(`${site.baseUrl}/api/booking/config`, {
      headers: { "x-real-ip": `198.51.100.${(index % 200) + 1}` }
    });
    assert.equal(response.status, 200);
  }
  assert.equal((await fetch(`${site.baseUrl}/api/booking/config`, {
    headers: { "x-real-ip": "198.51.100.250" }
  })).status, 429);
});

async function startSiteProcess(t, overrides) {
  const directory = await mkdtemp(join(tmpdir(), "marcsmusic-rate-limit-"));
  const port = await reservePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      APP_BASE_URL: "https://www.marcsmusic.test",
      BOOKING_DB_PATH: join(directory, "bookings.json"),
      PRIVACY_HASH_SALT: "trusted-proxy-test-salt",
      EPK_MANIFEST_ROOT: "",
      EPK_MANIFEST_PATH: "",
      ...overrides
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString("utf8"); });
  child.stderr.on("data", (chunk) => { output += chunk.toString("utf8"); });
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        new Promise((resolve) => setTimeout(resolve, 2_000))
      ]);
    }
    await rm(directory, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`site process exited early: ${output.slice(0, 1_000)}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return { baseUrl };
    } catch {
      // Startup races the first probes.
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`site process did not become healthy: ${output.slice(0, 1_000)}`);
}

async function reservePort() {
  const server = createNetServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}
