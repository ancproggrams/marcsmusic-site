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
