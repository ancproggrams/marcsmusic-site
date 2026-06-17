import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(".");
const port = Number.parseInt(process.env.PORT || "3000", 10);
const bookingDbPath = process.env.BOOKING_DB_PATH || (process.env.RAILWAY_ENVIRONMENT ? "/data/bookings.json" : join(root, "data", "bookings.json"));
const bookingTimeZone = process.env.BOOKING_TIMEZONE || "Europe/Amsterdam";
const pendingHoldMinutes = numberFromEnv("BOOKING_PENDING_HOLD_MINUTES", 20);
const bookingBufferMinutes = numberFromEnv("BOOKING_BUFFER_MINUTES", 30);
const minLeadHours = numberFromEnv("BOOKING_MIN_LEAD_HOURS", 24);
const workdayStart = process.env.BOOKING_WORKDAY_START || "10:00";
const workdayEnd = process.env.BOOKING_WORKDAY_END || "22:00";
const slotStepMinutes = numberFromEnv("BOOKING_SLOT_STEP_MINUTES", 30);
const maxConsecutiveSlots = Math.max(1, numberFromEnv("BOOKING_MAX_CONSECUTIVE_SLOTS", 4));
const travelRateCentsPerHour = Math.max(0, numberFromEnv("BOOKING_TRAVEL_RATE_CENTS_PER_HOUR", 7500));
const maxTravelHours = Math.max(0, numberFromEnv("BOOKING_MAX_TRAVEL_HOURS", 24));
const appBaseUrl = stripTrailingSlash(process.env.APP_BASE_URL || "https://www.marcsmusic.nl");
const crmSource = process.env.CRM_SOURCE_WEBSITE || "marcsmusic.nl";
const crmBookingEntity = process.env.CRM_BOOKING_ENTITY || "DJBooking";
const crmNewsletterList = process.env.CRM_NEWSLETTER_LIST || "MarcsMusic Newsletter";
const newsletterFromEmail = process.env.NEWSLETTER_FROM_EMAIL || "noreply@marcsmusic.nl";
const newsletterFromName = process.env.NEWSLETTER_FROM_NAME || "MarcsMusic";

if (process.env.RAILWAY_ENVIRONMENT && !process.env.PRIVACY_HASH_SALT) {
  throw new Error("PRIVACY_HASH_SALT must be set for Railway deployments.");
}

const privacyHashSalt = process.env.PRIVACY_HASH_SALT || "development-only-salt";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8"
};

const bookingTypes = [
  {
    id: "studio",
    label: "Studio sessie",
    durationMinutes: numberFromEnv("BOOKING_DURATION_STUDIO_MINUTES", 60),
    priceCents: numberFromEnv("BOOKING_PRICE_STUDIO_CENTS", 7500)
  },
  {
    id: "dj",
    label: "DJ / muziek event",
    durationMinutes: numberFromEnv("BOOKING_DURATION_DJ_MINUTES", 60),
    priceCents: numberFromEnv("BOOKING_PRICE_DJ_CENTS", 20000)
  },
  {
    id: "other",
    label: "Anders",
    durationMinutes: numberFromEnv("BOOKING_DURATION_OTHER_MINUTES", 60),
    priceCents: numberFromEnv("BOOKING_PRICE_OTHER_CENTS", 9900)
  }
];

let dbQueue = Promise.resolve();
const rateLimitBuckets = new Map();

function numberFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) ? value : fallback;
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/$/, "");
}

function getPublicConfig() {
  return {
    bookingTypes: bookingTypes.map((type) => ({
      id: type.id,
      label: type.label,
      durationMinutes: type.durationMinutes,
      priceCents: type.priceCents,
      price: formatMoney(type.priceCents)
    })),
    currency: "EUR",
    timeZone: bookingTimeZone,
    workdayStart,
    workdayEnd,
    slotStepMinutes,
    maxConsecutiveSlots,
    bookingBufferMinutes,
    minLeadHours,
    travelRateCentsPerHour,
    travelRate: formatMoney(travelRateCentsPerHour),
    pricesExcludeVat: true,
    integrations: {
      calendarConfigured: isCalendarConfigured(),
      crmConfigured: isCrmConfigured(),
      mollieConfigured: Boolean(process.env.MOLLIE_API_KEY)
    }
  };
}

function getBookingType(id) {
  return bookingTypes.find((type) => type.id === id);
}

function isCalendarConfigured() {
  return Boolean(
    process.env.CALDAV_BASE_URL &&
      process.env.CALDAV_USERNAME &&
      process.env.CALDAV_PASSWORD &&
      process.env.CALDAV_CALENDAR_PATH
  );
}

function isCrmConfigured() {
  return Boolean(process.env.ESPOCRM_BASE_URL && process.env.ESPOCRM_API_KEY);
}

async function ensureDbFile() {
  if (existsSync(bookingDbPath)) {
    return;
  }

  await mkdir(dirname(bookingDbPath), { recursive: true });
  await writeFile(
    bookingDbPath,
    JSON.stringify({ bookings: [], payments: [], newsletterSubscriptions: [], audit: [] }, null, 2),
    "utf8"
  );
}

async function readDb() {
  await ensureDbFile();
  const raw = await readFile(bookingDbPath, "utf8");
  const parsed = JSON.parse(raw);
  return {
    bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
    payments: Array.isArray(parsed.payments) ? parsed.payments : [],
    newsletterSubscriptions: Array.isArray(parsed.newsletterSubscriptions) ? parsed.newsletterSubscriptions : [],
    audit: Array.isArray(parsed.audit) ? parsed.audit : []
  };
}

async function writeDb(db) {
  await mkdir(dirname(bookingDbPath), { recursive: true });
  const tmpPath = `${bookingDbPath}.${process.pid}.tmp`;
  await writeFile(tmpPath, JSON.stringify(db, null, 2), "utf8");
  await rename(tmpPath, bookingDbPath);
}

function withDb(work) {
  const next = dbQueue.then(async () => {
    const db = await readDb();
    expireOldPendingBookings(db);
    const result = await work(db);
    await writeDb(db);
    return result;
  });

  dbQueue = next.catch(() => {});
  return next;
}

