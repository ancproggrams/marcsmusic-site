import { DateTime } from "luxon";
import { resolveRecipientTimezone } from "./recipient-locale.mjs";
import { scheduleSequenceStep } from "./scheduler.mjs";

const MAX_BODY_LENGTH = 20_000;
const MAX_RETURN_HORIZON_DAYS = 366;
const MAX_DATE_CANDIDATES = 12;
const RETURN_CUE = /(?:\b(?:i|we)\s+(?:will\s+)?return(?:ing)?|\breturn(?:ing)?|\bback|\baway\s+until|\bout\s+of\s+(?:the\s+)?office\s+until|\bterug|\bweer\s+aanwezig|\bafwezig\s+tot|\bvakantie\s+tot|\bzuruck|\bzurück|\bwieder\s+da|\babwesend\s+bis|\burlaub\s+bis|\bde\s+retour|\bretour|\babsent(?:e)?\s+jusqu|\ben\s+conge\s+jusqu|\bregreso|\bvuelvo|\bfuera\s+hasta|\bvacaciones\s+hasta|\bregresso|\bvolto|\bausente\s+ate|\bferias\s+ate)\s*(?:on|op|am|le|el|a|em|ate)?\s*[:;,\-]?\s*$/u;
const RETURN_CONTEXT = /\b(?:return(?:ing)?|back|away\s+until|office\s+until|terug|aanwezig|afwezig\s+tot|vakantie\s+tot|zuruck|wieder\s+da|abwesend\s+bis|urlaub\s+bis|retour|absent(?:e)?\s+jusqu|regreso|vuelvo|fuera\s+hasta|vacaciones\s+hasta|regresso|volto|ausente\s+ate|ferias\s+ate)\b/u;
const ISO_DATE = /(?<!\d)(20\d{2}-\d{2}-\d{2})(?!\d)/gu;
const DAY_MONTH_DATE = /(?<![a-z0-9])(\d{1,2})(?:st|nd|rd|th)?\.?\s+(?:de\s+)?([a-z]+)(?:\s+de)?\s*,?\s*(20\d{2})(?!\d)/gu;
const MONTH_DAY_DATE = /(?<![a-z0-9])([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(20\d{2})(?!\d)/gu;
const NUMERIC_NON_ISO_DATE = /(?<!\d)\d{1,2}[/.\-]\d{1,2}[/.\-]20\d{2}(?!\d)/gu;

const MONTHS = new Map(Object.entries({
  january: 1, januari: 1, januar: 1, janvier: 1, enero: 1, janeiro: 1,
  february: 2, februari: 2, februar: 2, fevrier: 2, febrero: 2, fevereiro: 2,
  march: 3, maart: 3, marz: 3, maerz: 3, mars: 3, marzo: 3, marco: 3,
  april: 4, avril: 4, abril: 4,
  may: 5, mei: 5, mai: 5, mayo: 5, maio: 5,
  june: 6, juni: 6, juin: 6, junio: 6, junho: 6,
  july: 7, juli: 7, juillet: 7, julio: 7, julho: 7,
  august: 8, augustus: 8, aout: 8, agosto: 8,
  september: 9, septiembre: 9, setembro: 9,
  october: 10, oktober: 10, octobre: 10, octubre: 10, outubro: 10,
  november: 11, noviembre: 11, novembro: 11,
  december: 12, dezember: 12, decembre: 12, diciembre: 12, dezembro: 12
}));

export function inferOutOfOfficeResume({ body, occurredAt, timezones = [], idempotencyKey, now = new Date() } = {}) {
  const eventTime = requiredDate(occurredAt, "REPLY_RESUME_BASE_DATE_MISSING");
  const processingTime = requiredDate(now, "REPLY_RESUME_NOW_INVALID");
  const timezone = firstRecipientTimezone(timezones);
  if (!timezone) return indefinite("recipient_timezone_invalid");

  const parsed = parseExplicitReturnDate(body, { occurredAt: eventTime, timezone });
  if (!parsed.date) return indefinite(parsed.reason, timezone);

  const stableKey = String(idempotencyKey ?? `${eventTime.toISOString()}:${String(body ?? "").slice(0, 500)}`);
  const resumeAt = scheduleSequenceStep({
    sequenceStep: 0,
    timezone,
    idempotencyKey: `out-of-office:${stableKey}`,
    from: processingTime,
    sequenceStart: parsed.date.toUTC().toJSDate()
  });
  if (resumeAt.getTime() < processingTime.getTime()) {
    throw Object.assign(new Error("Out-of-office resume was scheduled in the past"), {
      code: "OUT_OF_OFFICE_RESUME_IN_PAST",
      retryable: false
    });
  }
  return Object.freeze({
    resumeAt,
    timezone,
    dateSource: parsed.source,
    pauseMode: "scheduled"
  });
}

export function parseExplicitReturnDate(body, { occurredAt, timezone } = {}) {
  const eventTime = requiredDate(occurredAt, "REPLY_RESUME_BASE_DATE_MISSING");
  const zone = resolveRecipientTimezone({ contactTimezone: timezone });
  if (!zone) return Object.freeze({ reason: "recipient_timezone_invalid" });
  const normalized = normalizeText(body).slice(0, MAX_BODY_LENGTH);
  if (!normalized) return Object.freeze({ reason: "return_date_missing" });

  const candidates = [];
  let sawDateLike = false;
  let returnDateCount = 0;
  let ambiguousReturnDate = false;
  let returnDateOverflow = false;
  const registerReturnDate = (match, collect) => {
    sawDateLike = true;
    if (!hasReturnCue(normalized, match.index)) return true;
    returnDateCount += 1;
    if (returnDateCount > MAX_DATE_CANDIDATES) {
      returnDateOverflow = true;
      return false;
    }
    collect();
    return true;
  };
  collectMatches(normalized, ISO_DATE, (match) => {
    return registerReturnDate(match, () => {
      const [year, month, day] = match[1].split("-").map(Number);
      candidates.push(candidateDate({ year, month, day, zone, source: "explicit_iso_date" }));
    });
  });
  collectMatches(normalized, DAY_MONTH_DATE, (match) => {
    return registerReturnDate(match, () => {
      const month = MONTHS.get(match[2]);
      if (month) candidates.push(candidateDate({ year: Number(match[3]), month, day: Number(match[1]), zone, source: "explicit_named_date" }));
      else ambiguousReturnDate = true;
    });
  });
  collectMatches(normalized, MONTH_DAY_DATE, (match) => {
    return registerReturnDate(match, () => {
      const month = MONTHS.get(match[1]);
      if (month) candidates.push(candidateDate({ year: Number(match[3]), month, day: Number(match[2]), zone, source: "explicit_named_date" }));
      else ambiguousReturnDate = true;
    });
  });
  collectMatches(normalized, NUMERIC_NON_ISO_DATE, (match) => {
    return registerReturnDate(match, () => { ambiguousReturnDate = true; });
  });

  const valid = candidates.filter(({ date }) => date?.isValid);
  const unique = new Map(valid.map((candidate) => [candidate.date.toISODate(), candidate]));
  if (
    returnDateOverflow ||
    ambiguousReturnDate ||
    candidates.length !== valid.length ||
    unique.size !== 1
  ) {
    return Object.freeze({
      reason: returnDateOverflow || ambiguousReturnDate || unique.size > 1 || candidates.length > valid.length || sawDateLike
        ? "return_date_invalid_or_ambiguous"
        : "return_date_missing_or_untrusted"
    });
  }

  const selected = [...unique.values()][0];
  const localEventDate = DateTime.fromJSDate(eventTime, { zone: "utc" }).setZone(zone).startOf("day");
  const maximum = localEventDate.plus({ days: MAX_RETURN_HORIZON_DAYS }).endOf("day");
  if (selected.date <= localEventDate || selected.date > maximum) {
    return Object.freeze({ reason: "return_date_out_of_bounds" });
  }
  return Object.freeze(selected);
}

function candidateDate({ year, month, day, zone, source }) {
  const date = DateTime.fromObject({ year, month, day }, { zone }).startOf("day");
  return Object.freeze({ date, source });
}

function collectMatches(text, pattern, visit) {
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    if (visit(match) === false) break;
  }
}

function hasReturnCue(text, dateIndex) {
  const context = text.slice(Math.max(0, dateIndex - 100), dateIndex);
  return RETURN_CUE.test(context) || RETURN_CONTEXT.test(context);
}

function firstRecipientTimezone(values) {
  for (const value of Array.isArray(values) ? values : [values]) {
    const timezone = resolveRecipientTimezone({ contactTimezone: value });
    if (timezone) return timezone;
  }
  return undefined;
}

function indefinite(dateSource, timezone) {
  return Object.freeze({ resumeAt: undefined, timezone, dateSource, pauseMode: "indefinite" });
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLowerCase()
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, " ");
}

function requiredDate(value, code) {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && !value.trim())
  ) {
    throw Object.assign(new Error(code), { code, retryable: false });
  }
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error(code), { code, retryable: false });
  }
  return date;
}
