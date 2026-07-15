import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  claimCalendarFulfillment,
  markCalendarConfirmed,
  markCalendarPutStarted,
  markCalendarRetryable
} from "../src/booking/calendar-fulfillment.mjs";
import { resolveBoundMolliePayment } from "../src/booking/mollie-policy.mjs";

const BOOKING_ID = "booking-1";
const PAYMENT_ID = "tr_boundpayment123";
const PROFILE_ID = "pfl_testprofile123";

test("unknown and mismatched Mollie payments fail closed before booking, CRM, or calendar mutation", async (t) => {
  const fixture = await integrationFixture(t);
  const baseline = (await fixture.readDb()).bookings[0];
  const valid = validMolliePayment();
  const cases = [
    ["MOLLIE_AMOUNT_MISMATCH", (payment) => { payment.amount.value = "122.99"; }],
    ["MOLLIE_CURRENCY_MISMATCH", (payment) => { payment.amount.currency = "USD"; }],
    ["MOLLIE_PAYMENT_ID_MISMATCH", (payment) => { payment.id = "tr_otherpayment123"; }],
    ["MOLLIE_METADATA_BOOKING_MISMATCH", (payment) => { payment.metadata.bookingId = "booking-other"; }],
    ["MOLLIE_PROFILE_MISMATCH", (payment) => { payment.profileId = "pfl_otherprofile123"; }],
    ["MOLLIE_MODE_MISMATCH", (payment) => { payment.mode = "live"; }]
  ];

  for (const [reasonCode, mutate] of cases) {
    fixture.state.resetCounts();
    fixture.state.payment = structuredClone(valid);
    mutate(fixture.state.payment);
    const response = await postWebhook(fixture.baseUrl, PAYMENT_ID);
    assert.equal(response.status, 409, reasonCode);
    assert.equal(fixture.state.counts.mollieGet, 1, reasonCode);
    assert.equal(fixture.state.counts.crm, 0, reasonCode);
    assert.equal(fixture.state.counts.calendarReport, 0, reasonCode);
    assert.equal(fixture.state.counts.calendarPut, 0, reasonCode);
    const db = await fixture.readDb();
    assert.deepEqual(db.bookings[0], baseline, `${reasonCode} must not mutate the booking`);
    assert.equal(db.payments[0].status, "open", reasonCode);
    assert.equal(db.audit[0].details.reasonCode, reasonCode);
    assert.deepEqual(Object.keys(db.audit[0].details), ["reasonCode"]);
  }

  fixture.state.resetCounts();
  fixture.state.payment = {
    ...structuredClone(valid),
    id: "tr_unknownpayment12",
    metadata: { bookingId: BOOKING_ID }
  };
  const unknown = await postWebhook(fixture.baseUrl, "tr_unknownpayment12");
  assert.equal(unknown.status, 409);
  assert.equal(fixture.state.counts.mollieGet, 0, "an unbound metadata-only ID must cause zero provider I/O");
  assert.equal(fixture.state.counts.crm, 0);
  assert.equal(fixture.state.counts.calendarPut, 0);
  assert.deepEqual((await fixture.readDb()).bookings[0], baseline);
});

test("concurrent paid webhooks persist one claim and issue exactly one CalDAV PUT", async (t) => {
  const fixture = await integrationFixture(t, { putMode: "success", putDelayMs: 100 });
  fixture.state.payment = validMolliePayment({ status: "paid" });

  const responses = await Promise.all(
    Array.from({ length: 10 }, () => postWebhook(fixture.baseUrl, PAYMENT_ID))
  );
  assert.deepEqual(responses.map((response) => response.status), Array(10).fill(200));
  assert.equal(fixture.state.counts.calendarPut, 1);

  const booking = (await fixture.readDb()).bookings[0];
  assert.equal(booking.status, "confirmed");
  assert.equal(booking.calendarFulfillment.status, "confirmed");
  assert.equal(booking.calendarFulfillment.attempt, 1);
  assert.equal(booking.calendarFulfillment.version, 1);
  assert.equal(booking.calendarFulfillment.claimToken, null);
  assert.equal(booking.caldavEventUid, `marcsmusic-${BOOKING_ID}@marcsmusic.nl`);
});