function audit(db, action, details = {}) {
  db.audit.unshift({
    id: randomUUID(),
    action,
    at: new Date().toISOString(),
    details
  });
  db.audit = db.audit.slice(0, 1000);
}

function expireOldPendingBookings(db) {
  const now = Date.now();
  for (const booking of db.bookings) {
    if (booking.status === "pending_payment" && Date.parse(booking.expiresAt) <= now) {
      booking.status = "expired";
      booking.updatedAt = new Date().toISOString();
      if (booking.crmBookingId) {
        queueCrmStatusUpdate(booking, "expired");
      }
    }
  }
}

function getFilePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const requested = decoded === "/" ? "/index.html" : decoded;
  const aliases = {
    "/booking": "/booking.html",
    "/booking/": "/booking.html",
    "/booking/success": "/booking.html",
    "/booking/cancelled": "/booking.html",
    "/admin": "/admin.html"
  };
  const safeRequested = aliases[requested] || requested;
  const safePath = normalize(safeRequested).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(root, safePath);

  if (!filePath.startsWith(root + sep) && filePath !== root) {
    return null;
  }

  return filePath;
}

function sendJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, status, text) {
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(text);
}

async function readBody(request, limitBytes = 64 * 1024) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > limitBytes) {
      throw Object.assign(new Error("Request body too large"), { statusCode: 413 });
    }
  }
  return body;
}

async function readJsonBody(request) {
  const body = await readBody(request);
  if (!body.trim()) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw Object.assign(new Error("Invalid JSON body"), { statusCode: 400 });
  }
}

async function readFormBody(request) {
  const body = await readBody(request);
  return Object.fromEntries(new URLSearchParams(body));
}

function getClientIp(request) {
  return String(
    request.headers["cf-connecting-ip"] ||
      request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      request.socket.remoteAddress ||
      "unknown"
  );
}

function hashIp(request) {
  return createHash("sha256").update(`${getClientIp(request)}:${privacyHashSalt}`).digest("hex");
}

function enforceRateLimit(request, response) {
  const key = getClientIp(request);
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 30;
  const bucket = rateLimitBuckets.get(key) || { count: 0, resetAt: now + windowMs };

  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);

  if (bucket.count > maxRequests) {
    sendJson(response, 429, { error: "Te veel aanvragen. Probeer het zo opnieuw." });
    return false;
  }

  return true;
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, {
      status: "ok",
      service: "marcsmusic-booking",
      environment: process.env.RAILWAY_ENVIRONMENT || "production",
      uptimeSeconds: Math.round(process.uptime()),
      storagePath: bookingDbPath,
      integrations: getPublicConfig().integrations
    });
    return;
  }

  if ((url.pathname.startsWith("/api/booking") || url.pathname.startsWith("/api/newsletter")) && !enforceRateLimit(request, response)) {
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/booking/config") {
    sendJson(response, 200, getPublicConfig());
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/booking/availability") {
    const availability = await getAvailability({
      date: url.searchParams.get("date") || "",
      bookingType: url.searchParams.get("bookingType") || ""
    });
    sendJson(response, 200, availability);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/booking/create") {
    const booking = await createBooking(await readJsonBody(request));
    sendJson(response, 201, booking);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/booking/status") {
    const id = url.searchParams.get("id") || "";
    const db = await readDb();
    const booking = db.bookings.find((entry) => entry.id === id);
    if (!booking) {
      sendJson(response, 404, { error: "Booking niet gevonden." });
      return;
    }

    sendJson(response, 200, publicBookingStatus(booking));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/newsletter/subscribe") {
    const result = await subscribeNewsletter(await readJsonBody(request), request);
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/webhooks/mollie") {
    const payload = request.headers["content-type"]?.includes("application/json")
      ? await readJsonBody(request)
      : await readFormBody(request);
    await handleMollieWebhook(payload);
    sendText(response, 200, "ok");
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/bookings") {
    if (!requireAdmin(request, response)) {
      return;
    }

    const db = await readDb();
    sendJson(response, 200, {
      bookings: db.bookings
        .slice()
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .map((booking) => ({ ...booking, customer: redactCustomerForAdmin(booking.customer) }))
    });
    return;
  }

  const cancelMatch = url.pathname.match(/^\/api\/admin\/bookings\/([^/]+)\/cancel$/);
  if (request.method === "POST" && cancelMatch) {
    if (!requireAdmin(request, response)) {
      return;
    }

    const result = await cancelBooking(cancelMatch[1]);
    sendJson(response, 200, result);
    return;
  }

  sendJson(response, 404, { error: "API endpoint niet gevonden." });
}

function requireAdmin(request, response) {
  if (!process.env.ADMIN_TOKEN) {
    sendJson(response, 503, { error: "ADMIN_TOKEN is nog niet ingesteld." });
    return false;
  }

  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (token !== process.env.ADMIN_TOKEN) {
    sendJson(response, 401, { error: "Ongeldige admin token." });
    return false;
  }

  return true;
}

function redactCustomerForAdmin(customer) {
  return {
    name: customer?.name || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    location: customer?.location || "",
    message: customer?.message || ""
  };
}

async function subscribeNewsletter(input, request) {
  const email = cleanText(input.email, 160).toLowerCase();
  const name = cleanText(input.name, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error("Vul een geldig e-mailadres in."), { statusCode: 400 });
  }

  const now = new Date().toISOString();
  let crmStatus = "not_configured";
  let crmContactId = null;

  try {
    if (isCrmConfigured()) {
      const contact = await createOrUpdateCrmContact({
        name,
        email,
        phone: "",
        location: "",
        message: "",
        newsletterOptIn: true,
        consentAt: now,
        consentSource: "website",
        consentIpHash: hashIp(request),
        newsletterFromEmail,
        newsletterFromName
      });
      crmStatus = "synced";
      crmContactId = contact.id || null;
      await addContactToNewsletterList(contact.id).catch((error) => {
        console.error(`CRM newsletter list sync failed: ${publicErrorMessage(error)}`);
      });
    }
  } catch (error) {
    crmStatus = "pending_retry";
    console.error(`CRM newsletter sync failed: ${publicErrorMessage(error)}`);
  }

  await withDb(async (db) => {
    const existing = db.newsletterSubscriptions.find((entry) => entry.email === email);
    const record = {
      email,
      name,
      newsletterOptIn: true,
      consentAt: existing?.consentAt || now,
      consentSource: "website",
      consentIpHash: hashIp(request),
      newsletterFromEmail,
      newsletterFromName,
      crmStatus,
      crmContactId,
      updatedAt: now
    };

    if (existing) {
      Object.assign(existing, record);
    } else {
      db.newsletterSubscriptions.unshift(record);
    }
    audit(db, "newsletter.subscribed", { email, crmStatus, crmContactId });
  });

  return {
    ok: true,
    status: crmStatus,
    message:
      crmStatus === "synced"
        ? "Je staat op de MarcsMusic mailing list."
        : "Je inschrijving is ontvangen. CRM-sync wordt afgerond zodra de CRM-koppeling actief is."
  };
}

