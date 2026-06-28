import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateRetryAt, shouldRetryError } from '../src/queue/retryPolicy.js';

test('retry policy retries transient failures only', () => {
  assert.equal(shouldRetryError('HTTP 429 rate limited'), true);
  assert.equal(shouldRetryError('timeout fetching URL'), true);
  assert.equal(shouldRetryError('temporary DNS failure'), true);
  assert.equal(shouldRetryError('CAPTCHA detected'), false);
  assert.equal(shouldRetryError('payment required'), false);
  assert.equal(shouldRetryError('invalid form'), false);
});

test('retry policy schedules future backoff', () => {
  const now = new Date('2026-06-28T10:00:00.000Z');
  const retryAt = new Date(calculateRetryAt(2, now));
  assert.ok(retryAt.getTime() > now.getTime());
});
