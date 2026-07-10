const RECURRENCE_PROPERTIES = new Set("RRULE RDATE EXRULE EXDATE RECURRENCE-ID".split(" "));
const EVENT_ONLY_PROPERTIES = new Set(
  `${[...RECURRENCE_PROPERTIES].join(" ")} ATTACH ATTENDEE CATEGORIES CLASS COMMENT CONTACT CREATED DESCRIPTION DTEND DTSTAMP DTSTART DURATION GEO LAST-MODIFIED LOCATION ORGANIZER PRIORITY RELATED-TO RESOURCES SEQUENCE STATUS SUMMARY TRANSP UID URL`.split(
    " "
  )
);

export function parseCalendarEvents(calendarData) {
  if (!Array.isArray(calendarData)) throw invalidCalendar();
  return calendarData.flatMap((ics) => {
    const events = parseCalendar(ics);
    if (!events.length) throw invalidCalendar();
    return events;
  });
}

function parseCalendar(ics) {
  const lines = String(ics).replace(/\r?\n[ \t]/gu, "").split(/\r?\n/gu).filter(Boolean);
  if (lines[0]?.toUpperCase() !== "BEGIN:VCALENDAR" || lines.at(-1)?.toUpperCase() !== "END:VCALENDAR") {
    throw invalidCalendar();
  }

  const stack = [];
  const events = [];
  let eventProperties = null;
  let eventTreeProperties = null;
  let calendarSeen = false;

  for (const line of lines) {
    const begin = line.match(/^BEGIN:([A-Z0-9-]+)$/iu)?.[1].toUpperCase();
    if (begin) {
      if (
        (!stack.length && begin !== "VCALENDAR") ||
        (begin === "VCALENDAR" && (stack.length || calendarSeen))
      ) {
        throw invalidCalendar();
      }
      if (begin === "VCALENDAR") calendarSeen = true;
      if (begin === "VEVENT") {
        if (stack.length !== 1 || stack[0] !== "VCALENDAR" || eventProperties) throw invalidCalendar();
        eventProperties = [];
        eventTreeProperties = [];
      } else if (eventProperties && (stack.at(-1) !== "VEVENT" || begin !== "VALARM")) {
        throw invalidCalendar();
      }
      stack.push(begin);
      continue;
    }

    const end = line.match(/^END:([A-Z0-9-]+)$/iu)?.[1].toUpperCase();
    if (end) {
      if (stack.pop() !== end) throw invalidCalendar();
      if (end === "VEVENT") {
        events.push(parseEvent(eventProperties, eventTreeProperties));
        eventProperties = null;
        eventTreeProperties = null;
      }
      continue;
    }

    if (!stack.length) throw invalidCalendar();
    const property = parseProperty(line);
    if (stack.at(-1) === "VCALENDAR" && EVENT_ONLY_PROPERTIES.has(property.name)) throw invalidCalendar();
    if (eventTreeProperties) eventTreeProperties.push(property);
    if (eventProperties && stack.at(-1) === "VEVENT") eventProperties.push(property);
  }

  if (stack.length || eventProperties || eventTreeProperties) throw invalidCalendar();
  return events;
}

function parseEvent(properties, treeProperties) {
  if (
    treeProperties.some(({ name }) => RECURRENCE_PROPERTIES.has(name)) ||
    properties.some(({ name }) => name === "DURATION")
  ) {
    throw invalidCalendar();
  }

  const start = parseDateProperty(singleProperty(properties, "DTSTART", true));
  const end = parseDateProperty(singleProperty(properties, "DTEND", true));
  if (start.type !== end.type || !Number.isFinite(start.date.getTime()) || !Number.isFinite(end.date.getTime()) || end.date <= start.date) {
    throw invalidCalendar();
  }

  return Object.freeze({
    start: start.date,
    end: end.date,
    status: singleProperty(properties, "STATUS")?.value.toUpperCase() ?? "",
    transp: singleProperty(properties, "TRANSP")?.value.toUpperCase() ?? ""
  });
}

function parseProperty(line) {
  const separator = line.indexOf(":");
  if (separator < 1) throw invalidCalendar();
  const [rawName, ...rawParameters] = line.slice(0, separator).split(";");
  const name = rawName.toUpperCase();
  if (!/^[A-Z0-9-]+$/u.test(name) || name === "BEGIN" || name === "END") throw invalidCalendar();
  const parameters = new Map();
  for (const parameter of rawParameters) {
    const [rawKey, rawValue, ...rest] = parameter.split("=");
    const key = rawKey?.toUpperCase();
    if (!/^[A-Z0-9-]+$/u.test(key) || !rawValue || rest.length || parameters.has(key)) throw invalidCalendar();
    parameters.set(key, rawValue.toUpperCase());
  }
  return { name, parameters, value: line.slice(separator + 1).trim() };
}

function singleProperty(properties, name, required = false) {
  const matches = properties.filter((property) => property.name === name);
  if (matches.length > 1 || (required && matches.length !== 1)) throw invalidCalendar();
  return matches[0] ?? null;
}

function parseDateProperty(property) {
  const parsed = parseIcsDate(property.value);
  const declaredType = property.parameters.get("VALUE");
  if (
    property.parameters.size > (declaredType ? 1 : 0) ||
    (parsed.type === "date" && declaredType !== "DATE") ||
    (parsed.type === "date-time" && declaredType && declaredType !== "DATE-TIME")
  ) {
    throw invalidCalendar();
  }
  return parsed;
}

function parseIcsDate(value) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z)?$/u);
  const type = value.length === 8 ? "date" : value.length === 16 ? "date-time" : null;
  if (!match || !type) return { date: new Date(Number.NaN), type };

  const parts = match.slice(1).map((part) => Number(part ?? 0));
  const [year, month, day, hour, minute, second] = parts;
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return { date: new Date(Number.NaN), type };
  }

  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  const actual = [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  ];
  return {
    date: actual.every((part, index) => part === parts[index]) ? date : new Date(Number.NaN),
    type
  };
}

function invalidCalendar() {
  return new Error("Invalid or unsupported calendar data.");
}
