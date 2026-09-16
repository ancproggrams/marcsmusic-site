import { createReadStream, existsSync, statSync, realpathSync } from "node:fs";
import { createServer } from "node:http";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { AsyncLocalStorage } from "node:async_hooks";
import { fetchTransparanteBrokerAssignments, mergeAssignments } from "./lib/transparante-broker.js";
import { openStore } from "./lib/store.js";
import { createHttpClient } from "./lib/http-client.js";
import { parseCalendarResponse, eventMatchesBooking } from "./lib/calendar.js";
import { createBookingService, reservesSlot } from "./lib/booking-service.js";
import { createRateLimiter, clientIp } from "./lib/rate-limit.js";

const root = dirname(fileURLToPath(import.meta.url));
const port = numberFromEnv("PORT", 3000);
const legacyBookingDbPath = process.env.BOOKING_DB_PATH || (process.env.RAILWAY_ENVIRONMENT ? "/data/bookings.json" : join(root, "data", "bookings.json"));
const bookingSqlitePath = process.env.BOOKING_SQLITE_PATH || legacyBookingDbPath.replace(/\.json$/i, ".sqlite");
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
const mollieApiBaseUrl = stripTrailingSlash(process.env.MOLLIE_API_BASE_URL || "https://api.mollie.com");
const crmSource = process.env.CRM_SOURCE_WEBSITE || "marcsmusic.nl";
const crmBookingEntity = process.env.CRM_BOOKING_ENTITY || "DJBooking";
const crmNewsletterList = process.env.CRM_NEWSLETTER_LIST || "MarcsMusic Newsletter";
const newsletterFromEmail = process.env.NEWSLETTER_FROM_EMAIL || "noreply@marcsmusic.nl";
const newsletterFromName = process.env.NEWSLETTER_FROM_NAME || "MarcsMusic";
const transparanteBrokerBaseUrl = process.env.TRANSPARANTE_BROKER_BASE_URL || "https://www.detransparantebroker.nl";
const transparanteBrokerSyncEnabled =
  process.env.TRANSPARANTE_BROKER_SYNC_ENABLED === "true" ||
  (!process.env.TRANSPARANTE_BROKER_SYNC_ENABLED && Boolean(process.env.RAILWAY_ENVIRONMENT));
const transparanteBrokerSyncIntervalMinutes = Math.max(
  15,
  numberFromEnv("TRANSPARANTE_BROKER_SYNC_INTERVAL_MINUTES", 60)
);
const auditRetentionDays = numberFromEnv("AUDIT_RETENTION_DAYS", 365);
const completedJobRetentionDays = numberFromEnv("COMPLETED_JOB_RETENTION_DAYS", 30);
const inactiveAssignmentRetentionDays = numberFromEnv("INACTIVE_ASSIGNMENT_RETENTION_DAYS", 180);

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
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
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



function numberFromEnv(name, fallback) {
  if (!process.env[name]) return fallback;
  const value = Number(process.env[name]);
  if (!Number.isSafeInteger(value)) throw new Error(`${name} must be an integer`);
  return value;
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/$/, "");
}

function getBookingIntegrationStatus() {
  const integrations = {
    calendarConfigured: isCalendarConfigured(),
    crmConfigured: isCrmConfigured(),
    mollieConfigured: Boolean(process.env.MOLLIE_API_KEY)
  };

  return {
    ...integrations,
    ready: integrations.calendarConfigured && integrations.crmConfigured && integrations.mollieConfigured
  };
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
    integrations: getBookingIntegrationStatus()
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


function hashIp(request) {
  return createHash("sha256").update(`${clientIp(request, trustedProxies)}:${privacyHashSalt}`).digest("hex");
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

  const localBusy = await localBusyIntervals(dayStart, dayEnd);
  if (calendarResult.status === "error") throw Object.assign(new Error("Agenda tijdelijk niet beschikbaar."), { statusCode: 503 });
  const calendarBusy = calendarResult.busy;
  const busy = [...localBusy, ...calendarBusy];
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
      message:
        calendarResult.status === "error"
          ? "Agenda kon niet live worden gecontroleerd; beschikbare tijden worden getoond op basis van website-reserveringen."
          : calendarResult.message
    }
  };
}