async function getAvailability({ date, bookingType }) {
  const type = getBookingType(bookingType);
  if (!type) {
    throw Object.assign(new Error("Ongeldig bookingtype."), { statusCode: 400 });
  }

  if (!isIsoDate(date)) {
    throw Object.assign(new Error("Ongeldige datum."), { statusCode: 400 });
  }

  const dayStart = localDateTimeToUtc(date, workdayStart, bookingTimeZone);
  const dayEnd = localDateTimeToUtc(date, workdayEnd, bookingTimeZone);
  const calendarResult = await getCalDavBusyIntervals(dayStart, dayEnd);
  if (calendarResult.status === "error") {
    return {
      date,
      bookingType: type.id,
      slots: [],
      calendar: {
        configured: isCalendarConfigured(),
        status: calendarResult.status,
        message: calendarResult.message
      }
    };
  }

  const db = await readDb();
  expireOldPendingBookings(db);

  const localBusy = getReservedIntervals(db);
  const busy = [...localBusy, ...calendarResult.busy];
  const minStart = new Date(Date.now() + minLeadHours * 60 * 60 * 1000);
  const slots = [];
  const durationMs = type.durationMinutes * 60 * 1000;
  const bufferMs = bookingBufferMinutes * 60 * 1000;

  for (
    let slotStartMs = dayStart.getTime();
    slotStartMs + durationMs <= dayEnd.getTime();
    slotStartMs += slotStepMinutes * 60 * 1000
  ) {
    const slotStart = new Date(slotStartMs);
    const slotEnd = new Date(slotStartMs + durationMs);
    const protectedStart = new Date(slotStart.getTime() - bufferMs);
    const protectedEnd = new Date(slotEnd.getTime() + bufferMs);

    if (slotStart < minStart) {
      continue;
    }

    const isAvailable = !busy.some((interval) => intervalsOverlap(protectedStart, protectedEnd, interval.start, interval.end));
    if (isAvailable) {
      slots.push({
        startUtc: slotStart.toISOString(),
        endUtc: slotEnd.toISOString(),
        label: formatLocalTime(slotStart),
        dateLabel: formatLocalDate(slotStart),
        durationMinutes: type.durationMinutes
      });
    }
  }

  return {
    date,
    bookingType: type.id,
    slots,
    calendar: {
      configured: isCalendarConfigured(),
      status: calendarResult.status,
      message: calendarResult.message
    }
  };
}

