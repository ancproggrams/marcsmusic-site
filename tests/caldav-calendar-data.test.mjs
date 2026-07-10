import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCalendarEvents } from "../src/infrastructure/caldav/parse-calendar-data.mjs";

const calendar = (properties) => `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\n${properties}\r\nEND:VEVENT\r\nEND:VCALENDAR`;

describe("CalDAV calendar-data boundary", () => {
  it("strictly validates wrappers, timestamps, parameters, and recurrence", () => {
    const valid = calendar("DTSTART:20990101T100000Z\r\nDTEND:20990101T110000Z");
    assert.equal(parseCalendarEvents([valid]).length, 1);
    assert.equal(parseCalendarEvents([calendar("DTSTART;VALUE=DATE:20990101\r\nDTEND;VALUE=DATE:20990102")]).length, 1);

    for (const invalid of [
      "BEGIN:VEVENT\r\nDTSTART:20990101T100000Z\r\nDTEND:20990101T110000Z\r\nEND:VEVENT",
      "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR",
      "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\nBEGIN:VCALENDAR\r\nEND:VCALENDAR",
      calendar("DTSTART;VALUE=DATE:20990101\r\nDTEND:20990101T010000Z"),
      calendar("DTSTART;VALUE=DATE:20990101T100000Z\r\nDTEND;VALUE=DATE:20990101T110000Z"),
      calendar("DTSTART;TZID=Europe/Amsterdam:20990101T100000Z\r\nDTEND:20990101T110000Z"),
      calendar("DTSTART:20990101T100000Z\r\nDTEND:20990101T110000Z\r\nDURATION:PT3H"),
      calendar("DTSTART:20990101T100000Z\r\nDTEND:20990101T110000Z\r\nBEGIN:VALARM\r\nRRULE:FREQ=DAILY\r\nEND:VALARM"),
      valid.replace("END:VCALENDAR", "DTSTART:20990102T100000Z\r\nEND:VCALENDAR"),
      calendar("DTSTART:20991301T100000Z\r\nDTEND:20990101T110000Z"),
      calendar("DTSTART:20990101T990000Z\r\nDTEND:20990101T110000Z"),
      ...["RRULE", "RDATE", "EXRULE", "EXDATE", "RECURRENCE-ID"].map((name) =>
        calendar(`DTSTART:20990101T100000Z\r\nDTEND:20990101T110000Z\r\n${name}:20990102T100000Z`)
      )
    ]) {
      assert.throws(() => parseCalendarEvents([invalid]), /Invalid or unsupported calendar data/u);
    }
  });
});