function requireBookingIntegrations() {
  const integrations = getBookingIntegrationStatus();
  if (!integrations.ready) {
    throw Object.assign(new Error("Live boekingen zijn tijdelijk niet beschikbaar. Neem direct contact op."), {
      statusCode: 503,
      logAsError: false
    });
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

  const response = await http(`${mollieApiBaseUrl}/v2/payments`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.MOLLIE_API_KEY}`,
      "content-type": "application/json",
      "Idempotency-Key": booking.id
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
        crmBookingId: ""
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

  const response = await http(`${mollieApiBaseUrl}/v2/payments/${encodeURIComponent(paymentId)}`, {
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






function getCalendarUrl() {
  const base = stripTrailingSlash(process.env.CALDAV_BASE_URL || "");
  const path = String(process.env.CALDAV_CALENDAR_PATH || "").replace(/^\/?/, "/").replace(/\/?$/, "/");
  return new URL(path, `${base}/`).toString();
}

async function caldavRequest(method, url, { body = null, headers = {} } = {}) {
  const auth = Buffer.from(`${process.env.CALDAV_USERNAME}:${process.env.CALDAV_PASSWORD}`).toString("base64");
  return http(url, {
    method,
    headers: {
      authorization: `Basic ${auth}`,
      ...headers
    },
    body
  });
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

  if (response.status === 412) {
    const existing = await findOwnEvent(booking);
    if (existing) return existing;
  }
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
    .join("\n");
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


async function crmRequest(method, path, body = null) {
  if (!isCrmConfigured()) {
    throw Object.assign(new Error("EspoCRM is nog niet geconfigureerd."), { statusCode: 503 });
  }

  const base = stripTrailingSlash(process.env.ESPOCRM_BASE_URL);
  const apiPath = path.replace(/^\/+/, "");
  const response = await http(`${base}/api/v1/${apiPath}`, {
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
  if (!Object.hasOwn(input, "newsletterOptIn")) {
    delete payload.newsletterOptIn; delete payload.consentAt; delete payload.consentSource;
  }
  if (existing?.id) {
    for (const field of ["firstName", "lastName", "phoneNumber"]) if (!payload[field]) delete payload[field];
    // Notes and historical consent are not replaced by a booking or signup.
    delete payload.description;
  }
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
    throw new Error("Nieuwsbriefdoellijst ontbreekt.");
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
  return crmRequest("PUT", `${crmBookingEntity}/${encodeURIComponent(booking.crmBookingId)}`, buildCrmBookingPayload(booking, booking.crmContactId, { molliePaymentStatus: booking.molliePaymentStatus || null, ...patch }));
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
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
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



async function prepareBooking(input) {
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

  const calendar = await getCalDavBusyIntervals(new Date(startUtc.getTime()-bookingBufferMinutes*60000), new Date(endUtc.getTime()+bookingBufferMinutes*60000));
  if (calendar.status === "error" || calendar.busy.length) throw Object.assign(new Error("Dit tijdsblok is niet beschikbaar."), { statusCode: 409 });

  const bookingId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + pendingHoldMinutes * 60 * 1000);

  return {
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

}

const trustedProxies = String(process.env.TRUSTED_PROXY_IPS || "").split(",").map((value) => value.trim()).filter(Boolean);
const http = createHttpClient({ timeoutMs: numberFromEnv("INTEGRATION_TIMEOUT_MS", 10_000), maxConcurrent: numberFromEnv("INTEGRATION_MAX_CONCURRENT", 16) });
const rateLimiter = createRateLimiter({ maxKeys: numberFromEnv("RATE_LIMIT_MAX_KEYS", 10_000) });
const requestContext = new AsyncLocalStorage();
let acceptingRequests = true;

validateConfiguration();
const store = await openStore({
  url: process.env.DATABASE_URL || "",
  path: bookingSqlitePath,
  legacyPath: existsSync(legacyBookingDbPath) ? legacyBookingDbPath : undefined
});

async function localBusyIntervals(start, end) {
  const bookings = await store.list("bookings", { before: end.toISOString(), after: start.toISOString(), limit: 10_001 });
  if (bookings.length > 10_000) throw Object.assign(new Error("Te veel reserveringen in dit tijdvenster."), { statusCode: 503 });
  return bookings.filter((booking) => reservesSlot(booking)).map((booking) => ({
    start: new Date(booking.startUtc), end: new Date(booking.endUtc), bookingId: booking.id
  }));
}

async function getCalDavBusyIntervals(startUtc, endUtc) {
  if (!isCalendarConfigured()) return { status: "not_configured", message: "Agenda is nog niet gekoppeld.", busy: [] };
  const body = `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
<d:prop><c:calendar-data><c:expand start="${formatIcsDate(startUtc)}" end="${formatIcsDate(endUtc)}"/></c:calendar-data></d:prop>
<c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${formatIcsDate(startUtc)}" end="${formatIcsDate(endUtc)}"/></c:comp-filter></c:comp-filter></c:filter>
</c:calendar-query>`;
  try {
    const response = await caldavRequest("REPORT", getCalendarUrl(), { body, headers: { depth: "1", "content-type": "application/xml; charset=utf-8" } });
    const text = await response.text();
    if (![200, 207].includes(response.status)) throw new Error(`CalDAV gaf HTTP ${response.status}`);
    const busy = parseCalendarResponse(text, startUtc, endUtc, bookingTimeZone);
    return { status: "connected", message: "Agenda beschikbaarheid is live gecontroleerd.", busy };
  } catch (error) {
    log("error", "calendar.query_failed", { error: publicErrorMessage(error) });
    return { status: "error", message: "Agenda kon niet betrouwbaar worden gecontroleerd.", busy: [] };
  }
}

function calendarEventUid(booking) {
  return booking.caldavEventUid || `marcsmusic-${booking.id}@marcsmusic.nl`;
}

async function findOwnEvent(booking) {
  const uid = calendarEventUid(booking);
  const url = new URL(`${encodeURIComponent(uid)}.ics`, getCalendarUrl()).toString();
  const response = await caldavRequest("GET", url);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Agenda-event kon niet worden gecontroleerd (${response.status}).`);
  if (!eventMatchesBooking(await response.text(), booking, uid, bookingTimeZone)) throw new Error("Bestaand agenda-event komt niet overeen met de booking.");
  return { uid, url };
}

