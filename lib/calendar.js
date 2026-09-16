import ICAL from 'ical.js';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

export function localTimeToUtc(parts, timeZone) {
  const nominal = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour || 0, parts.minute || 0, parts.second || 0);
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' });
  let result = nominal;
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(formatter.formatToParts(new Date(result)).map(v => [v.type,v.value]));
    const displayed = Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
    result += nominal - displayed;
  }
  return new Date(result);
}

function toDate(time, property, fallbackZone) {
  const tzid = property?.getParameter('tzid');
  if (tzid) {
    return localTimeToUtc({ year: time.year, month: time.month, day: time.day, hour: time.hour, minute: time.minute, second: time.second }, tzid);
  }
  if (time.zone && !['floating', 'local'].includes(time.zone.tzid)) return time.toJSDate();
  return localTimeToUtc(time, fallbackZone);
}

export function calendarEvents(ics, rangeStart, rangeEnd, fallbackZone = 'Europe/Amsterdam') {
  const root = new ICAL.Component(ICAL.parse(ics));
  const components = root.getAllSubcomponents('vevent');
  const masters = components.filter(c => !c.hasProperty('recurrence-id'));
  const events = [];
  for (const component of masters) {
    const event = new ICAL.Event(component);
    for (const exception of components.filter(c => c.hasProperty('recurrence-id') && c.getFirstPropertyValue('uid') === event.uid)) event.relateException(new ICAL.Event(exception));
    const append = (item, startTime, endTime) => {
      const c = item.component;
      if (String(c.getFirstPropertyValue('status')).toUpperCase() === 'CANCELLED' || String(c.getFirstPropertyValue('transp')).toUpperCase() === 'TRANSPARENT') return;
      const startProp = c.getFirstProperty('dtstart');
      const start = toDate(startTime, startProp, fallbackZone);
      const end = toDate(endTime, c.getFirstProperty('dtend') || startProp, fallbackZone);
      if (!Number.isFinite(+start) || !Number.isFinite(+end) || end < start) throw new Error('Invalid calendar interval');
      if (start < rangeEnd && rangeStart < end) events.push({ uid: event.uid, bookingId: c.getFirstPropertyValue('x-marcsmusic-booking-id'), start, end });
    };
    if (!component.hasProperty('dtstart')) throw new Error('Calendar event missing DTSTART');
    if (!event.isRecurring()) { append(event, event.startDate, event.endDate); continue; }
    const iterator = event.iterator();
    let completed = false;
    for (let i = 0; i < 10000; i++) {
      const occurrence = iterator.next();
      if (!occurrence) { completed = true; break; }
      // Include exceptions moved into the range separately below.
      if (toDate(occurrence, component.getFirstProperty('dtstart'), fallbackZone) >= rangeEnd) { completed = true; break; }
      const detail = event.getOccurrenceDetails(occurrence);
      append(detail.item, detail.startDate, detail.endDate);
    }
    if (!completed) throw new Error('Calendar recurrence expansion exceeds safe limit');
    for (const exception of Object.values(event.exceptions)) append(exception, exception.startDate, exception.endDate);
  }
  // Expanded server results may contain only RECURRENCE-ID instances.
  for (const c of components.filter(c => c.hasProperty('recurrence-id') && !masters.some(m => m.getFirstPropertyValue('uid') === c.getFirstPropertyValue('uid')))) {
    const clone = new ICAL.Component(c.toJSON());
    clone.removeAllProperties('recurrence-id');
    events.push(...calendarEvents(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${clone.toString()}\r\nEND:VCALENDAR`, rangeStart, rangeEnd, fallbackZone));
  }
  return events.filter((event, index, all) => all.findIndex(other => other.uid === event.uid && +other.start === +event.start && +other.end === +event.end) === index);
}

export function parseCalendarResponse(xml, start, end, timeZone) {
  if (XMLValidator.validate(xml) !== true) throw new Error('Invalid CalDAV XML');
  const document = new XMLParser({ removeNSPrefix: true, ignoreAttributes: false, parseTagValue: false, processEntities: true }).parse(xml);
  if (!Object.hasOwn(document, 'multistatus')) throw new Error('Expected CalDAV multistatus');
  const responses = document.multistatus?.response ? [].concat(document.multistatus.response) : [];
  const events = [];
  for (const response of responses) {
    const props = [].concat(response.propstat || []);
    let found = false;
    for (const prop of props) {
      const data = prop.prop?.['calendar-data'];
      if (data !== undefined) {
        if (!/ 200 /.test(prop.status || '')) throw new Error('Calendar data unavailable');
        const text = typeof data === 'string' ? data : data['#text'];
        if (typeof text !== 'string' || !text.includes('BEGIN:VCALENDAR')) throw new Error('Invalid calendar data');
        events.push(...calendarEvents(text, start, end, timeZone));
        found = true;
      }
    }
    if (!found) throw new Error('CalDAV response omits requested calendar data');
  }
  return events;
}

export function eventMatchesBooking(ics, booking, uid, timeZone) {
  const events = calendarEvents(ics, new Date(booking.startUtc), new Date(booking.endUtc), timeZone);
  return events.some(e => e.uid === uid && e.bookingId === booking.id && +e.start === Date.parse(booking.startUtc) && +e.end === Date.parse(booking.endUtc));
}
