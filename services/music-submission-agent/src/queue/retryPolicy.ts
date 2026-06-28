import { addMilliseconds } from '../utils/time.js';

const permanentSignals = [
  'captcha',
  'login',
  'payment',
  'closed platform',
  'invalid form',
  'unsupported upload',
  'permanent rejection',
  'robots.txt disallows'
];

export function shouldRetryError(errorMessage: string): boolean {
  const normalized = errorMessage.toLowerCase();
  if (permanentSignals.some((signal) => normalized.includes(signal))) {
    return false;
  }

  return (
    normalized.includes('http 429') ||
    normalized.includes('http 500') ||
    normalized.includes('http 502') ||
    normalized.includes('http 503') ||
    normalized.includes('http 504') ||
    normalized.includes('timeout') ||
    normalized.includes('temporary dns') ||
    normalized.includes('network')
  );
}

export function calculateRetryAt(attemptCount: number, now = new Date()): string {
  const baseDelay = Math.min(60_000 * 2 ** Math.max(0, attemptCount - 1), 3_600_000);
  const jitter = Math.floor(Math.random() * Math.min(baseDelay, 30_000));
  return addMilliseconds(now, baseDelay + jitter).toISOString();
}