async function calendarWindowAvailable(booking) {
  const start = new Date(Date.parse(booking.startUtc) - bookingBufferMinutes * 60_000);
  const end = new Date(Date.parse(booking.endUtc) + bookingBufferMinutes * 60_000);
  const result = await getCalDavBusyIntervals(start, end);
  if (result.status !== "connected") throw new Error("Agenda tijdelijk niet beschikbaar.");
  return !result.busy.some((event) => event.bookingId !== booking.id && event.uid !== calendarEventUid(booking));
}

async function ensureCrmBooking(booking, contactId) {
  if (booking.crmBookingId) return { id: booking.crmBookingId };
  const query = new URLSearchParams({ "where[0][type]": "equals", "where[0][attribute]": "bookingId", "where[0][value]": booking.id, maxSize: "1" });
  const existing = await crmRequest("GET", `${crmBookingEntity}?${query}`);
  return existing.list?.[0] || createCrmBookingRecord(booking, contactId);
}

const bookingService = createBookingService({
  store, prepareBooking, bufferMinutes: bookingBufferMinutes,
  logger: (details) => log("error", details.event, details),
  integrations: {
    createPayment: createMolliePayment, getPayment: getMolliePayment,
    createEvent: createCalDavEvent, findOwnEvent, windowAvailable: calendarWindowAvailable,
    deleteEvent: deleteCalDavEvent, eventUid: calendarEventUid,
    upsertContact: createOrUpdateCrmContact, ensureCrmBooking,
    updateCrmBooking: (booking) => updateCrmBookingRecord(booking, {}), addToNewsletter: addContactToNewsletterList
  }
});

async function subscribeNewsletter(input, request) {
  const email = cleanText(input.email, 160).toLowerCase();
  const name = cleanText(input.name, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error("Vul een geldig e-mailadres in."), { statusCode: 400 });
  const consentAt = new Date().toISOString();
  const subscription = await bookingService.subscribe({ email, name, phone: "", newsletterOptIn: true, consentAt,
    consentSource: "website", consentIpHash: hashIp(request), newsletterFromEmail, newsletterFromName });
  return { ok: true, status: subscription.crmStatus, message: subscription.crmStatus === "synced"
    ? "Je staat op de MarcsMusic mailing list." : "Je inschrijving is ontvangen en wordt automatisch gesynchroniseerd." };
}

function requireAdmin(request, response) {
  const configured = Buffer.from(process.env.ADMIN_TOKEN || "");
  const provided = Buffer.from(String(request.headers.authorization || "").replace(/^Bearer\s+/i, ""));
  if (!configured.length) { sendJson(response, 503, { error: "Admin is niet geconfigureerd." }); return false; }
  if (provided.length !== configured.length || !timingSafeEqual(provided, configured)) {
    sendJson(response, 401, { error: "Ongeldige admin token." }); return false;
  }
  return true;
}

