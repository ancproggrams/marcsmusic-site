import { createHash } from "node:crypto";
import { DateTime } from "luxon";
import { canonicalIanaTimezone } from "./recipient-locale.mjs";

const ALLOWED_WEEKDAYS = new Set([2, 3, 4]);
const WINDOW_START_MINUTES = 9 * 60 + 30;
const WINDOW_END_MINUTES = 11 * 60 + 30;
const FOLLOW_UP_DAY_OFFSETS = Object.freeze([0, 5, 11]);
const MINIMUM_FOLLOW_UP_INTERVAL_MS = 4 * 24 * 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;

export function scheduleSequenceStep({
  sequenceStep,
  timezone,
  idempotencyKey,
  from = new Date(),
  sequenceStart = from,
  previousAcceptedAt
}) {
  if (!Number.isInteger(sequenceStep) || sequenceStep < 0 || sequenceStep > 2) {
    throw new TypeError("sequenceStep must be 0, 1, or 2");
  }
  const zone = canonicalIanaTimezone(timezone);
  if (!zone) throw schedulingError("RECIPIENT_TIMEZONE_INVALID", "A valid recipient IANA timezone is required");
  if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
    throw schedulingError("SCHEDULING_IDEMPOTENCY_KEY_INVALID", "A stable scheduling idempotency key is required");
  }

  const now = requiredDate(from, "SCHEDULING_NOW_INVALID");
  const start = requiredDate(sequenceStart, "SEQUENCE_START_INVALID");
  const earliestValues = [
    now.getTime(),
    start.getTime() + FOLLOW_UP_DAY_OFFSETS[sequenceStep] * DAY_MS
  ];
  if (sequenceStep > 0) {
    const previous = requiredDate(previousAcceptedAt, "PREVIOUS_ACCEPTANCE_UNAVAILABLE");
    earliestValues.push(previous.getTime() + MINIMUM_FOLLOW_UP_INTERVAL_MS);
  }
  const earliest = new Date(Math.max(...earliestValues));
  const minute = deterministicMinute(idempotencyKey, WINDOW_START_MINUTES, WINDOW_END_MINUTES);
  let localDate = DateTime.fromJSDate(earliest, { zone: "utc" }).setZone(zone).startOf("day");
  let candidate = localDate.plus({ minutes: minute });

  if (candidate.toMillis() < earliest.getTime()) {
    localDate = localDate.plus({ days: 1 });
  }
  while (!ALLOWED_WEEKDAYS.has(localDate.weekday)) localDate = localDate.plus({ days: 1 });
  candidate = localDate.plus({ minutes: minute });

  // This assertion protects future refactors around DST and local calendar
  // arithmetic: a persisted queue timestamp may never precede any hard bound.
  if (!candidate.isValid || candidate.toMillis() < earliest.getTime() || candidate.toMillis() < now.getTime()) {
    throw schedulingError("SCHEDULED_TIME_PRECEDES_HARD_BOUND", "The recipient-local schedule would be in the past");
  }

  return candidate.toUTC().toJSDate();
}

export function deterministicMinute(key, start = WINDOW_START_MINUTES, end = WINDOW_END_MINUTES) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) throw new TypeError("Invalid scheduling window");
  const value = createHash("sha256").update(String(key)).digest().readUInt32BE(0);
  return start + (value % (end - start + 1));
}

function requiredDate(value, code) {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && !value.trim())
  ) {
    throw schedulingError(code, code);
  }
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw schedulingError(code, code);
  return date;
}

function schedulingError(code, message) {
  return Object.assign(new TypeError(message), { code, retryable: false });
}