test("a CalDAV 412 is reconciled by exact URL and identity before confirmation", async (t) => {
  const fixture = await integrationFixture(t, { putMode: "precondition" });
  fixture.state.payment = validMolliePayment({ status: "paid" });

  assert.equal((await postWebhook(fixture.baseUrl, PAYMENT_ID)).status, 200);
  assert.equal(fixture.state.counts.calendarPut, 1);
  assert.equal(fixture.state.counts.calendarGet, 1);
  const booking = (await fixture.readDb()).bookings[0];
  assert.equal(booking.status, "confirmed");
  assert.equal(booking.calendarFulfillment.reasonCode, "CALENDAR_EVENT_CONFIRMED");
});

test("a 412 pointing at an unrelated event is fenced into manual review", async (t) => {
  const fixture = await integrationFixture(t, { putMode: "precondition-mismatch" });
  fixture.state.payment = validMolliePayment({ status: "paid" });

  assert.equal((await postWebhook(fixture.baseUrl, PAYMENT_ID)).status, 200);
  assert.equal(fixture.state.counts.calendarPut, 1);
  assert.equal(fixture.state.counts.calendarGet, 1);
  const booking = (await fixture.readDb()).bookings[0];
  assert.equal(booking.status, "manual_review");
  assert.equal(booking.calendarFulfillment.reasonCode, "CALENDAR_EVENT_IDENTITY_MISMATCH");
  assert.equal(booking.caldavEventUid, null);
});

test("an ambiguous CalDAV timeout is reconciled without a second PUT", async (t) => {
  const fixture = await integrationFixture(t, {
    putMode: "timeout",
    putDelayMs: 500,
    caldavTimeoutMs: 150
  });
  fixture.state.payment = validMolliePayment({ status: "paid" });

  assert.equal((await postWebhook(fixture.baseUrl, PAYMENT_ID)).status, 200);
  assert.equal(fixture.state.counts.calendarPut, 1);
  assert.equal(fixture.state.counts.calendarGet, 1);
  assert.equal((await fixture.readDb()).bookings[0].status, "confirmed");
});

test("an expired put_started claim recovers a crash by GET-only reconciliation", async (t) => {
  const fixture = await integrationFixture(t, { crashedPut: true });
  fixture.state.payment = validMolliePayment({ status: "paid" });

  assert.equal((await postWebhook(fixture.baseUrl, PAYMENT_ID)).status, 200);
  assert.equal(fixture.state.counts.calendarReport, 0);
  assert.equal(fixture.state.counts.calendarPut, 0);
  assert.equal(fixture.state.counts.calendarGet, 1);
  const booking = (await fixture.readDb()).bookings[0];
  assert.equal(booking.status, "confirmed");
  assert.equal(booking.calendarFulfillment.attempt, 1, "reconciliation does not create another PUT attempt");
  assert.equal(booking.calendarFulfillment.version, 8);
});

test("a stale failure transition cannot downgrade a confirmed fulfillment", () => {
  const identity = { uid: "marcsmusic-booking-1@marcsmusic.nl", url: "https://calendar.test/event.ics" };
  const booking = { id: BOOKING_ID, status: "paid_calendar_pending" };
  const decision = claimCalendarFulfillment(booking, identity, {
    token: "claim-one",
    now: new Date("2030-01-01T00:00:00Z"),
    leaseMs: 30_000
  });
  const claim = { token: decision.token, version: decision.version };
  const started = markCalendarPutStarted(decision.fulfillment, claim, new Date("2030-01-01T00:00:01Z"));
  const confirmed = markCalendarConfirmed(started.fulfillment, claim, new Date("2030-01-01T00:00:02Z"));
  const staleFailure = markCalendarRetryable(
    confirmed.fulfillment,
    claim,
    "CALENDAR_PUT_UNAVAILABLE",
    new Date("2030-01-01T00:00:03Z")
  );

  assert.equal(staleFailure.applied, false);
  assert.equal(staleFailure.fulfillment.status, "confirmed");
  assert.equal(staleFailure.fulfillment.reasonCode, "CALENDAR_EVENT_CONFIRMED");
});