async function syncAssignments() {
  const startedAt = new Date().toISOString();
  const incoming = await fetchTransparanteBrokerAssignments({ baseUrl: transparanteBrokerBaseUrl, fetchImpl: http });
  return store.transaction(async (tx) => {
    const existing = [];
    for (let offset = 0; ; offset += 500) {
      const page = await tx.list("assignments", { source: "de-transparante-broker", limit: 500, offset });
      existing.push(...page);
      if (page.length < 500) break;
    }
    const merged = mergeAssignments(existing, incoming, startedAt);
    for (const assignment of merged) await tx.put("assignments", assignment);
    const state = { id: "de-transparante-broker", status: "ok", startedAt, completedAt: new Date().toISOString(),
      receivedCount: incoming.length, activeCount: merged.filter((item) => item.active).length };
    await tx.put("sync_state", state);
    await tx.audit("assignments.sync_completed", { receivedCount: incoming.length });
    return { ok: true, receivedCount: incoming.length, activeCount: state.activeCount };
  });
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health/live") { sendJson(response, 200, { status: "ok", uptimeSeconds: Math.round(process.uptime()) }); return; }
  if (request.method === "GET" && url.pathname === "/api/health") {
    const storage = await store.readiness();
    const deadJobs = await store.count("jobs", "dead");
    const integrations = getBookingIntegrationStatus();
    const syncState = transparanteBrokerSyncEnabled ? await store.get("sync_state", "de-transparante-broker") : null;
    const syncFresh = !transparanteBrokerSyncEnabled || (syncState?.status === "ok" && Date.parse(syncState.completedAt) > Date.now() - 2 * transparanteBrokerSyncIntervalMinutes * 60_000);
    const ready = storage && deadJobs === 0 && integrations.ready && syncFresh;
    sendJson(response, ready ? 200 : 503, { status: ready ? "ok" : "degraded", integrations, deadJobs, assignmentSyncFresh: syncFresh }); return;
  }
  const ip = clientIp(request, trustedProxies);
  const isAdmin = url.pathname.startsWith("/api/admin");
  const rateClass = isAdmin ? "admin" : url.pathname === "/api/webhooks/mollie" ? "webhook" : "public";
  const rateLimit = isAdmin ? 10 : rateClass === "webhook" ? 300 : 30;
  if (!rateLimiter.allow(`${ip}:${rateClass}`, rateLimit)) {
    sendJson(response, 429, { error: "Te veel aanvragen. Probeer het later opnieuw." }, { "retry-after": "60" }); return;
  }
  if (request.method === "GET" && url.pathname === "/api/booking/config") { sendJson(response, 200, getPublicConfig()); return; }
  if (request.method === "GET" && url.pathname === "/api/booking/availability") {
    sendJson(response, 200, await getAvailability({ date: url.searchParams.get("date") || "", bookingType: url.searchParams.get("bookingType") || "" })); return;
  }
  if (request.method === "POST" && url.pathname === "/api/booking/create") {
    sendJson(response, 201, await bookingService.create(await readJsonBody(request), request.headers["idempotency-key"])); return;
  }
  if (request.method === "GET" && url.pathname === "/api/booking/status") {
    const booking = await store.get("bookings", url.searchParams.get("id") || "");
    if (!booking) { sendJson(response, 404, { error: "Booking niet gevonden." }); return; }
    sendJson(response, 200, publicBookingStatus(booking)); return;
  }
  if (request.method === "POST" && url.pathname === "/api/newsletter/subscribe") { sendJson(response, 200, await subscribeNewsletter(await readJsonBody(request), request)); return; }
  if (request.method === "POST" && url.pathname === "/api/webhooks/mollie") {
    const payload = request.headers["content-type"]?.includes("application/json") ? await readJsonBody(request) : await readFormBody(request);
    await bookingService.webhook(cleanText(payload.id, 80)); sendText(response, 200, "ok"); return;
  }
  if (isAdmin && !requireAdmin(request, response)) return;
  if (request.method === "GET" && url.pathname === "/api/admin/bookings") {
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    sendJson(response, 200, { bookings: await store.list("bookings", { limit, offset }), limit, offset }); return;
  }
  if (request.method === "GET" && url.pathname === "/api/admin/assignments") {
    const assignments = await store.list("assignments", { source: url.searchParams.get("source") || undefined, limit: 100, offset: Number(url.searchParams.get("offset")) || 0 });
    sendJson(response, 200, { assignments, syncState: await store.get("sync_state", "de-transparante-broker") }); return;
  }
  if (request.method === "GET" && url.pathname === "/api/admin/jobs") {
    const status = url.searchParams.get("status") || undefined;
    sendJson(response, 200, { jobs: await store.list("jobs", { status, limit: 100, offset: Number(url.searchParams.get("offset")) || 0 }) }); return;
  }
  if (request.method === "POST" && url.pathname === "/api/admin/assignments/sync") { sendJson(response, 200, await syncAssignments()); return; }
  const cancel = url.pathname.match(/^\/api\/admin\/bookings\/([^/]+)\/cancel$/);
  if (request.method === "POST" && cancel) { sendJson(response, 200, await bookingService.cancel(decodeURIComponent(cancel[1]))); return; }
  sendJson(response, 404, { error: "API endpoint niet gevonden." });
}

