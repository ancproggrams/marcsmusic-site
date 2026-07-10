import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

const REPOSITORY_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CALENDAR_STUBS = {
  malformed: { status: 207, type: "text/html", body: "<html>login</html>" },
  connected: { status: 207, type: "application/xml", body: '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"></d:multistatus>' },
  "inner-error": { status: 207, type: "application/xml", body: '<d:multistatus xmlns:d="DAV:"><d:response><d:status>HTTP/1.1 500 Error</d:status></d:response></d:multistatus>' },
  "invalid-ics": { status: 207, type: "application/xml", body: '<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:propstat><d:prop><c:calendar-data>not an event</c:calendar-data></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>' }
};
describe("booking calendar HTTP boundary", () => {
  let calendarMode = "error";
  let calendarServer;
  let calendarBaseUrl;
  let site;
  let tempDir;
  let bookingDbPath;
  let lastCalendarRequest;
  before(async () => {
    calendarServer = createServer(async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      lastCalendarRequest = { method: request.method, url: request.url, headers: request.headers, body: Buffer.concat(chunks).toString() };
      if (calendarMode === "hang") return;
      const stub = CALENDAR_STUBS[calendarMode];
      if (stub) {
        response.writeHead(stub.status, { "content-type": stub.type });
        response.end(stub.body);
        return;
      }
      if (calendarMode === "busy") {
        response.writeHead(207, { "content-type": "application/xml" });
        response.end(`<?xml version="1.0"?>
          <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
            <d:response><d:href>/calendar/busy.ics</d:href><d:propstat><d:prop>
              <d:getetag>"test-etag"</d:getetag><c:calendar-data><![CDATA[BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Radicale//NONSGML Radicale Server//EN
BEGIN:VEVENT
UID:buffered-busy-test
DTSTART:20990101T084500Z
DTEND:20990101T090000Z
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR]]></c:calendar-data>
            </d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
          </d:multistatus>`);
        return;
      }
      if (calendarMode === "oversized") {
        response.writeHead(207, { "content-type": "application/xml" });
        response.end("x".repeat(5 * 1024 * 1024 + 1));
        return;
      }
      response.writeHead(500, { "content-type": "text/plain" });
      response.end("unavailable");
    });
    await new Promise((resolve) => calendarServer.listen(0, "127.0.0.1", resolve));
    calendarBaseUrl = `http://127.0.0.1:${calendarServer.address().port}`;
    tempDir = await mkdtemp(join(tmpdir(), "marcsmusic-calendar-test-"));
    bookingDbPath = join(tempDir, "bookings.json");
    site = await startSite({
      BOOKING_DB_PATH: bookingDbPath,
      CALDAV_BASE_URL: calendarBaseUrl,
      CALDAV_USERNAME: "test-user",
      CALDAV_PASSWORD: "test-password",
      CALDAV_CALENDAR_PATH: "/calendar/",
      CALDAV_TIMEOUT_MS: "75",
      BOOKING_TIMEZONE: "UTC",
      BOOKING_WORKDAY_START: "09:00",
      BOOKING_WORKDAY_END: "13:00",
      BOOKING_BUFFER_MINUTES: "30",
      ESPOCRM_BASE_URL: calendarBaseUrl,
      ESPOCRM_API_KEY: "test-key",
      MOLLIE_API_KEY: "test-key"
    });
  });

  after(async () => {
    await stopSite(site?.child);
    if (calendarServer?.listening) {
      await new Promise((resolve) => calendarServer.close(resolve));
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("returns 503 and no slots for configured failures, invalid XML, and timeout", async () => {
    for (const mode of ["error", "malformed", "inner-error", "invalid-ics", "oversized", "hang"]) {
      calendarMode = mode;
      const { response, body } = await requestAvailability(site.port);
      assert.equal(response.status, 503, mode);
      assert.deepEqual(Object.keys(body), ["error"]);
    }
  });

  it("blocks booking creation before local or provider side effects", async () => {
    calendarMode = "error";
    const response = await fetch(`http://127.0.0.1:${site.port}/api/booking/create`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookingType: "studio",
        startUtc: "2099-01-01T10:00:00.000Z",
        slotCount: 1,
        travelHours: 0,
        name: "Test Booker",
        email: "booker@example.test",
        phone: "0612345678",
        location: "Test location"
      }),
      signal: AbortSignal.timeout(2_000)
    });
    assert.equal(response.status, 503);
    await assert.rejects(access(bookingDbPath), (error) => error.code === "ENOENT");
  });

  it("accepts a valid empty CalDAV multistatus", async () => {
    calendarMode = "connected";
    const { response, body } = await requestAvailability(site.port);
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body.slots));
    assert.equal(body.calendar.status, "connected");
  });

  it("expands an authenticated REPORT and removes a buffered busy slot", async () => {
    calendarMode = "busy";
    lastCalendarRequest = null;
    const { response, body } = await requestAvailability(site.port);
    assert.equal(response.status, 200);
    assert.ok(!body.slots.some((slot) => slot.startUtc === "2099-01-01T09:00:00.000Z"));
    assert.ok(body.slots.some((slot) => slot.startUtc === "2099-01-01T09:30:00.000Z"));
    assert.equal(lastCalendarRequest.method, "REPORT");
    assert.equal(lastCalendarRequest.url, "/calendar/");
    assert.equal(lastCalendarRequest.headers.authorization, `Basic ${Buffer.from("test-user:test-password").toString("base64")}`);
    assert.equal(lastCalendarRequest.headers.depth, "1");
    assert.match(lastCalendarRequest.headers["content-type"], /^application\/xml/u);
    assert.match(lastCalendarRequest.body, /<c:calendar-query/u);
    assert.match(lastCalendarRequest.body, /start="20990101T083000Z" end="20990101T133000Z"/u);
  });
});

async function requestAvailability(port) {
  const response = await fetch(
    `http://127.0.0.1:${port}/api/booking/availability?date=2099-01-01&bookingType=studio`,
    { signal: AbortSignal.timeout(2_000) }
  );
  return { response, body: await response.json() };
}

function startSite(extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["server.js"], {
      cwd: REPOSITORY_ROOT,
      env: { PORT: "0", PRIVACY_HASH_SALT: "test-only", ...extraEnv },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    let stderr = "";
    let started = false;
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Timed out starting site: ${stderr}`));
    }, 5_000);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/listening on port (\d+)/u);
      if (match && !started) {
        started = true;
        clearTimeout(timeout);
        resolve({ child, port: Number(match[1]) });
      }
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      if (!started) {
        reject(new Error(`Site exited with ${code}: ${stderr}`));
      }
    });
  });
}

async function stopSite(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  const exited = once(child, "exit");
  const forceKill = setTimeout(() => child.kill("SIGKILL"), 1_000);
  forceKill.unref();
  child.kill("SIGTERM");
  await exited;
  clearTimeout(forceKill);
}