async function createBooking(input) {
  requireBookingIntegrations();
  const type = getBookingType(String(input.bookingType || ""));
  if (!type) {
    throw Object.assign(new Error("Kies een geldig bookingtype."), { statusCode: 400 });
  }

  const startUtc = new Date(String(input.startUtc || ""));
  if (!Number.isFinite(startUtc.getTime())) {
    throw Object.assign(new Error("Kies een geldige datum en tijd."), { statusCode: 400 });
  }

  const slotCount = normalizeSlotCount(input.slotCount);
  const travelHours = normalizeTravelHours(input.travelHours);
  const quote = calculateBookingQuote(type, slotCount, travelHours);
  const endUtc = new Date(startUtc.getTime() + quote.durationMinutes * 60 * 1000);
  const dayEnd = localDateTimeToUtc(formatLocalInputDate(startUtc), workdayEnd, bookingTimeZone);
  if (endUtc > dayEnd) {
    throw Object.assign(new Error("Kies minder aansluitende blokken; deze booking valt buiten de beschikbare dag."), { statusCode: 409 });
  }

  const customer = validateCustomer(input);
  const availability = await getAvailability({
    date: formatLocalInputDate(startUtc),
    bookingType: type.id
  });
  const selectedSlot = availability.slots.find((slot) => slot.startUtc === startUtc.toISOString());

  if (!selectedSlot) {
    throw Object.assign(new Error("Dit tijdslot is niet meer beschikbaar."), { statusCode: 409 });
  }

  const intervalAvailability = await isBookingWindowAvailable(startUtc, endUtc);
  if (!intervalAvailability.ok) {
    throw Object.assign(new Error(intervalAvailability.reason), { statusCode: 409 });
  }

  const bookingId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + pendingHoldMinutes * 60 * 1000);

  const created = await withDb(async (db) => {
    const localBusy = getReservedIntervals(db);
    const protectedStart = new Date(startUtc.getTime() - bookingBufferMinutes * 60 * 1000);
    const protectedEnd = new Date(endUtc.getTime() + bookingBufferMinutes * 60 * 1000);
    if (localBusy.some((interval) => intervalsOverlap(protectedStart, protectedEnd, interval.start, interval.end))) {
      throw Object.assign(new Error("Dit tijdslot is net gereserveerd door iemand anders."), { statusCode: 409 });
    }

    const booking = {
      id: bookingId,
      status: "pending_payment",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      bookingType: type.id,
      bookingTypeLabel: type.label,
      startUtc: startUtc.toISOString(),
      endUtc: endUtc.toISOString(),
      timeZone: bookingTimeZone,
      slotCount,
      unitDurationMinutes: type.durationMinutes,
      durationMinutes: quote.durationMinutes,
      unitPriceCents: type.priceCents,
      performancePriceCents: quote.performancePriceCents,
      travelHours: quote.travelHours,
      billableTravelHours: quote.billableTravelHours,
      travelRateCentsPerHour,
      travelCostCents: quote.travelCostCents,
      priceCents: quote.totalPriceCents,
      currency: "EUR",
      customer,
      crmContactId: null,
      crmBookingId: null,
      molliePaymentId: null,
      checkoutUrl: null,
      caldavEventUid: null,
      calendarUrl: null
    };

    db.bookings.unshift(booking);
    audit(db, "booking.created", { bookingId, status: booking.status });
    return booking;
  });

  try {
    const crmContact = await createOrUpdateCrmContact({
      ...created.customer,
      newsletterOptIn: false,
      consentAt: null,
      consentSource: "booking",
      consentIpHash: null
    });
    const crmBooking = await createCrmBookingRecord(created, crmContact.id);
    await withDb(async (db) => {
      const booking = db.bookings.find((entry) => entry.id === bookingId);
      if (!booking) {
        return;
      }
      booking.crmContactId = crmContact.id || null;
      booking.crmBookingId = crmBooking.id || null;
      booking.updatedAt = new Date().toISOString();
      audit(db, "crm.booking_created", { bookingId, crmContactId: booking.crmContactId, crmBookingId: booking.crmBookingId });
    });

    const payment = await createMolliePayment({ ...created, crmContactId: crmContact.id, crmBookingId: crmBooking.id });
    await withDb(async (db) => {
      const booking = db.bookings.find((entry) => entry.id === bookingId);
      if (!booking) {
        return;
      }

      booking.molliePaymentId = payment.id;
      booking.checkoutUrl = payment.checkoutUrl;
      booking.updatedAt = new Date().toISOString();
      db.payments.unshift({
        id: randomUUID(),
        bookingId,
        molliePaymentId: payment.id,
        status: payment.status || "open",
        amountCents: created.priceCents,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      audit(db, "mollie.payment_created", { bookingId, molliePaymentId: payment.id });
    });
    await updateCrmBookingRecord({ ...created, crmBookingId: crmBooking.id }, { molliePaymentId: payment.id, molliePaymentStatus: payment.status || "open" });

    return {
      bookingId,
      status: "pending_payment",
      checkoutUrl: payment.checkoutUrl,
      expiresAt: created.expiresAt
    };
  } catch (error) {
    await withDb(async (db) => {
      const booking = db.bookings.find((entry) => entry.id === bookingId);
      if (!booking) {
        return;
      }
      booking.status = "setup_failed";
      booking.updatedAt = new Date().toISOString();
      audit(db, "booking.setup_failed", { bookingId, error: publicErrorMessage(error) });
    });
    throw error;
  }
}

function requireBookingIntegrations() {
  if (!isCalendarConfigured()) {
    throw Object.assign(new Error("De agenda is nog niet geconfigureerd."), { statusCode: 503 });
  }
  if (!isCrmConfigured()) {
    throw Object.assign(new Error("EspoCRM is nog niet geconfigureerd."), { statusCode: 503 });
  }
  if (!process.env.MOLLIE_API_KEY) {
    throw Object.assign(new Error("Mollie is nog niet geconfigureerd."), { statusCode: 503 });
  }
}

function validateCustomer(input) {
  const customer = {
    name: cleanText(input.name, 120),
    email: cleanText(input.email, 160).toLowerCase(),
    phone: cleanText(input.phone, 40),
    location: cleanText(input.location, 220),
    message: cleanText(input.message, 1200)
  };

  if (customer.name.length < 2) {
    throw Object.assign(new Error("Vul je naam in."), { statusCode: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
    throw Object.assign(new Error("Vul een geldig e-mailadres in."), { statusCode: 400 });
  }

  if (customer.phone.length < 6) {
    throw Object.assign(new Error("Vul een geldig telefoonnummer in."), { statusCode: 400 });
  }

  if (customer.location.length < 3) {
    throw Object.assign(new Error("Vul de locatie of het eventadres in."), { statusCode: 400 });
  }

  return customer;
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeSlotCount(value) {
  const slotCount = Number.parseInt(String(value || "1"), 10);
  if (!Number.isInteger(slotCount) || slotCount < 1 || slotCount > maxConsecutiveSlots) {
    throw Object.assign(new Error(`Kies 1 tot ${maxConsecutiveSlots} aansluitende blokken.`), { statusCode: 400 });
  }
  return slotCount;
}

function normalizeTravelHours(value) {
  const raw = String(value ?? "").replace(",", ".").trim();
  if (!raw) {
    return 0;
  }

  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours < 0 || hours > maxTravelHours) {
    throw Object.assign(new Error(`Vul 0 tot ${maxTravelHours} reisuren in.`), { statusCode: 400 });
  }
  return Math.round(hours * 100) / 100;
}

function calculateBookingQuote(type, slotCount, travelHours) {
  const durationMinutes = type.durationMinutes * slotCount;
  const performancePriceCents = type.priceCents * slotCount;
  const billableTravelHours = Math.ceil(travelHours);
  const travelCostCents = billableTravelHours * travelRateCentsPerHour;

  return {
    slotCount,
    durationMinutes,
    performancePriceCents,
    travelHours,
    billableTravelHours,
    travelCostCents,
    totalPriceCents: performancePriceCents + travelCostCents
  };
}

async function createMolliePayment(booking) {
  if (!process.env.MOLLIE_API_KEY) {
    throw Object.assign(new Error("Mollie is nog niet geconfigureerd."), { statusCode: 503 });
  }

  const response = await fetch("https://api.mollie.com/v2/payments", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.MOLLIE_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      amount: {
        currency: booking.currency,
        value: centsToMollieValue(booking.priceCents)
      },
      description: `MarcsMusic booking - ${booking.bookingTypeLabel}`,
      redirectUrl: `${appBaseUrl}/booking/success?booking=${encodeURIComponent(booking.id)}`,
      cancelUrl: `${appBaseUrl}/booking/cancelled?booking=${encodeURIComponent(booking.id)}`,
      webhookUrl: `${appBaseUrl}/api/webhooks/mollie`,
      metadata: {
        bookingId: booking.id,
        bookingType: booking.bookingType,
        crmBookingId: booking.crmBookingId || ""
      }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(payload.detail || "Mollie payment kon niet worden aangemaakt."), {
      statusCode: 502
    });
  }

  const checkoutUrl = payload?._links?.checkout?.href;
  if (!payload.id || !checkoutUrl) {
    throw Object.assign(new Error("Mollie response mist checkout URL."), { statusCode: 502 });
  }

  return {
    id: payload.id,
    status: payload.status,
    checkoutUrl
  };
}

async function getMolliePayment(paymentId) {
  if (!process.env.MOLLIE_API_KEY) {
    throw Object.assign(new Error("Mollie is nog niet geconfigureerd."), { statusCode: 503 });
  }

  const response = await fetch(`https://api.mollie.com/v2/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      authorization: `Bearer ${process.env.MOLLIE_API_KEY}`,
      "content-type": "application/json"
    }
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw Object.assign(new Error(payload.detail || "Mollie payment kon niet worden opgehaald."), {
      statusCode: 502
    });
  }

  return payload;
}

async function handleMollieWebhook(payload) {
  const paymentId = cleanText(payload.id, 80);
  if (!paymentId) {
    throw Object.assign(new Error("Webhook mist Mollie payment id."), { statusCode: 400 });
  }

  const payment = await getMolliePayment(paymentId);
  const bookingId = cleanText(payment.metadata?.bookingId, 80);

  const booking = await withDb(async (db) => {
    const found =
      db.bookings.find((entry) => entry.id === bookingId) ||
      db.bookings.find((entry) => entry.molliePaymentId === paymentId);

    if (!found) {
      audit(db, "mollie.webhook_without_booking", { paymentId });
      return null;
    }

    found.molliePaymentId = paymentId;
    found.updatedAt = new Date().toISOString();
    const paymentEntry = db.payments.find((entry) => entry.molliePaymentId === paymentId);
    if (paymentEntry) {
      paymentEntry.status = payment.status;
      paymentEntry.updatedAt = new Date().toISOString();
    } else {
      db.payments.unshift({
        id: randomUUID(),
        bookingId: found.id,
        molliePaymentId: paymentId,
        status: payment.status,
        amountCents: found.priceCents,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    audit(db, "mollie.webhook_received", { bookingId: found.id, paymentId, status: payment.status });
    return { ...found };
  });

  if (!booking) {
    return;
  }

  await updateCrmBookingRecord(booking, { molliePaymentId: paymentId, molliePaymentStatus: payment.status }).catch((error) => {
    console.error(`CRM payment status sync failed: ${publicErrorMessage(error)}`);
  });

  if (payment.status === "paid") {
    await confirmPaidBooking(booking.id);
    return;
  }

  if (["canceled", "expired", "failed"].includes(payment.status)) {
    const status = payment.status === "canceled" ? "cancelled" : `payment_${payment.status}`;
    await withDb(async (db) => {
      const found = db.bookings.find((entry) => entry.id === booking.id);
      if (!found || found.status === "confirmed") {
        return;
      }
      found.status = status;
      found.updatedAt = new Date().toISOString();
      audit(db, "booking.payment_not_paid", { bookingId: found.id, paymentStatus: payment.status });
    });
    await updateCrmBookingRecord(booking, { status, molliePaymentStatus: payment.status }).catch((error) => {
      console.error(`CRM non-paid status sync failed: ${publicErrorMessage(error)}`);
    });
  }
}

async function confirmPaidBooking(bookingId) {
  const snapshot = await withDb(async (db) => {
    const booking = db.bookings.find((entry) => entry.id === bookingId);
    if (!booking) {
      return null;
    }

    if (booking.status === "confirmed" && booking.caldavEventUid) {
      return { booking: { ...booking }, alreadyConfirmed: true };
    }

    booking.status = "paid_calendar_pending";
    booking.updatedAt = new Date().toISOString();
    audit(db, "booking.payment_paid", { bookingId });
    return { booking: { ...booking }, alreadyConfirmed: false };
  });

  if (!snapshot?.booking || snapshot.alreadyConfirmed) {
    return;
  }

  const booking = snapshot.booking;
  await updateCrmBookingRecord(booking, { status: "paid" }).catch((error) => {
    console.error(`CRM paid status sync failed: ${publicErrorMessage(error)}`);
  });

  const available = await isSlotStillFreeForConfirmation(booking);
  if (!available.ok) {
    await withDb(async (db) => {
      const found = db.bookings.find((entry) => entry.id === booking.id);
      if (!found) {
        return;
      }
      found.status = "manual_review";
      found.updatedAt = new Date().toISOString();
      audit(db, "booking.calendar_conflict_after_payment", { bookingId: booking.id, reason: available.reason });
    });
    await updateCrmBookingRecord(booking, { status: "manual_review" }).catch((error) => {
      console.error(`CRM manual review status sync failed: ${publicErrorMessage(error)}`);
    });
    return;
  }

  try {
    const event = await createCalDavEvent(booking);
    await withDb(async (db) => {
      const found = db.bookings.find((entry) => entry.id === booking.id);
      if (!found) {
        return;
      }
      found.status = "confirmed";
      found.caldavEventUid = event.uid;
      found.calendarUrl = event.url;
      found.updatedAt = new Date().toISOString();
      audit(db, "caldav.event_created", { bookingId: booking.id, caldavEventUid: event.uid });
    });
    await updateCrmBookingRecord(booking, {
      status: "confirmed",
      caldavEventUid: event.uid,
      calendarUrl: event.url
    }).catch((error) => {
      console.error(`CRM calendar event sync failed: ${publicErrorMessage(error)}`);
    });
  } catch (error) {
    await withDb(async (db) => {
      const found = db.bookings.find((entry) => entry.id === booking.id);
      if (!found) {
        return;
      }
      found.status = "calendar_failed";
      found.updatedAt = new Date().toISOString();
      audit(db, "caldav.event_failed", { bookingId: booking.id, error: publicErrorMessage(error) });
    });
    await updateCrmBookingRecord(booking, { status: "calendar_failed" }).catch((crmError) => {
      console.error(`CRM calendar failure sync failed: ${publicErrorMessage(crmError)}`);
    });
  }
}

async function isSlotStillFreeForConfirmation(booking) {
  const start = new Date(booking.startUtc);
  const end = new Date(booking.endUtc);
  return isBookingWindowAvailable(start, end, booking.id);
}

async function isBookingWindowAvailable(start, end, excludeBookingId = null) {
  const protectedStart = new Date(start.getTime() - bookingBufferMinutes * 60 * 1000);
  const protectedEnd = new Date(end.getTime() + bookingBufferMinutes * 60 * 1000);
  const calendarResult = await getCalDavBusyIntervals(protectedStart, protectedEnd);
  if (calendarResult.status === "error") {
    return { ok: false, reason: calendarResult.message };
  }

  const db = await readDb();
  expireOldPendingBookings(db);
  const localBusy = getReservedIntervals(db, excludeBookingId);
  const hasConflict = [...calendarResult.busy, ...localBusy].some((interval) =>
    intervalsOverlap(protectedStart, protectedEnd, interval.start, interval.end)
  );

  if (hasConflict) {
    return { ok: false, reason: "Het gekozen tijdsblok overlapt met een bestaande agenda-afspraak." };
  }

  return { ok: true };
}

function getReservedIntervals(db, excludeBookingId = null) {
  const now = Date.now();
  return db.bookings
    .filter((booking) => booking.id !== excludeBookingId)
    .filter((booking) => {
      if (booking.status === "confirmed" || booking.status === "paid_calendar_pending") {
        return true;
      }
      return booking.status === "pending_payment" && Date.parse(booking.expiresAt) > now;
    })
    .map((booking) => ({
      start: new Date(Date.parse(booking.startUtc) - bookingBufferMinutes * 60 * 1000),
      end: new Date(Date.parse(booking.endUtc) + bookingBufferMinutes * 60 * 1000)
    }));
}

function getCalendarUrl() {
  const base = stripTrailingSlash(process.env.CALDAV_BASE_URL || "");
  const path = String(process.env.CALDAV_CALENDAR_PATH || "").replace(/^\/?/, "/").replace(/\/?$/, "/");
  return new URL(path, `${base}/`).toString();
}

async function caldavRequest(method, url, { body = null, headers = {} } = {}) {
  const auth = Buffer.from(`${process.env.CALDAV_USERNAME}:${process.env.CALDAV_PASSWORD}`).toString("base64");
  return fetch(url, {
    method,
    headers: {
      authorization: `Basic ${auth}`,
      ...headers
    },
    body
  });
}

async function getCalDavBusyIntervals(startUtc, endUtc) {
  if (!isCalendarConfigured()) {
    return {
      status: "not_configured",
      message: "Agenda is nog niet gekoppeld; alleen bestaande pending reserveringen worden gecontroleerd.",
      busy: []
    };
  }

  const reportBody = `<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${formatIcsDate(startUtc)}" end="${formatIcsDate(endUtc)}" />
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

  try {
    const response = await caldavRequest("REPORT", getCalendarUrl(), {
      body: reportBody,
      headers: {
        depth: "1",
        "content-type": "application/xml; charset=utf-8"
      }
    });
    const text = await response.text();

    if (![200, 207].includes(response.status)) {
      return {
        status: "error",
        message: `Agenda availability request mislukt met status ${response.status}.`,
        busy: []
      };
    }

    return {
      status: "connected",
      message: "Agenda beschikbaarheid is live gecontroleerd.",
      busy: parseCalendarDataFromMultiStatus(text)
        .flatMap(parseIcsEvents)
        .filter((event) => event.status !== "CANCELLED" && event.transp !== "TRANSPARENT")
        .map((event) => ({ start: event.start, end: event.end }))
        .filter((interval) => Number.isFinite(interval.start.getTime()) && Number.isFinite(interval.end.getTime()))
    };
  } catch (error) {
    return {
      status: "error",
      message: `Agenda kon niet worden gecontroleerd: ${publicErrorMessage(error)}`,
      busy: []
    };
  }
}

async function createCalDavEvent(booking) {
  if (!isCalendarConfigured()) {
    throw new Error("Agenda is nog niet geconfigureerd.");
  }

  const uid = booking.caldavEventUid || `marcsmusic-${booking.id}@marcsmusic.nl`;
  const url = new URL(`${encodeURIComponent(uid)}.ics`, getCalendarUrl()).toString();
  const response = await caldavRequest("PUT", url, {
    body: buildIcsEvent(booking, uid),
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "if-none-match": "*"
    }
  });

  if (![200, 201, 204].includes(response.status)) {
    const text = await response.text().catch(() => "");
    throw new Error(`Agenda-event kon niet worden aangemaakt (${response.status}). ${text}`.trim());
  }

  return { uid, url };
}

async function deleteCalDavEvent(eventUid) {
  if (!isCalendarConfigured() || !eventUid) {
    return;
  }

  const url = new URL(`${encodeURIComponent(eventUid)}.ics`, getCalendarUrl()).toString();
  const response = await caldavRequest("DELETE", url);
  if (![200, 202, 204, 404].includes(response.status)) {
    throw new Error(`Agenda-event kon niet worden verwijderd (${response.status}).`);
  }
}

async function findEventByBookingId(bookingId) {
  const now = new Date();
  const rangeEnd = new Date(now.getTime() + 3 * 365 * 24 * 60 * 60 * 1000);
  const result = await getCalDavBusyIntervals(now, rangeEnd);
  if (result.status === "error") {
    return null;
  }
  return result.busy.find((event) => event.bookingId === bookingId) || null;
}

function buildIcsEvent(booking, uid) {
  const created = formatIcsDate(new Date(booking.createdAt || Date.now()));
  const updated = formatIcsDate(new Date());
  const description = [
    `Booking ID: ${booking.id}`,
    `Type: ${booking.bookingTypeLabel}`,
    `Aaneengesloten blokken: ${booking.slotCount || 1}`,
    `Duur: ${booking.durationMinutes} minuten`,
    `Naam: ${booking.customer.name}`,
    `Email: ${booking.customer.email}`,
    `Telefoon: ${booking.customer.phone}`,
    `Locatie: ${booking.customer.location}`,
    `Boeking ex btw: ${formatMoney(booking.performancePriceCents ?? booking.priceCents)}`,
    `Reiskosten ex btw: ${formatMoney(booking.travelCostCents || 0)} (${booking.billableTravelHours || 0} uur x ${formatMoney(booking.travelRateCentsPerHour || travelRateCentsPerHour)})`,
    `Totaal ex btw: ${formatMoney(booking.priceCents)}`,
    booking.customer.message ? `Bericht: ${booking.customer.message}` : ""
  ]
    .filter(Boolean)
    .join("\\n");
  const organizer = process.env.BOOKING_ADMIN_EMAIL ? [`ORGANIZER:MAILTO:${process.env.BOOKING_ADMIN_EMAIL}`] : [];

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MarcsMusic//Booking//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${updated}`,
    `CREATED:${created}`,
    `LAST-MODIFIED:${updated}`,
    `DTSTART:${formatIcsDate(new Date(booking.startUtc))}`,
    `DTEND:${formatIcsDate(new Date(booking.endUtc))}`,
    `SUMMARY:${escapeIcs(`MarcsMusic Booking - ${booking.customer.name}`)}`,
    `LOCATION:${escapeIcs(booking.customer.location)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `CONTACT:${escapeIcs(`${booking.customer.name} <${booking.customer.email}>`)}`,
    `X-MARCSMUSIC-BOOKING-ID:${booking.id}`,
    ...organizer,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
    ""
  ].join("\r\n");
}

function parseCalendarDataFromMultiStatus(xml) {
  const matches = [...xml.matchAll(/<[^>]*calendar-data[^>]*>([\s\S]*?)<\/[^>]*calendar-data>/gi)];
  return matches.map((match) => decodeXml(match[1]).trim()).filter(Boolean);
}

function parseIcsEvents(ics) {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const eventBlocks = [...unfolded.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)].map((match) => match[1]);
  return eventBlocks.map((block) => {
    const lines = block.split(/\r?\n/).filter(Boolean);
    const get = (name) => {
      const line = lines.find((entry) => entry.toUpperCase().startsWith(name));
      return line ? line.slice(line.indexOf(":") + 1).trim() : "";
    };

    return {
      uid: get("UID"),
      start: parseIcsDate(get("DTSTART")),
      end: parseIcsDate(get("DTEND")),
      status: get("STATUS").toUpperCase(),
      transp: get("TRANSP").toUpperCase(),
      bookingId: get("X-MARCSMUSIC-BOOKING-ID")
    };
  });
}

function parseIcsDate(value) {
  const clean = String(value || "").trim();
  const dateTime = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (dateTime) {
    return new Date(Date.UTC(
      Number(dateTime[1]),
      Number(dateTime[2]) - 1,
      Number(dateTime[3]),
      Number(dateTime[4]),
      Number(dateTime[5]),
      Number(dateTime[6])
    ));
  }
  const dateOnly = clean.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    return new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])));
  }
  return new Date(Number.NaN);
}

function formatIcsDate(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function decodeXml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function crmRequest(method, path, body = null) {
  if (!isCrmConfigured()) {
    throw Object.assign(new Error("EspoCRM is nog niet geconfigureerd."), { statusCode: 503 });
  }

  const base = stripTrailingSlash(process.env.ESPOCRM_BASE_URL);
  const apiPath = path.replace(/^\/+/, "");
  const response = await fetch(`${base}/api/v1/${apiPath}`, {
    method,
    headers: {
      "X-Api-Key": process.env.ESPOCRM_API_KEY,
      "content-type": "application/json"
    },
    body: body ? JSON.stringify(body) : null
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.message || payload.error?.message || `EspoCRM request mislukt (${response.status}).`);
  }

  return payload;
}

async function findCrmContactByEmail(email) {
  const query = new URLSearchParams({
    "where[0][type]": "equals",
    "where[0][attribute]": "emailAddress",
    "where[0][value]": email,
    maxSize: "1"
  });
  const result = await crmRequest("GET", `Contact?${query.toString()}`);
  return result.list?.[0] || null;
}

function splitName(fullName) {
  const parts = cleanText(fullName, 120).split(" ").filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: "", lastName: parts[0] || "Newsletter" };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1)
  };
}

function buildCrmContactPayload(input) {
  const { firstName, lastName } = splitName(input.name);
  const descriptionParts = [
    `Source: ${crmSource}`,
    input.newsletterOptIn ? "Newsletter opt-in: yes" : "",
    input.newsletterFromEmail ? `Newsletter from: ${input.newsletterFromName || "MarcsMusic"} <${input.newsletterFromEmail}>` : "",
    input.consentAt ? `Consent at: ${input.consentAt}` : "",
    input.consentSource ? `Consent source: ${input.consentSource}` : "",
    input.consentIpHash ? `Consent IP hash: ${input.consentIpHash}` : "",
    input.location ? `Location: ${input.location}` : "",
    input.message ? `Message: ${input.message}` : ""
  ].filter(Boolean);
  const payload = {
    firstName,
    lastName,
    emailAddress: input.email,
    phoneNumber: input.phone || "",
    description: descriptionParts.join("\n")
  };

  if (process.env.ESPOCRM_USE_CUSTOM_FIELDS === "true") {
    Object.assign(payload, {
      newsletterOptIn: Boolean(input.newsletterOptIn),
      consentAt: input.consentAt,
      consentSource: input.consentSource || "website",
      source: crmSource
    });
  }

  return payload;
}

async function createOrUpdateCrmContact(input) {
  const existing = await findCrmContactByEmail(input.email);
  const payload = buildCrmContactPayload(input);
  if (existing?.id) {
    const updated = await crmRequest("PUT", `Contact/${encodeURIComponent(existing.id)}`, payload);
    return { ...existing, ...updated, id: existing.id };
  }
  return crmRequest("POST", "Contact", payload);
}

async function addContactToNewsletterList(contactId) {
  if (!contactId || !crmNewsletterList) {
    return null;
  }

  // EspoCRM installations differ in target-list setup. The contact itself is the durable source of truth;
  // this best-effort path links the contact when a matching TargetList and relation endpoint exist.
  const query = new URLSearchParams({
    "where[0][type]": "equals",
    "where[0][attribute]": "name",
    "where[0][value]": crmNewsletterList,
    maxSize: "1"
  });
  const targetList = await crmRequest("GET", `TargetList?${query.toString()}`).then((result) => result.list?.[0] || null);
  if (!targetList?.id) {
    return null;
  }
  return crmRequest("POST", `TargetList/${encodeURIComponent(targetList.id)}/contacts`, { id: contactId });
}

function buildCrmBookingPayload(booking, contactId = booking.crmContactId, patch = {}) {
  const bookingMessage = [
    booking.customer.message,
    `Aaneengesloten blokken: ${booking.slotCount || 1}`,
    `Duur: ${booking.durationMinutes} minuten`,
    `Boeking ex btw: ${formatMoney(booking.performancePriceCents ?? booking.priceCents)}`,
    `Reiskosten ex btw: ${formatMoney(booking.travelCostCents || 0)} (${booking.billableTravelHours || 0} uur x ${formatMoney(booking.travelRateCentsPerHour || travelRateCentsPerHour)})`,
    `Totaal ex btw: ${formatMoney(booking.priceCents)}`
  ].filter(Boolean).join("\n");

  return {
    name: `MarcsMusic Booking - ${booking.customer.name}`,
    bookingId: booking.id,
    contactId: contactId || null,
    customerName: booking.customer.name,
    customerEmail: booking.customer.email,
    customerPhone: booking.customer.phone,
    eventType: booking.bookingTypeLabel,
    eventDate: formatLocalInputDate(new Date(booking.startUtc)),
    startUtc: booking.startUtc,
    endUtc: booking.endUtc,
    durationMinutes: booking.durationMinutes,
    location: booking.customer.location,
    message: bookingMessage,
    priceCents: booking.priceCents,
    currency: booking.currency,
    status: booking.status,
    molliePaymentId: booking.molliePaymentId,
    molliePaymentStatus: null,
    caldavEventUid: booking.caldavEventUid,
    calendarUrl: booking.calendarUrl,
    source: crmSource,
    ...patch
  };
}

async function createCrmBookingRecord(booking, contactId) {
  return crmRequest("POST", crmBookingEntity, buildCrmBookingPayload(booking, contactId));
}

async function updateCrmBookingRecord(booking, patch) {
  if (!isCrmConfigured() || !booking.crmBookingId) {
    return null;
  }
  return crmRequest("PUT", `${crmBookingEntity}/${encodeURIComponent(booking.crmBookingId)}`, buildCrmBookingPayload(booking, booking.crmContactId, patch));
}

function queueCrmStatusUpdate(booking, status) {
  updateCrmBookingRecord(booking, { status }).catch((error) => {
    console.error(`CRM status update failed: ${publicErrorMessage(error)}`);
  });
}

async function cancelBooking(bookingId) {
  const snapshot = await withDb(async (db) => {
    const booking = db.bookings.find((entry) => entry.id === bookingId);
    if (!booking) {
      throw Object.assign(new Error("Booking niet gevonden."), { statusCode: 404 });
    }
    booking.status = "cancelled";
    booking.updatedAt = new Date().toISOString();
    audit(db, "booking.cancelled_by_admin", { bookingId });
    return { ...booking };
  });

  if (snapshot.caldavEventUid) {
    await deleteCalDavEvent(snapshot.caldavEventUid).catch((error) => console.error(`CalDAV delete failed: ${publicErrorMessage(error)}`));
  }
  await updateCrmBookingRecord(snapshot, { status: "cancelled" }).catch((error) => console.error(`CRM cancel sync failed: ${publicErrorMessage(error)}`));

  return { ok: true, bookingId };
}

function publicBookingStatus(booking) {
  return {
    bookingId: booking.id,
    status: booking.status,
    bookingType: booking.bookingTypeLabel,
    startUtc: booking.startUtc,
    endUtc: booking.endUtc,
    dateLabel: formatLocalDate(new Date(booking.startUtc)),
    timeLabel: formatLocalTime(new Date(booking.startUtc)),
    durationMinutes: booking.durationMinutes,
    slotCount: booking.slotCount || 1,
    price: formatMoney(booking.priceCents)
  };
}

function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseHourMinute(value) {
  const match = String(value).match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Ongeldige tijd: ${value}`);
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function localDateTimeToUtc(date, time, timeZone) {
  const [year, month, day] = date.split("-").map(Number);
  const { hour, minute } = parseHourMinute(time);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utcMs = utcGuess - getTimeZoneOffsetMs(timeZone, new Date(utcGuess));
  utcMs = utcGuess - getTimeZoneOffsetMs(timeZone, new Date(utcMs));
  return new Date(utcMs);
}

function getTimeZoneOffsetMs(timeZone, date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  const hour = parts.hour === "24" ? "00" : parts.hour;
  const localAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return localAsUtc - date.getTime();
}

function formatLocalInputDate(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: bookingTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatLocalDate(date) {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: bookingTimeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatLocalTime(date) {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: bookingTimeZone,
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function centsToMollieValue(cents) {
  return (cents / 100).toFixed(2);
}

function formatMoney(cents) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR"
  }).format(cents / 100);
}

function publicErrorMessage(error) {
  return error instanceof Error ? error.message : "Onbekende fout";
}

function serveStatic(request, response) {
  const filePath = getFilePath(request.url || "/");

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    sendText(response, 404, "Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": contentTypes[extname(filePath)] || "application/octet-stream",
    "cache-control": "public, max-age=300"
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", request.headers.host ? `http://${request.headers.host}` : config.appBaseUrl);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    if (!["GET", "HEAD"].includes(request.method || "")) {
      sendText(response, 405, "Method not allowed");
      return;
    }

    serveStatic(request, response);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) {
      console.error(error);
    }
    sendJson(response, statusCode, { error: publicErrorMessage(error) });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`MarcsMusic site listening on port ${port}`);
});