const publicFiles = new Map([
  ["/", "index.html"], ["/index.html", "index.html"], ["/booking", "booking.html"], ["/booking/", "booking.html"],
  ["/booking/success", "booking.html"], ["/booking/cancelled", "booking.html"], ["/admin", "admin.html"], ["/admin.html", "admin.html"],
  ["/assets/artist-portrait.jpg", "assets/artist-portrait.jpg"], ["/assets/marcsmusic-logo-black.png", "assets/marcsmusic-logo-black.png"],
  ["/assets/marcsmusic-logo-white.png", "assets/marcsmusic-logo-white.png"]
]);

function serveStatic(request, response, pathname) {
  const relative = publicFiles.get(pathname);
  if (!relative) { sendText(response, 404, "Not found"); return; }
  const realRoot = realpathSync(root);
  const realPath = realpathSync(resolve(root, relative));
  if (!realPath.startsWith(realRoot + sep) || !statSync(realPath).isFile()) { sendText(response, 404, "Not found"); return; }
  response.writeHead(200, { "content-type": contentTypes[extname(realPath)] || "application/octet-stream",
    "cache-control": extname(realPath) === ".html" ? "no-cache" : "public, max-age=86400", "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'self'; img-src 'self' data: https:; media-src 'self' https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'",
    "referrer-policy": "strict-origin-when-cross-origin" });
  if (request.method === "HEAD") response.end(); else createReadStream(realPath).pipe(response);
}

function log(level, event, details = {}) {
  const context = requestContext.getStore() || {};
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), requestId: context.requestId, ...details });
  (level === "error" ? console.error : console.log)(line);
}

const server = createServer((request, response) => requestContext.run({ requestId: randomUUID() }, async () => {
  const started = Date.now();
  response.setHeader("x-request-id", requestContext.getStore().requestId);
  try {
    if (!acceptingRequests) { sendJson(response, 503, { error: "Server wordt opnieuw gestart." }); return; }
    const url = new URL(request.url || "/", appBaseUrl);
    if (url.pathname.startsWith("/api/")) await handleApi(request, response, url);
    else if (["GET", "HEAD"].includes(request.method || "")) serveStatic(request, response, url.pathname);
    else sendText(response, 405, "Method not allowed");
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500 && error.logAsError !== false) log("error", "request.failed", { error: publicErrorMessage(error), method: request.method, path: request.url });
    const safeMessage = status >= 500 && process.env.RAILWAY_ENVIRONMENT ? "De aanvraag kon niet worden verwerkt." : publicErrorMessage(error);
    if (!response.headersSent) sendJson(response, status, { error: safeMessage });
    else response.destroy();
  } finally { log("info", "request.completed", { method: request.method, path: request.url, status: response.statusCode, durationMs: Date.now() - started }); }
}));

