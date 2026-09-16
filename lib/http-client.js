const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
export function createHttpClient({ timeoutMs = 10000, maxConcurrent = 16 } = {}) {
  let active = 0;
  return async function request(url, options = {}) {
    if (active >= maxConcurrent) throw Object.assign(new Error('Integration capacity exceeded'), { statusCode: 503 });
    active++;
    const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal, redirect: 'error' });
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body || []) {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) throw new Error('Integration response exceeds limit');
        chunks.push(chunk);
      }
      const text = Buffer.concat(chunks).toString('utf8');
      return { ok: response.ok, status: response.status, headers: response.headers, text: async () => text, json: async () => JSON.parse(text) };
    } catch (cause) {
      throw Object.assign(new Error('Integration request failed', { cause }), { statusCode: 503 });
    } finally { active--; }
  };
}
