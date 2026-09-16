import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const evidencePath = join(repoRoot, "test", "scenario-evidence.json");
const adminToken = "scenario-admin-token";

const scenarioDefinitions = [
  {
    id: "S1",
    title: "Public site and operational readiness",
    criteria: [
      "Homepage and booking route serve HTML.",
      "Health endpoint reports ok.",
      "Booking config reports all integrations ready.",
      "Booking config exposes expected booking type and pricing data."
    ]
  },
  {
    id: "S2",
    title: "Availability excludes busy calendar and local holds",
    criteria: [
      "Availability request succeeds.",
      "CalDAV is queried and reported as connected.",
      "Calendar busy slot is absent.",
      "Local pending hold slot is absent.",
      "At least one valid slot remains available."
    ]
  },
  {
    id: "S3",
    title: "Booking creation produces CRM record and Mollie checkout",
    criteria: [
      "Booking creation returns pending_payment.",
      "Checkout URL comes from the payment stub.",
      "Booking and payment records are persisted.",
      "CRM receives contact and booking requests.",
      "Mollie receives booking metadata."
    ]
  },
  {
    id: "S4",
    title: "Paid webhook confirms booking and creates calendar event",
    criteria: [
      "Paid webhook returns ok.",
      "Booking becomes confirmed.",
      "Payment record becomes paid.",
      "CalDAV receives event creation.",
      "CRM receives status updates."
    ]
  },
  {
    id: "S5",
    title: "Newsletter and admin cancellation workflow",
    criteria: [
      "Newsletter subscription succeeds and persists.",
      "Consent IP is hashed.",
      "Admin list rejects missing credentials.",
      "Admin list succeeds with bearer token.",
      "Cancellation updates booking and deletes the calendar event."
    ]
  }
];

const runEvidence = {
  generatedAt: new Date().toISOString(),
  evaluationMethod: "pass/fail",
  qualityBar: "Every check in every scenario must pass.",
  conditions: {
    app: "server.js spawned as an HTTP process",
    integrations: "local CRM, Mollie, and CalDAV stubs",
    database: "isolated temporary JSON file per scenario",
    timeZone: "UTC",
    workday: "10:00-18:00",
    slotStepMinutes: 60,
    bookingBufferMinutes: 0
  },
  scenarios: []
};

after(async () => {
  await writeFile(evidencePath, JSON.stringify(runEvidence, null, 2), "utf8");
});