await bookingService.recover();
await bookingService.worker.tick();
await applyRetention();
const workerTimer = setInterval(() => void bookingService.worker.tick().catch((error) => log("error", "worker.tick_failed", { error: publicErrorMessage(error) })), 5_000);
workerTimer.unref();
const retentionTimer = setInterval(() => void applyRetention().catch((error) => log("error", "retention.failed", { error: publicErrorMessage(error) })), 24 * 60 * 60_000);
retentionTimer.unref();
let syncPromise = null;
const scheduleSync = () => {
  if (!syncPromise) syncPromise = syncAssignments().catch((error) => log("error", "assignments.sync_failed", { error: publicErrorMessage(error) })).finally(() => { syncPromise = null; });
  return syncPromise;
};
if (transparanteBrokerSyncEnabled) void scheduleSync();
const syncTimer = transparanteBrokerSyncEnabled ? setInterval(() => void scheduleSync(), transparanteBrokerSyncIntervalMinutes * 60_000) : null;
syncTimer?.unref();
server.listen(port, "0.0.0.0", () => log("info", "server.started", { port }));

async function shutdown(signal) {
  if (!acceptingRequests) return;
  acceptingRequests = false;
  clearInterval(workerTimer); if (syncTimer) clearInterval(syncTimer);
  clearInterval(retentionTimer);
  log("info", "server.stopping", { signal });
  server.closeIdleConnections?.();
  await Promise.race([new Promise((resolve) => server.close(resolve)), new Promise((resolve) => setTimeout(resolve, 15_000))]);
  await bookingService.worker.stop(); await store.close(); process.exit(0);
}
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

function validateConfiguration() {
  const positive = { PORT: port, BOOKING_PENDING_HOLD_MINUTES: pendingHoldMinutes, BOOKING_SLOT_STEP_MINUTES: slotStepMinutes, BOOKING_MAX_CONSECUTIVE_SLOTS: maxConsecutiveSlots };
  for (const [name, value] of Object.entries(positive)) if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  for (const [name, value] of [["BOOKING_BUFFER_MINUTES", bookingBufferMinutes], ["BOOKING_MIN_LEAD_HOURS", minLeadHours], ["BOOKING_MAX_TRAVEL_HOURS", maxTravelHours], ["BOOKING_TRAVEL_RATE_CENTS_PER_HOUR", travelRateCentsPerHour]]) if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  for (const [name, value] of [["AUDIT_RETENTION_DAYS", auditRetentionDays], ["COMPLETED_JOB_RETENTION_DAYS", completedJobRetentionDays], ["INACTIVE_ASSIGNMENT_RETENTION_DAYS", inactiveAssignmentRetentionDays]]) if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  for (const type of bookingTypes) if (!Number.isSafeInteger(type.durationMinutes) || type.durationMinutes <= 0 || !Number.isSafeInteger(type.priceCents) || type.priceCents < 0) throw new Error(`Invalid booking type ${type.id}`);
  if (port > 65_535) throw new Error("PORT must not exceed 65535");
  if (pendingHoldMinutes > 1_440 || slotStepMinutes > 1_440 || bookingBufferMinutes > 1_440) throw new Error("Booking minute settings must not exceed one day");
  if (maxConsecutiveSlots > 24 || minLeadHours > 8_760 || maxTravelHours > 168) throw new Error("Booking range setting exceeds its supported maximum");
  for (const type of bookingTypes) if (type.durationMinutes > 1_440 || type.priceCents > 100_000_000) throw new Error(`Booking type ${type.id} exceeds its supported maximum`);
  new Intl.DateTimeFormat("en", { timeZone: bookingTimeZone }).format();
  const start = parseHourMinute(workdayStart), end = parseHourMinute(workdayEnd);
  if (start.hour > 23 || end.hour > 23 || start.minute > 59 || end.minute > 59 || start.hour * 60 + start.minute >= end.hour * 60 + end.minute) throw new Error("Booking workday is invalid");
  if (process.env.RAILWAY_ENVIRONMENT) {
    for (const name of ["ADMIN_TOKEN", "PRIVACY_HASH_SALT"]) { const value = process.env[name] || ""; if (value.length < 32 || /^change-/i.test(value)) throw new Error(`${name} must contain at least 32 non-default characters`); }
    if (!process.env.DATABASE_URL && !process.env.BOOKING_SQLITE_PATH) throw new Error("DATABASE_URL or BOOKING_SQLITE_PATH is required in production");
  }
}

async function applyRetention() {
  const cutoff = (days) => new Date(Date.now() - days * 86_400_000).toISOString();
  await store.transaction(async (tx) => {
    await tx.prune("audit_events", cutoff(auditRetentionDays));
    await tx.prune("jobs", cutoff(completedJobRetentionDays), { status: "done" });
    await tx.prune("assignments", cutoff(inactiveAssignmentRetentionDays), { active: false });
  });
}
