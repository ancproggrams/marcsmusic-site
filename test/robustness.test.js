import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { calendarEvents } from '../lib/calendar.js';
import { createBookingService, reservesSlot } from '../lib/booking-service.js';
import { createHttpClient } from '../lib/http-client.js';
import { createRateLimiter } from '../lib/rate-limit.js';
import { openStore } from '../lib/store.js';

test('calendar expands recurrence and observes TZID daylight saving time', () => {
  const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:weekly\r\nDTSTART;TZID=Europe/Amsterdam:20260901T120000\r\nDTEND;TZID=Europe/Amsterdam:20260901T130000\r\nRRULE:FREQ=WEEKLY;COUNT=4\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
  const events = calendarEvents(ics, new Date('2026-09-14T00:00:00Z'), new Date('2026-09-16T00:00:00Z'));
  assert.equal(events.length, 1);
  assert.equal(events[0].start.toISOString(), '2026-09-15T10:00:00.000Z');
  assert.equal(events[0].end.toISOString(), '2026-09-15T11:00:00.000Z');
});

test('calendar understands all-day events and DURATION', () => {
  const allDay = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:all-day\r\nDTSTART;VALUE=DATE:20260920\r\nDTEND;VALUE=DATE:20260921\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
  const duration = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:duration\r\nDTSTART:20260920T100000Z\r\nDURATION:PT90M\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
  const rangeStart = new Date('2026-09-19T00:00:00Z');
  const rangeEnd = new Date('2026-09-22T00:00:00Z');
  const [day] = calendarEvents(allDay, rangeStart, rangeEnd, 'UTC');
  const [timed] = calendarEvents(duration, rangeStart, rangeEnd, 'UTC');
  assert.equal(day.end - day.start, 24 * 60 * 60 * 1000);
  assert.equal(timed.end - timed.start, 90 * 60 * 1000);
});

test('paid cancellation remains terminal when a paid webhook is replayed', async (t) => {
  const harness = await serviceHarness({ createEvent: async () => ({ uid: 'event', url: 'https://calendar/event' }) });
  t.after(harness.close);
  const booking = await harness.seed({ status: 'cancelled', cancelRequested: true, molliePaymentId: 'tr_replay', calendarDeletedAt: new Date().toISOString() });
  harness.payment.metadata.bookingId = booking.id;
  harness.payment.id = 'tr_replay';
  await harness.service.webhook('tr_replay');
  const persisted = await harness.store.get('bookings', booking.id);
  assert.equal(persisted.status, 'refund_review');
  assert.equal(harness.calls.createEvent, 0);
});

test('calendar failure preserves the paid reservation and a durable retry job', async (t) => {
  const harness = await serviceHarness({ createEvent: async () => { throw new Error('calendar unavailable'); } });
  t.after(harness.close);
  const booking = await harness.seed({ status: 'pending_payment', molliePaymentId: 'tr_failure' });
  harness.payment.metadata.bookingId = booking.id;
  harness.payment.id = 'tr_failure';
  await harness.service.webhook('tr_failure');
  const persisted = await harness.store.get('bookings', booking.id);
  const job = await harness.store.get('jobs', `confirm:${booking.id}`);
  assert.equal(persisted.status, 'calendar_failed');
  assert.equal(reservesSlot(persisted), true);
  assert.equal(job.status, 'pending');
  assert.equal(job.attempts, 1);
});

test('duplicate paid webhooks create one calendar event', async (t) => {
  const harness = await serviceHarness();
  t.after(harness.close);
  const booking = await harness.seed({ status: 'pending_payment', molliePaymentId: 'tr_duplicate' });
  harness.payment.metadata.bookingId = booking.id;
  harness.payment.id = 'tr_duplicate';
  await Promise.all([harness.service.webhook('tr_duplicate'), harness.service.webhook('tr_duplicate')]);
  assert.equal((await harness.store.get('bookings', booking.id)).status, 'confirmed');
  assert.equal(harness.calls.createEvent, 1);
});

test('CRM failure after payment creation does not discard checkout or reservation', async (t) => {
  const harness = await serviceHarness({ updateCrmBooking: async () => { throw new Error('CRM unavailable'); } });
  t.after(harness.close);
  const result = await harness.service.create({ startUtc: '2026-11-10T10:00:00Z', endUtc: '2026-11-10T11:00:00Z' }, 'request-crm-failure-0001');
  assert.equal(result.checkoutUrl, 'https://checkout.test');
  const booking = await harness.store.get('bookings', result.bookingId);
  assert.equal(booking.status, 'pending_payment');
  assert.equal(reservesSlot(booking), true);
  assert.equal((await harness.store.get('jobs', `crm:${booking.id}`)).status, 'pending');
});

test('failed calendar deletion remains a visible retry instead of reporting cancellation complete', async (t) => {
  const harness = await serviceHarness({ deleteEvent: async () => { throw new Error('calendar unavailable'); } });
  t.after(harness.close);
  const booking = await harness.seed({ status: 'confirmed', caldavEventUid: 'event-to-delete' });
  const result = await harness.service.cancel(booking.id);
  assert.equal(result.pending, true);
  assert.equal((await harness.store.get('bookings', booking.id)).status, 'cancel_requested');
  assert.equal((await harness.store.get('jobs', `cancel:${booking.id}`)).status, 'pending');
});