const scenarioRunners = {
  async S1(check) {
    await withHarness({}, async (harness) => {
      const home = await requestText(harness.baseUrl, "/");
      check.equal("homepage status", home.status, 200, { path: "/" });
      check.ok("homepage contains brand", home.text.includes("MarcsMusic"), {
        snippet: home.text.slice(0, 120)
      });

      for (const privatePath of ["/server.js", "/.gitignore", "/data/bookings.json", "/package.json"]) {
        const privateFile = await requestText(harness.baseUrl, privatePath);
        check.equal(`private file blocked: ${privatePath}`, privateFile.status, 404);
      }

      const booking = await requestText(harness.baseUrl, "/booking");
      check.equal("booking alias status", booking.status, 200, { path: "/booking" });
      check.ok("booking page contains form title", booking.text.includes("Book MarcsMusic"), {
        snippet: booking.text.slice(0, 120)
      });

      const health = await requestJson(harness.baseUrl, "/api/health");
      check.equal("health status code", health.status, 200, { path: "/api/health" });
      check.equal("health payload status", health.body.status, "ok");

      const config = await requestJson(harness.baseUrl, "/api/booking/config");
      check.equal("config status code", config.status, 200, { path: "/api/booking/config" });
      check.equal("integration readiness", config.body.integrations.ready, true, config.body.integrations);
      check.ok("booking types include dj", config.body.bookingTypes.some((type) => type.id === "dj"), {
        bookingTypes: config.body.bookingTypes.map((type) => type.id)
      });
      check.ok("dj price is exposed", config.body.bookingTypes.find((type) => type.id === "dj")?.priceCents > 0);
    });
  },

  async S2(check) {
    const date = futureDate(21);
    const calendarBusyStart = isoAt(date, 12);
    const localHoldStart = isoAt(date, 14);
    const seedDb = makeDb({
      bookings: [
        makeBooking({
          id: "local-hold",
          status: "pending_payment",
          startUtc: localHoldStart,
          endUtc: isoAt(date, 15),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        })
      ]
    });

    await withHarness(
      {
        seedDb,
        mock: {
          busyEvents: [
            {
              uid: "calendar-busy",
              startUtc: calendarBusyStart,
              endUtc: isoAt(date, 13)
            }
          ]
        }
      },
      async (harness) => {
        const availability = await requestJson(harness.baseUrl, `/api/booking/availability?date=${date}&bookingType=dj`);
        check.equal("availability status code", availability.status, 200);
        check.equal("calendar status", availability.body.calendar.status, "connected", availability.body.calendar);
        check.ok("caldav report was requested", harness.mock.calls.caldav.some((call) => call.method === "REPORT"));

        const starts = availability.body.slots.map((slot) => slot.startUtc);
        check.ok("calendar busy slot absent", !starts.includes(calendarBusyStart), { starts, calendarBusyStart });
        check.ok("local hold slot absent", !starts.includes(localHoldStart), { starts, localHoldStart });
        check.ok("open slot remains", starts.includes(isoAt(date, 10)), { starts });
      }
    );
  },

  async S3(check) {
    const date = futureDate(22);
    await withHarness({}, async (harness) => {
      const create = await createBooking(harness, date, 10);
      check.equal("create status code", create.status, 201, create.body);
      check.equal("booking status", create.body.status, "pending_payment", create.body);
      check.ok("checkout URL uses local stub", create.body.checkoutUrl.startsWith(`${harness.mock.mollieUrl}/checkout/`), {
        checkoutUrl: create.body.checkoutUrl
      });

      const db = await readDb(harness.dbPath);
      const booking = db.bookings.find((entry) => entry.id === create.body.bookingId);
      check.ok("booking persisted", Boolean(booking), { bookingId: create.body.bookingId });
      check.equal("persisted booking status", booking.status, "pending_payment");
      check.ok("payment persisted", db.payments.some((payment) => payment.bookingId === create.body.bookingId));

      check.ok("crm contact request sent", harness.mock.calls.crm.some((call) => call.method === "POST" && call.path === "/api/v1/Contact"));
      check.ok("crm booking request sent", harness.mock.calls.crm.some((call) => call.method === "POST" && call.path === "/api/v1/DJBooking"));

      const paymentCall = harness.mock.calls.mollie.find((call) => call.method === "POST" && call.path === "/v2/payments");
      check.ok("mollie payment request sent", Boolean(paymentCall));
      check.equal("mollie metadata booking id", paymentCall.body.metadata.bookingId, create.body.bookingId);
    });
  },

  async S4(check) {
    const date = futureDate(23);
    await withHarness({}, async (harness) => {
      const create = await createBooking(harness, date, 11);
      check.equal("create precondition", create.status, 201, create.body);

      let db = await readDb(harness.dbPath);
      const paymentId = db.bookings.find((entry) => entry.id === create.body.bookingId)?.molliePaymentId;
      check.ok("payment id persisted before webhook", Boolean(paymentId), { paymentId });

      harness.mock.setPaymentStatus(paymentId, "paid");
      const webhook = await requestText(harness.baseUrl, "/api/webhooks/mollie", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ id: paymentId }).toString()
      });

      check.equal("webhook status code", webhook.status, 200);
      check.equal("webhook response", webhook.text, "ok");

      db = await readDb(harness.dbPath);
      const booking = db.bookings.find((entry) => entry.id === create.body.bookingId);
      const payment = db.payments.find((entry) => entry.molliePaymentId === paymentId);
      check.equal("booking confirmed", booking.status, "confirmed", booking);
      check.equal("payment marked paid", payment.status, "paid", payment);
      check.ok("calendar event created", harness.mock.calls.caldav.some((call) => call.method === "PUT"));
      check.ok("crm received status updates", harness.mock.calls.crm.filter((call) => call.method === "PUT" && call.path.startsWith("/api/v1/DJBooking/")).length >= 2);
    });
  },

  async S5(check) {
    const date = futureDate(24);
    const bookingId = "confirmed-admin-booking";
    const caldavEventUid = "marcsmusic-confirmed-admin-booking@marcsmusic.nl";
    const seedDb = makeDb({
      bookings: [
        makeBooking({
          id: bookingId,
          status: "confirmed",
          startUtc: isoAt(date, 16),
          endUtc: isoAt(date, 17),
          crmBookingId: "crm-booking-seeded",
          caldavEventUid
        })
      ]
    });

    await withHarness({ seedDb }, async (harness) => {
      const forwardedIp = "203.0.113.42";
      const newsletter = await requestJson(harness.baseUrl, "/api/newsletter/subscribe", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": forwardedIp
        },
        body: JSON.stringify({
          name: "Newsletter Fan",
          email: "fan@example.com"
        })
      });
      check.equal("newsletter status code", newsletter.status, 200);
      check.equal("newsletter crm status", newsletter.body.status, "synced", newsletter.body);

      let db = await readDb(harness.dbPath);
      const subscription = db.newsletterSubscriptions.find((entry) => entry.email === "fan@example.com");
      check.ok("newsletter persisted", Boolean(subscription), db.newsletterSubscriptions);
      check.ok("consent ip is hashed", /^[a-f0-9]{64}$/.test(subscription.consentIpHash) && subscription.consentIpHash !== forwardedIp, {
        consentIpHash: subscription.consentIpHash
      });

      const unauthorized = await requestJson(harness.baseUrl, "/api/admin/bookings");
      check.equal("admin rejects missing token", unauthorized.status, 401, unauthorized.body);

      const list = await requestJson(harness.baseUrl, "/api/admin/bookings", {
        headers: { authorization: `Bearer ${adminToken}` }
      });
      check.equal("admin list succeeds", list.status, 200);
      check.ok("admin list includes seeded booking", list.body.bookings.some((booking) => booking.id === bookingId));

      const cancel = await requestJson(harness.baseUrl, `/api/admin/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { authorization: `Bearer ${adminToken}` }
      });
      check.equal("cancel status code", cancel.status, 200, cancel.body);

      db = await readDb(harness.dbPath);
      const cancelled = db.bookings.find((entry) => entry.id === bookingId);
      check.equal("booking cancelled", cancelled.status, "cancelled", cancelled);
      check.ok("calendar delete sent", harness.mock.calls.caldav.some((call) => call.method === "DELETE" && call.path.includes(encodeURIComponent(caldavEventUid))));
    });
  }
};

for (const scenario of scenarioDefinitions) {
  test(`${scenario.id} - ${scenario.title}`, async () => {
    await runScenario(scenario, scenarioRunners[scenario.id]);
  });
}

async function runScenario(scenario, runner) {
  const checks = [];
  const startedAt = Date.now();
  const check = makeCheckRecorder(checks);

  try {
    await runner(check);
    runEvidence.scenarios.push({
      id: scenario.id,
      title: scenario.title,
      criteria: scenario.criteria,
      outcome: "pass",
      durationMs: Date.now() - startedAt,
      checks
    });
  } catch (error) {
    runEvidence.scenarios.push({
      id: scenario.id,
      title: scenario.title,
      criteria: scenario.criteria,
      outcome: "fail",
      durationMs: Date.now() - startedAt,
      checks,
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    throw error;
  }
}

function makeCheckRecorder(checks) {
  return {
    equal(label, actual, expected, details = {}) {
      const pass = Object.is(actual, expected);
      checks.push({ label, pass, actual, expected, details });
      assert.equal(actual, expected, label);
    },
    ok(label, condition, details = {}) {
      const pass = Boolean(condition);
      checks.push({ label, pass, details });
      assert.ok(condition, label);
    }
  };
}

async function withHarness(options, work) {
  const mock = await startMockServices(options.mock || {});
  const tempDir = await mkdtemp(join(tmpdir(), "marcsmusic-scenario-"));
  const legacyDbPath = join(tempDir, "bookings.json");
  const dbPath = join(tempDir, "bookings.sqlite");
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const logs = { stdout: "", stderr: "" };

  if (options.seedDb) {
    await writeFile(legacyDbPath, JSON.stringify(options.seedDb, null, 2), "utf8");
  }

  const child = spawn(process.execPath, ["server.js"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(port),
      APP_BASE_URL: baseUrl,
      BOOKING_DB_PATH: legacyDbPath,
      BOOKING_SQLITE_PATH: dbPath,
      BOOKING_TIMEZONE: "UTC",
      BOOKING_WORKDAY_START: "10:00",
      BOOKING_WORKDAY_END: "18:00",
      BOOKING_SLOT_STEP_MINUTES: "60",
      BOOKING_BUFFER_MINUTES: "0",
      BOOKING_MIN_LEAD_HOURS: "0",
      BOOKING_PENDING_HOLD_MINUTES: "20",
      BOOKING_MAX_CONSECUTIVE_SLOTS: "4",
      BOOKING_PRICE_DJ_CENTS: "20000",
      BOOKING_DURATION_DJ_MINUTES: "60",
      BOOKING_TRAVEL_RATE_CENTS_PER_HOUR: "7500",
      BOOKING_MAX_TRAVEL_HOURS: "24",
      CALDAV_BASE_URL: mock.caldavUrl,
      CALDAV_USERNAME: "scenario-user",
      CALDAV_PASSWORD: "scenario-password",
      CALDAV_CALENDAR_PATH: "/calendar/",
      ESPOCRM_BASE_URL: mock.crmUrl,
      ESPOCRM_API_KEY: "scenario-crm-key",
      ESPOCRM_USE_CUSTOM_FIELDS: "false",
      CRM_BOOKING_ENTITY: "DJBooking",
      CRM_NEWSLETTER_LIST: "MarcsMusic Newsletter",
      CRM_SOURCE_WEBSITE: "scenario-suite",
      MOLLIE_API_KEY: "scenario-mollie-key",
      MOLLIE_API_BASE_URL: mock.mollieUrl,
      ADMIN_TOKEN: adminToken,
      PRIVACY_HASH_SALT: "scenario-privacy-salt",
      NEWSLETTER_FROM_EMAIL: "noreply@example.test",
      NEWSLETTER_FROM_NAME: "MarcsMusic Test",
      RAILWAY_ENVIRONMENT: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => {
    logs.stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    logs.stderr += chunk.toString();
  });

  try {
    await waitForServer(child, logs, baseUrl);
    await work({ baseUrl, dbPath, mock, logs });
  } catch (error) {
    error.message += `\nserver stdout:\n${logs.stdout}\nserver stderr:\n${logs.stderr}`;
    process.stderr.write(`\n${logs.stderr}\n`);
    throw error;
  } finally {
    await stopChild(child);
    await mock.close();
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function startMockServices(options) {
  const state = {
    calls: {
      crm: [],
      mollie: [],
      caldav: []
    },
    contacts: new Map(),
    crmContactCounter: 0,
    crmBookingCounter: 0,
    paymentCounter: 0,
    payments: new Map(),
    busyEvents: [...(options.busyEvents || [])],
    calendarObjects: new Map()
  };

  const crmServer = createServer((request, response) => {
    void handleCrmRequest(request, response, state);
  });
  const mollieServer = createServer((request, response) => {
    void handleMollieRequest(request, response, state);
  });
  const caldavServer = createServer((request, response) => {
    void handleCalDavRequest(request, response, state);
  });

  const [crmUrl, mollieUrl, caldavUrl] = await Promise.all([
    listenOnRandomPort(crmServer),
    listenOnRandomPort(mollieServer),
    listenOnRandomPort(caldavServer)
  ]);
  state.mollieUrl = mollieUrl;

  return {
    crmUrl,
    mollieUrl,
    caldavUrl,
    calls: state.calls,
    setPaymentStatus(paymentId, status) {
      const payment = state.payments.get(paymentId);
      if (!payment) {
        throw new Error(`Unknown payment id ${paymentId}`);
      }
      payment.status = status;
    },
    async close() {
      await Promise.all([closeServer(crmServer), closeServer(mollieServer), closeServer(caldavServer)]);
    }
  };
}

async function handleCrmRequest(request, response, state) {
  const url = new URL(request.url || "/", "http://crm.local");
  const rawBody = await readRequestBody(request);
  const body = parseJson(rawBody);
  state.calls.crm.push({ method: request.method, path: url.pathname, search: url.search, body });

  if (!url.pathname.startsWith("/api/v1/")) {
    sendJson(response, 404, { message: "not found" });
    return;
  }

  const apiPath = url.pathname.replace(/^\/api\/v1\//, "");

  if (request.method === "GET" && apiPath === "Contact") {
    const email = url.searchParams.get("where[0][value]") || "";
    const contact = state.contacts.get(email);
    sendJson(response, 200, { list: contact ? [contact] : [] });
    return;
  }

  if (request.method === "POST" && apiPath === "Contact") {
    const id = `contact-${++state.crmContactCounter}`;
    const contact = { id, ...body };
    state.contacts.set(body.emailAddress, contact);
    sendJson(response, 200, contact);
    return;
  }

  if (request.method === "PUT" && apiPath.startsWith("Contact/")) {
    const id = decodeURIComponent(apiPath.split("/")[1] || "");
    const contact = { id, ...body };
    state.contacts.set(body.emailAddress, contact);
    sendJson(response, 200, contact);
    return;
  }

  if (request.method === "GET" && apiPath === "TargetList") {
    sendJson(response, 200, { list: [{ id: "target-list-1", name: "MarcsMusic Newsletter" }] });
    return;
  }

  if (request.method === "GET" && apiPath === "DJBooking") {
    sendJson(response, 200, { list: [] });
    return;
  }

  if (request.method === "POST" && apiPath === "TargetList/target-list-1/contacts") {
    sendJson(response, 200, { id: body.id });
    return;
  }

  if (request.method === "POST" && apiPath === "DJBooking") {
    const id = `crm-booking-${++state.crmBookingCounter}`;
    sendJson(response, 200, { id, ...body });
    return;
  }

  if (request.method === "PUT" && apiPath.startsWith("DJBooking/")) {
    const id = decodeURIComponent(apiPath.split("/")[1] || "");
    sendJson(response, 200, { id, ...body });
    return;
  }

  sendJson(response, 404, { message: `Unhandled CRM route ${request.method} ${apiPath}` });
}

async function handleMollieRequest(request, response, state) {
  const url = new URL(request.url || "/", "http://mollie.local");
  const rawBody = await readRequestBody(request);
  const body = parseJson(rawBody);
  state.calls.mollie.push({ method: request.method, path: url.pathname, body });

  if (request.method === "POST" && url.pathname === "/v2/payments") {
    const id = `tr_${String(++state.paymentCounter).padStart(8, "0")}`;
    const payment = {
      id,
      status: "open",
      amount: body.amount,
      metadata: body.metadata || {}
    };
    state.payments.set(id, payment);
    sendJson(response, 201, {
      id,
      status: payment.status,
      _links: {
        checkout: {
          href: `${state.mollieUrl || ""}/checkout/${id}`
        }
      }
    });
    return;
  }

  const paymentMatch = url.pathname.match(/^\/v2\/payments\/([^/]+)$/);
  if (request.method === "GET" && paymentMatch) {
    const id = decodeURIComponent(paymentMatch[1]);
    const payment = state.payments.get(id);
    if (!payment) {
      sendJson(response, 404, { detail: "payment not found" });
      return;
    }
    sendJson(response, 200, payment);
    return;
  }

  sendJson(response, 404, { detail: `Unhandled Mollie route ${request.method} ${url.pathname}` });
}

async function handleCalDavRequest(request, response, state) {
  const url = new URL(request.url || "/", "http://caldav.local");
  const rawBody = await readRequestBody(request);
  state.calls.caldav.push({ method: request.method, path: url.pathname, body: rawBody });

  if (["REPORT", "PROPFIND"].includes(request.method || "")) {
    const events = [
      ...state.busyEvents.map((event) => buildIcsEvent(event)),
      ...state.calendarObjects.values()
    ];
    sendText(response, 207, buildCalendarMultiStatus(events), {
      "content-type": "application/xml; charset=utf-8"
    });
    return;
  }

  if (request.method === "GET") {
    const value = state.calendarObjects.get(url.pathname);
    if (value) sendText(response, 200, value, { "content-type": "text/calendar" });
    else sendText(response, 404, "not found");
    return;
  }

  if (request.method === "PUT") {
    if (state.calendarObjects.has(url.pathname) && request.headers["if-none-match"] === "*") {
      sendText(response, 412, "exists");
      return;
    }
    state.calendarObjects.set(url.pathname, rawBody);
    sendText(response, 201, "");
    return;
  }

  if (request.method === "DELETE") {
    state.calendarObjects.delete(url.pathname);
    sendText(response, 204, "");
    return;
  }

  sendText(response, 404, "not found");
}

async function createBooking(harness, date, hour) {
  return requestJson(harness.baseUrl, "/api/booking/create", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `scenario-${date}-${hour}-${randomUUID()}`
    },
    body: JSON.stringify({
      bookingType: "dj",
      startUtc: isoAt(date, hour),
      slotCount: 1,
      travelHours: 0,
      name: "Scenario Booker",
      email: `booker-${hour}@example.com`,
      phone: "0612345678",
      location: "Amsterdam",
      message: "Scenario test booking"
    })
  });
}

function makeDb(overrides = {}) {
  return {
    bookings: [],
    payments: [],
    newsletterSubscriptions: [],
    audit: [],
    ...overrides
  };
}

function makeBooking(overrides = {}) {
  const now = new Date().toISOString();
  const id = overrides.id || randomUUID();
  return {
    id,
    status: "pending_payment",
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    bookingType: "dj",
    bookingTypeLabel: "DJ / muziek event",
    startUtc: isoAt(futureDate(30), 10),
    endUtc: isoAt(futureDate(30), 11),
    timeZone: "UTC",
    slotCount: 1,
    unitDurationMinutes: 60,
    durationMinutes: 60,
    unitPriceCents: 20000,
    performancePriceCents: 20000,
    travelHours: 0,
    billableTravelHours: 0,
    travelRateCentsPerHour: 7500,
    travelCostCents: 0,
    priceCents: 20000,
    currency: "EUR",
    customer: {
      name: "Scenario Customer",
      email: "customer@example.com",
      phone: "0612345678",
      location: "Amsterdam",
      message: "Seeded booking"
    },
    crmContactId: "contact-seeded",
    crmBookingId: null,
    molliePaymentId: null,
    checkoutUrl: null,
    caldavEventUid: null,
    calendarUrl: null,
    ...overrides
  };
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : {},
    text
  };
}

async function requestText(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return {
    status: response.status,
    text: await response.text()
  };
}

async function readDb(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const read = (table) => db.prepare(`SELECT payload FROM ${table}`).all().map((row) => JSON.parse(row.payload));
    return { bookings: read("bookings"), payments: read("payments"), newsletterSubscriptions: read("subscriptions"),
      assignments: read("assignments"), audit: read("audit_events") };
  } finally {
    db.close();
  }
}

async function waitForServer(child, logs, baseUrl) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5000) {
    if (child.exitCode !== null) {
      throw new Error(`server exited before readiness\nstdout:\n${logs.stdout}\nstderr:\n${logs.stderr}`);
    }

    if (logs.stdout.includes('"event":"server.started"')) {
      const health = await fetch(`${baseUrl}/api/health`).catch(() => null);
      if (health?.ok) {
        return;
      }
    }

    await delay(50);
  }

  throw new Error(`server did not become ready\nstdout:\n${logs.stdout}\nstderr:\n${logs.stderr}`);
}

async function stopChild(child) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  const stopped = await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(1000).then(() => false)
  ]);

  if (stopped === false && child.exitCode === null) {
    child.kill("SIGKILL");
  }
}

async function getFreePort() {
  const server = createServer();
  const url = await listenOnRandomPort(server);
  await closeServer(server);
  return Number(new URL(url).port);
}

async function listenOnRandomPort(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server) {
  if (!server.listening) {
    return;
  }
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function parseJson(raw) {
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, status, text, headers = {}) {
  response.writeHead(status, headers);
  response.end(text);
}

function buildCalendarMultiStatus(events) {
  const responses = events
    .map(
      (ics, index) => `<d:response>
  <d:href>/calendar/event-${index}.ics</d:href>
  <d:propstat>
    <d:prop>
      <c:calendar-data><![CDATA[${ics}]]></c:calendar-data>
    </d:prop>
    <d:status>HTTP/1.1 200 OK</d:status>
  </d:propstat>
</d:response>`
    )
    .join("");

  return `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
${responses}
</d:multistatus>`;
}

function buildIcsEvent({ uid, startUtc, endUtc, bookingId = "" }) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${formatIcsDate(new Date(startUtc))}`,
    `DTEND:${formatIcsDate(new Date(endUtc))}`,
    "SUMMARY:Scenario busy event",
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    bookingId ? `X-MARCSMUSIC-BOOKING-ID:${bookingId}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
    ""
  ]
    .filter((line) => line !== "")
    .join("\r\n");
}

function futureDate(daysFromNow) {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function isoAt(date, hour) {
  return `${date}T${String(hour).padStart(2, "0")}:00:00.000Z`;
}

function formatIcsDate(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
