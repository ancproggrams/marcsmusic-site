import { createHash } from 'node:crypto';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12);

export function createId(prefix: string): string {
  return `${prefix}_${nanoid()}`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function stableHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

export function canonicalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    const pathname = url.pathname.replace(/\/+$/, '');
    url.pathname = pathname === '' ? '/' : pathname;
    return url.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

export function platformCanonicalKey(name: string, websiteUrl: string, submissionUrl?: string): string {
  const url = canonicalizeUrl(submissionUrl ?? websiteUrl);
  return `${slugify(name)}:${stableHash(url)}`;
}
