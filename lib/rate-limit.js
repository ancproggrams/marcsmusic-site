import { isIP } from 'node:net';
export function clientIp(request, trustedProxies = []) {
  const remote = request.socket.remoteAddress || 'unknown';
  // Trust only explicitly configured direct peers, never arbitrary forwarded headers.
  if (!trustedProxies.includes(remote)) return remote;
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
  while (forwarded.length && trustedProxies.includes(forwarded.at(-1))) forwarded.pop();
  const ip = forwarded.at(-1);
  return ip && isIP(ip) ? ip : remote;
}
export function createRateLimiter({ maxKeys = 10000, windowMs = 60000 } = {}) {
  const buckets = new Map();
  return {
    allow(key, limit = 30, now = Date.now()) {
      for (const [id, value] of buckets) { if (value.resetAt <= now) buckets.delete(id); else break; }
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        if (buckets.size >= maxKeys && !buckets.has(key)) return false;
        buckets.delete(key);
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(key, bucket);
      }
      return ++bucket.count <= limit;
    },
    get size() { return buckets.size; }
  };
}
