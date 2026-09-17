const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_RESPONSE_BYTES = 256 * 1024;

export class UpstreamRequestError extends Error {
  constructor(code, { retryable = true, ambiguous = false, statusCode = 502 } = {}) {
    super(code);
    this.name = "UpstreamRequestError";
    this.code = code;
    this.retryable = retryable;
    this.ambiguous = ambiguous;
    this.statusCode = statusCode;
  }
}

export function boundedInteger(value, fallback, { min, max, name = "value" }) {
  const parsed = value === undefined || value === null || value === ""
    ? fallback
    : Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return parsed;
}

export async function boundedFetch(url, init = {}, options = {}) {
  const timeoutMs = boundedInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, {
    min: 100,
    max: 60_000,
    name: "upstream timeout"
  });
  const maxResponseBytes = boundedInteger(options.maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES, {
    min: 1,
    max: 4 * 1024 * 1024,
    name: "upstream response limit"
  });
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const method = String(init.method || "GET").toUpperCase();
  const ambiguous = !["GET", "HEAD", "OPTIONS"].includes(method);

  try {
    const response = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: controller.signal
    });

    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel().catch(() => {});
      throw new UpstreamRequestError("UPSTREAM_REDIRECT_FORBIDDEN", {
        retryable: false,
        ambiguous,
        statusCode: 502
      });
    }

    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
      await response.body?.cancel().catch(() => {});
      throw new UpstreamRequestError("UPSTREAM_RESPONSE_TOO_LARGE", {
        retryable: false,
        ambiguous,
        statusCode: 502
      });
    }

    const chunks = [];
    let received = 0;
    if (response.body) {
      for await (const chunk of response.body) {
        received += chunk.byteLength;
        if (received > maxResponseBytes) {
          controller.abort();
          throw new UpstreamRequestError("UPSTREAM_RESPONSE_TOO_LARGE", {
            retryable: false,
            ambiguous,
            statusCode: 502
          });
        }
        chunks.push(Buffer.from(chunk));
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      text: Buffer.concat(chunks, received).toString("utf8")
    };
  } catch (error) {
    if (error instanceof UpstreamRequestError) {
      throw error;
    }
    if (timedOut || error?.name === "AbortError") {
      throw new UpstreamRequestError("UPSTREAM_TIMEOUT", {
        retryable: true,
        ambiguous,
        statusCode: 504
      });
    }
    throw new UpstreamRequestError("UPSTREAM_NETWORK_ERROR", {
      retryable: true,
      ambiguous,
      statusCode: 502
    });
  } finally {
    clearTimeout(timer);
  }
}

export function parseBoundedJson(result, code = "UPSTREAM_INVALID_JSON") {
  if (!result.text.trim()) {
    return {};
  }
  try {
    return JSON.parse(result.text);
  } catch {
    throw new UpstreamRequestError(code, { retryable: false, statusCode: 502 });
  }
}