test('payment amount and currency must match before a state transition', async (t) => {
  const harness = await serviceHarness();
  t.after(harness.close);
  const booking = await harness.seed({ status: 'pending_payment', molliePaymentId: 'tr_wrong_amount' });
  Object.assign(harness.payment, { id: 'tr_wrong_amount', amount: { currency: 'EUR', value: '1.00' }, metadata: { bookingId: booking.id } });
  await assert.rejects(harness.service.webhook('tr_wrong_amount'), /komt niet overeen/);
  assert.equal((await harness.store.get('bookings', booking.id)).status, 'pending_payment');
});

test('startup recovery recreates durable work for a legacy paid calendar failure', async (t) => {
  const harness = await serviceHarness({ createEvent: async () => { throw new Error('still unavailable'); } });
  t.after(harness.close);
  const booking = await harness.seed({ status: 'calendar_failed', paidAt: new Date().toISOString(), molliePaymentId: 'tr_recovery' });
  await harness.service.recover();
  const job = await harness.store.get('jobs', `confirm:${booking.id}`);
  assert.equal(job.status, 'pending');
});

test('two concurrent creates for one time window yield one reservation', async (t) => {
  const harness = await serviceHarness();
  t.after(harness.close);
  const payload = { startUtc: '2026-11-10T10:00:00Z', endUtc: '2026-11-10T11:00:00Z' };
  const settled = await Promise.allSettled([
    harness.service.create(payload, 'request-concurrent-0001'),
    harness.service.create(payload, 'request-concurrent-0002')
  ]);
  assert.equal(settled.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(settled.filter((item) => item.status === 'rejected' && item.reason.statusCode === 409).length, 1);
});

test('booking buffer is applied once at its exact boundary', async (t) => {
  const harness = await serviceHarness({ bufferMinutes: 30 });
  t.after(harness.close);
  await harness.service.create({ startUtc: '2026-11-10T10:00:00Z', endUtc: '2026-11-10T11:00:00Z' }, 'request-buffer-first-0001');
  await assert.rejects(
    harness.service.create({ startUtc: '2026-11-10T11:29:00Z', endUtc: '2026-11-10T12:29:00Z' }, 'request-buffer-blocked-01'),
    (error) => error.statusCode === 409
  );
  await harness.service.create({ startUtc: '2026-11-10T11:30:00Z', endUtc: '2026-11-10T12:30:00Z' }, 'request-buffer-allowed-01');
});

test('rate limiter bounds key cardinality and evicts expired entries', () => {
  const limiter = createRateLimiter({ maxKeys: 2, windowMs: 100 });
  assert.equal(limiter.allow('a', 1, 0), true);
  assert.equal(limiter.allow('b', 1, 0), true);
  assert.equal(limiter.allow('c', 1, 0), false);
  assert.equal(limiter.size, 2);
  assert.equal(limiter.allow('c', 1, 101), true);
  assert.equal(limiter.size, 1);
});

test('HTTP client enforces deadlines', async (t) => {
  const server = createServer((_request, response) => setTimeout(() => response.end('late'), 100));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  const http = createHttpClient({ timeoutMs: 10 });
  await assert.rejects(http(`http://127.0.0.1:${port}`), /Integration request failed/);
});

test('invalid zero slot step fails before the server starts', async () => {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, NODE_ENV: 'test', BOOKING_SLOT_STEP_MINUTES: '0', TRANSPARANTE_BROKER_SYNC_ENABLED: 'false' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve) => child.once('exit', resolve));
  assert.notEqual(code, 0);
  assert.match(stderr, /BOOKING_SLOT_STEP_MINUTES must be a positive integer/);
});

async function serviceHarness(overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'marcsmusic-robustness-'));
  const store = await openStore({ path: join(directory, 'db.sqlite') });
  const calls = { createEvent: 0, deleteEvent: 0 };
  const payment = { id: 'tr_default', status: 'paid', amount: { currency: 'EUR', value: '100.00' }, metadata: {} };
  const integrations = {
    createPayment: async (booking) => ({ id: `tr_${booking.id}`, status: 'open', checkoutUrl: 'https://checkout.test' }),
    getPayment: async () => payment,
    findOwnEvent: async () => null,
    windowAvailable: async () => true,
    createEvent: async (booking) => {
      calls.createEvent += 1;
      return overrides.createEvent ? overrides.createEvent(booking) : { uid: `uid-${booking.id}`, url: 'https://calendar.test/event' };
    },
    deleteEvent: async (...args) => { calls.deleteEvent += 1; if (overrides.deleteEvent) return overrides.deleteEvent(...args); },
    eventUid: (booking) => `uid-${booking.id}`,
    upsertContact: async () => ({ id: 'contact' }),
    ensureCrmBooking: async () => ({ id: 'crm-booking' }),
    updateCrmBooking: overrides.updateCrmBooking || (async () => {}),
    addToNewsletter: async () => {}
  };
  const prepareBooking = async (input) => ({
    id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(), startUtc: input.startUtc,
    endUtc: input.endUtc, priceCents: 10000, currency: 'EUR', customer: { name: 'Test', email: 'test@example.test' }
  });
  const service = createBookingService({ store, integrations, prepareBooking, bufferMinutes: overrides.bufferMinutes || 0, logger: () => {} });
  async function seed(fields) {
    const booking = await prepareBooking({ startUtc: '2026-11-10T10:00:00Z', endUtc: '2026-11-10T11:00:00Z' });
    Object.assign(booking, fields);
    await store.put('bookings', booking);
    return booking;
  }
  return { store, service, payment, calls, seed, close: async () => { await service.worker.stop(); await store.close(); await rm(directory, { recursive: true, force: true }); } };
}
