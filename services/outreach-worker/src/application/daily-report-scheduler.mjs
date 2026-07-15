import { DateTime } from "luxon";

import { BUSINESS_TIMEZONE } from "./date-utils.mjs";

export const DAILY_REPORT_CATCH_UP_DAYS = 7;
export const DAILY_REPORT_SLOTS = Object.freeze({
  preliminary: Object.freeze({ name: "preliminary-2330-v1", rank: 1 }),
  final: Object.freeze({ name: "final-next-day-v1", rank: 2 })
});

/**
 * A date has exactly two immutable scheduler identities. The preliminary slot
 * provides the requested 23:30 view. The next-day final slot recomputes the
 * entire fixed Amsterdam day and therefore includes the final thirty minutes.
 */
export function planDailyReports({ now = new Date(), catchUpDays = DAILY_REPORT_CATCH_UP_DAYS } = {}) {
  const local = localInstant(now);
  if (!Number.isInteger(catchUpDays) || catchUpDays < 1 || catchUpDays > 31) {
    throw reportError("DAILY_REPORT_CATCH_UP_HORIZON_INVALID", "Daily report catch-up horizon must be between 1 and 31 days");
  }
  const candidates = [];
  if (local.hour > 23 || (local.hour === 23 && local.minute >= 30)) {
    candidates.push(candidate(local.toISODate(), DAILY_REPORT_SLOTS.preliminary));
  }
  for (let daysAgo = 1; daysAgo <= catchUpDays; daysAgo += 1) {
    candidates.push(candidate(local.startOf("day").minus({ days: daysAgo }).toISODate(), DAILY_REPORT_SLOTS.final));
  }
  return Object.freeze(candidates);
}

export async function scheduleDailyReports(repository, options = {}) {
  if (typeof repository?.enqueueDailyReportWork !== "function") {
    throw reportError("DAILY_REPORT_REPOSITORY_UNAVAILABLE", "Durable daily report scheduling is unavailable");
  }
  const candidates = planDailyReports(options);
  const results = await Promise.all(candidates.map((entry) => repository.enqueueDailyReportWork(entry)));
  return Object.freeze({ candidates: candidates.length, inserted: results.filter(Boolean).length });
}

export function validateDailyReportWork({ reportDate, scheduleSlot, slotRank, now = new Date(), catchUpDays = DAILY_REPORT_CATCH_UP_DAYS } = {}) {
  const local = localInstant(now);
  if (typeof reportDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(reportDate)) {
    throw reportError("DAILY_REPORT_DATE_REQUIRED", "A YYYY-MM-DD reportDate is required");
  }
  const reportDay = DateTime.fromISO(reportDate, { zone: BUSINESS_TIMEZONE }).startOf("day");
  if (!reportDay.isValid || reportDay.toISODate() !== reportDate) {
    throw reportError("DAILY_REPORT_DATE_INVALID", "reportDate must be a real Amsterdam calendar date");
  }
  const age = Math.round(local.startOf("day").diff(reportDay, "days").days);
  if (age < 0) throw reportError("DAILY_REPORT_DATE_FUTURE", "A future daily report cannot be generated");
  if (age > catchUpDays) throw reportError("DAILY_REPORT_DATE_TOO_OLD", "The daily report is outside the bounded catch-up horizon");

  const expected = Object.values(DAILY_REPORT_SLOTS).find(({ name }) => name === scheduleSlot);
  if (!expected || expected.rank !== slotRank) {
    throw reportError("DAILY_REPORT_SLOT_INVALID", "The daily report schedule slot is invalid");
  }
  if (scheduleSlot === DAILY_REPORT_SLOTS.final.name && age < 1) {
    throw reportError("DAILY_REPORT_FINAL_TOO_EARLY", "A final report can only run on the following Amsterdam date");
  }
  if (
    scheduleSlot === DAILY_REPORT_SLOTS.preliminary.name &&
    age === 0 &&
    (local.hour < 23 || (local.hour === 23 && local.minute < 30))
  ) {
    throw reportError("DAILY_REPORT_PRELIMINARY_TOO_EARLY", "A preliminary report can only run from 23:30 Amsterdam time");
  }
  return Object.freeze({ reportDate, scheduleSlot, slotRank, ageDays: age });
}

function candidate(reportDate, slot) {
  return Object.freeze({
    reportDate,
    scheduleSlot: slot.name,
    slotRank: slot.rank,
    dedupeKey: `daily-report:${reportDate}:${slot.name}`
  });
}

function localInstant(value) {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) throw reportError("DAILY_REPORT_NOW_INVALID", "A valid scheduler instant is required");
  return DateTime.fromJSDate(instant, { zone: "utc" }).setZone(BUSINESS_TIMEZONE);
}

function reportError(code, message) {
  return Object.assign(new Error(message), { code, retryable: false });
}