test("a payment ID bound to more than one booking is rejected as ambiguous", () => {
  const db = bookingDatabase("https://calendar.test");
  db.bookings.push({ ...structuredClone(db.bookings[0]), id: "booking-2" });
  assert.throws(
    () => resolveBoundMolliePayment(db, PAYMENT_ID),
    (error) => error.code === "MOLLIE_BOOKING_BINDING_AMBIGUOUS"
  );
});

async function integrationFixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), "marcsmusic-booking-integrity-"));
  const upstream = await startUpstream(options);
  const dbPath = join(directory, "bookings.json");
  const seeded = bookingDatabase(upstream.baseUrl, options.crashedPut);
  await writeFile(dbPath, JSON.stringify(seeded, null, 2), "utf8");
  if (options.crashedPut) {
    upstream.state.storedIcs = exactIcs();
  }

  const port = await reservePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      APP_BASE_URL: "https://www.marcsmusic.test",
      BOOKING_DB_PATH: dbPath,
      PRIVACY_HASH_SALT: "booking-integrity-test-salt",
      EPK_MANIFEST_ROOT: "",
      EPK_MANIFEST_PATH: "",
      MOLLIE_API_BASE_URL: upstream.baseUrl,
      MOLLIE_API_KEY: "test_local-integration-key",
      MOLLIE_PROFILE_ID: PROFILE_ID,
      MOLLIE_MODE: "test",
      MOLLIE_HTTP_TIMEOUT_MS: "1000",
      ESPOCRM_BASE_URL: upstream.baseUrl,
      ESPOCRM_API_KEY: "crm-test-key",
      CRM_HTTP_TIMEOUT_MS: "1000",
      CALDAV_BASE_URL: upstream.baseUrl,
      CALDAV_USERNAME: "calendar-user",
      CALDAV_PASSWORD: "calendar-password",
      CALDAV_CALENDAR_PATH: "/calendars/bookings/",
      CALDAV_HTTP_TIMEOUT_MS: String(options.caldavTimeoutMs || 1_000),
      CALDAV_RESPONSE_MAX_BYTES: "1048576",
      CALENDAR_FULFILLMENT_LEASE_MS: "4000",
      TRUSTED_PROXY_CIDRS: ""
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
    await upstream.close();
    await rm(directory, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`site process exited early: ${output.slice(0, 2_000)}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return {
          baseUrl,
          state: upstream.state,
          readDb: async () => JSON.parse(await readFile(dbPath, "utf8"))
        };
      }
    } catch {
      // Startup races the first probe.
    }
    await delay(25);
  }
  throw new Error(`site process did not become healthy: ${output.slice(0, 2_000)}`);
}

async function startUpstream(options) {
  const counts = { mollieGet: 0, crm: 0, calendarReport: 0, calendarPut: 0, calendarGet: 0 };
  const state = {
    counts,
    payment: validMolliePayment(),
    storedIcs: null,
    resetCounts() {
      for (const key of Object.keys(counts)) counts[key] = 0;
    }
  };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    try {
      if (request.method === "GET" && url.pathname.startsWith("/v2/payments/")) {
        counts.mollieGet += 1;
        return sendJson(response, 200, state.payment);
      }
      if (url.pathname.startsWith("/api/v1/")) {
        counts.crm += 1;
        await readRequestBody(request);
        return sendJson(response, 200, { id: "crm-booking-1" });
      }
      if (["REPORT", "PROPFIND"].includes(request.method) && url.pathname === "/calendars/bookings/") {
        counts.calendarReport += 1;
        await readRequestBody(request);
        response.writeHead(207, { "content-type": "application/xml" });
        response.end('<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"/>');
        return;
      }
      if (request.method === "PUT" && url.pathname.endsWith(".ics")) {
        counts.calendarPut += 1;
        const incomingIcs = await readRequestBody(request);
        state.storedIcs = options.putMode === "precondition-mismatch"
          ? incomingIcs.replace(`X-MARCSMUSIC-BOOKING-ID:${BOOKING_ID}`, "X-MARCSMUSIC-BOOKING-ID:booking-other")
          : incomingIcs;
        if (["precondition", "precondition-mismatch"].includes(options.putMode)) {
          response.writeHead(412);
          response.end();
          return;
        }
        if (options.putDelayMs) await delay(options.putDelayMs);
        if (!response.writableEnded && !response.destroyed) {
          response.writeHead(201);
          response.end();
        }
        return;
      }
      if (request.method === "GET" && url.pathname.endsWith(".ics")) {
        counts.calendarGet += 1;
        if (!state.storedIcs) {
          response.writeHead(404);
          response.end();
          return;
        }
        response.writeHead(200, { "content-type": "text/calendar" });
        response.end(state.storedIcs);
        return;
      }
      response.writeHead(404);
      response.end();
    } catch {
      if (!response.headersSent) response.writeHead(500);
      response.end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return {
    baseUrl,
    state,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function bookingDatabase(upstreamBaseUrl, crashedPut = false) {
  const booking = {
    id: BOOKING_ID,
    status: crashedPut ? "paid_calendar_pending" : "pending_payment",
    createdAt: "2029-12-01T10:00:00.000Z",
    updatedAt: "2029-12-01T10:00:00.000Z",
    expiresAt: "2031-01-01T00:00:00.000Z",
    bookingType: "dj",
    bookingTypeLabel: "DJ / muziek event",
    startUtc: "2030-01-10T18:00:00.000Z",
    endUtc: "2030-01-10T19:00:00.000Z",
    durationMinutes: 60,
    slotCount: 1,
    priceCents: 12345,
    currency: "EUR",
    customer: {
      name: "Test Customer",
      email: "customer@example.test",
      phone: "+31123456789",
      location: "Test Location",
      message: ""
    },
    crmContactId: "crm-contact-1",
    crmBookingId: "crm-booking-1",
    molliePaymentId: PAYMENT_ID,
    checkoutUrl: "https://checkout.example.test/payment",
    caldavEventUid: null,
    calendarUrl: null
  };
  if (crashedPut) {
    const uid = `marcsmusic-${BOOKING_ID}@marcsmusic.nl`;
    booking.calendarFulfillment = {
      status: "put_started",
      version: 7,
      attempt: 1,
      claimToken: "crashed-claim",
      leaseUntil: "2020-01-01T00:00:00.000Z",
      uid,
      url: `${upstreamBaseUrl}/calendars/bookings/${encodeURIComponent(uid)}.ics`,
      reasonCode: "CALENDAR_PUT_STARTED",
      confirmedAt: null,
      updatedAt: "2020-01-01T00:00:00.000Z"
    };
  }
  return {
    bookings: [booking],
    payments: [{
      id: "payment-ledger-1",
      bookingId: BOOKING_ID,
      molliePaymentId: PAYMENT_ID,
      status: "open",
      amountCents: 12345,
      currency: "EUR",
      profileId: PROFILE_ID,
      mode: "test",
      createdAt: "2029-12-01T10:00:00.000Z",
      updatedAt: "2029-12-01T10:00:00.000Z"
    }],
    newsletterSubscriptions: [],
    trackPlayCounts: {},
    audit: []
  };
}

function validMolliePayment(overrides = {}) {
  return {
    id: PAYMENT_ID,
    status: "open",
    mode: "test",
    profileId: PROFILE_ID,
    amount: { currency: "EUR", value: "123.45" },
    metadata: { bookingId: BOOKING_ID },
    ...overrides
  };
}

function exactIcs() {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `UID:marcsmusic-${BOOKING_ID}@marcsmusic.nl`,
    `X-MARCSMUSIC-BOOKING-ID:${BOOKING_ID}`,
    "END:VEVENT",
    "END:VCALENDAR",
    ""
  ].join("\r\n");
}

async function postWebhook(baseUrl, paymentId) {
  return fetch(`${baseUrl}/api/webhooks/mollie`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id: paymentId })
  });
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
