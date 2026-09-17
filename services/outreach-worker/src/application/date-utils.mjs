import { DateTime } from "luxon";

export const BUSINESS_TIMEZONE = "Europe/Amsterdam";

export function businessDate(value = new Date()) {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) throw new TypeError("A valid instant is required for the outreach business date");
  return DateTime.fromJSDate(instant, { zone: "utc" }).setZone(BUSINESS_TIMEZONE).toISODate();
}

export function businessDayUtcRange(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    throw new TypeError("A YYYY-MM-DD outreach business date is required");
  }
  const start = DateTime.fromISO(date, { zone: BUSINESS_TIMEZONE }).startOf("day");
  if (!start.isValid || start.toISODate() !== date) throw new TypeError("A valid outreach business date is required");
  return Object.freeze({
    businessDate: date,
    start: start.toUTC().toJSDate(),
    end: start.plus({ days: 1 }).toUTC().toJSDate()
  });
}

/**
 * Parse timestamps returned by EspoCRM and PostgreSQL without relying on the
 * host process timezone. EspoCRM commonly returns UTC timestamps without an
 * offset (for example `2026-07-16 08:30:00`), which must not be interpreted as
 * local time on a developer laptop or a Railway worker.
 */
export function parseInstant(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : new Date(value.getTime());
  }
  if (typeof value === "number") {
    const instant = new Date(value);
    return Number.isNaN(instant.getTime()) ? undefined : instant;
  }
  if (typeof value !== "string" || !value.trim()) return undefined;
  const text = value.trim();
  const utcDateTime = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?)$/u.exec(text);
  if (utcDateTime) {
    const instant = new Date(`${utcDateTime[1]}T${utcDateTime[2]}Z`);
    return Number.isNaN(instant.getTime()) ? undefined : instant;
  }
  const instant = new Date(text);
  return Number.isNaN(instant.getTime()) ? undefined : instant;
}

/**
 * Return the authoritative timestamp at which a contact address was found.
 * Source evidence is stronger than the CRM row creation time. Queue creation
 * time is deliberately not considered: re-queueing an old address must never
 * make it eligible for a new campaign.
 */
export function contactDiscoveryInstant(contact) {
  const candidates = [
    contact?.evidenceAttestation?.evidenceCapturedAt,
    contact?.evidenceAttestation?.capturedAt,
    contact?.proofCapturedAt,
    contact?.createdAt
  ];
  for (const candidate of candidates) {
    const instant = parseInstant(candidate);
    if (instant) return instant;
  }
  return undefined;
}

/**
 * Check the immutable activation fence used by outreach sending. A missing or
 * malformed discovery timestamp is rejected instead of being treated as a
 * newly discovered address.
 */
export function isContactNewSince(contact, fromBusinessDate) {
  if (!fromBusinessDate) return true;
  const discovery = contactDiscoveryInstant(contact);
  if (!discovery) return false;
  const { start } = businessDayUtcRange(fromBusinessDate);
  return discovery.getTime() >= start.getTime();
}

export function addYears(date, years) {
  const copy = new Date(date);
  copy.setUTCFullYear(copy.getUTCFullYear() + years);
  return copy;
}

export function subtractMinutes(date, minutes) {
  return new Date(new Date(date).getTime() - minutes * 60_000);
}

export function subtractDays(date, days) {
  return new Date(new Date(date).getTime() - days * 86_400_000);
}
