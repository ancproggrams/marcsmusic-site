import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

const BLOCKED_HOST_SUFFIXES = [".internal", ".lan", ".local", ".localhost", ".home", ".test"];
const blockedAddresses = createBlockedAddressList();

export class PublicHttpError extends Error {
  constructor(code, { retryable = false } = {}) {
    super(code);
    this.name = "PublicHttpError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function normalizePublicUrl(value) {
  let url;
  try {
    url = parsePublicUrl(value);
  } catch {
    return "";
  }
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_.+|fbclid|gclid|mc_[ce]id|token|access_token|api_?key|signature|auth|email)$/iu.test(key)) {
      url.searchParams.delete(key);
    }
  }
  return url.toString();
}

export function parsePublicUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 2_048 || /[\u0000-\u001f\u007f]/u.test(raw)) {
    throw new PublicHttpError("PUBLIC_URL_INVALID");
  }
  let url;
  try {
    url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
  } catch {
    throw new PublicHttpError("PUBLIC_URL_INVALID");
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new PublicHttpError("PUBLIC_URL_HTTPS_REQUIRED");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/u, "");
  const addressLiteral = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  if (
    !hostname ||
    hostname === "localhost" ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix)) ||
    (isIP(addressLiteral) && isBlockedAddress(addressLiteral))
  ) {
    throw new PublicHttpError("PUBLIC_URL_PRIVATE_HOST");
  }
  url.hostname = hostname;
  return url;
}

export async function fetchPublicText(value, options = {}) {
  const timeoutMs = boundedInteger(options.timeoutMs, 15_000, 100, 60_000, "PUBLIC_FETCH_TIMEOUT_MS");
  const maxBytes = boundedInteger(options.maxBytes, 2 * 1024 * 1024, 1_024, 8 * 1024 * 1024, "PUBLIC_FETCH_MAX_BYTES");
  const maxRedirects = boundedInteger(options.maxRedirects, 3, 0, 5, "PUBLIC_FETCH_MAX_REDIRECTS");
  const deadline = Date.now() + timeoutMs;
  let url = parsePublicUrl(value);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) throw new PublicHttpError("PUBLIC_FETCH_TIMEOUT", { retryable: true });
    const target = await resolvePublicTarget(url, remainingMs, options.lookup || dnsLookup);
    const result = await (options.requestOnce || requestOnce)(url, target, {
      timeoutMs: remainingMs,
      maxBytes,
      headers: options.headers || {}
    });

    if (isRedirect(result.status)) {
      if (redirectCount === maxRedirects || !result.location) {
        throw new PublicHttpError("PUBLIC_FETCH_REDIRECT_REJECTED");
      }
      url = parsePublicUrl(new URL(result.location, url).toString());
      continue;
    }
    if (result.status < 200 || result.status >= 300) {
      throw new PublicHttpError("PUBLIC_FETCH_HTTP_REJECTED", {
        retryable: result.status === 429 || result.status >= 500
      });
    }
    return result.text;
  }
  throw new PublicHttpError("PUBLIC_FETCH_REDIRECT_REJECTED");
}

export async function resolvePublicTarget(url, timeoutMs, lookup = dnsLookup) {
  const lookupHostname = url.hostname.startsWith("[") && url.hostname.endsWith("]")
    ? url.hostname.slice(1, -1)
    : url.hostname;
  const literalFamily = isIP(lookupHostname);
  const records = literalFamily
    ? [{ address: lookupHostname, family: literalFamily }]
    : await withTimeout(
        lookup(lookupHostname, { all: true, verbatim: true }),
        timeoutMs,
        "PUBLIC_DNS_TIMEOUT"
      );
  if (!Array.isArray(records) || records.length === 0 || records.length > 32) {
    throw new PublicHttpError("PUBLIC_DNS_INVALID", { retryable: true });
  }
  for (const record of records) {
    if (!record || !isIP(record.address) || isBlockedAddress(record.address)) {
      throw new PublicHttpError("PUBLIC_DNS_PRIVATE_ADDRESS");
    }
  }
  return { address: records[0].address, family: records[0].family || isIP(records[0].address) };
}

export function isBlockedAddress(address) {
  const normalized = String(address || "").toLowerCase();
  const version = isIP(normalized);
  if (!version) return true;
  if (version === 6 && normalized.startsWith("::ffff:")) return true;
  return blockedAddresses.check(normalized, version === 4 ? "ipv4" : "ipv6");
}

async function requestOnce(url, target, { timeoutMs, maxBytes, headers }) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
    const request = transport(url, {
      method: "GET",
      agent: false,
      headers,
      servername: url.hostname,
      lookup(_hostname, lookupOptions, callback) {
        if (lookupOptions?.all) {
          callback(null, [{ address: target.address, family: target.family }]);
          return;
        }
        callback(null, target.address, target.family);
      }
    });
    const timer = setTimeout(() => {
      request.destroy(new PublicHttpError("PUBLIC_FETCH_TIMEOUT", { retryable: true }));
    }, timeoutMs);

    request.once("response", (response) => {
      if (isRedirect(response.statusCode || 0)) {
        response.destroy();
        clearTimeout(timer);
        resolve({ status: response.statusCode, location: response.headers.location || "", text: "" });
        return;
      }
      const declaredLength = Number(response.headers["content-length"]);
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        response.destroy();
        clearTimeout(timer);
        reject(new PublicHttpError("PUBLIC_FETCH_RESPONSE_TOO_LARGE"));
        return;
      }
      const chunks = [];
      let received = 0;
      response.on("data", (chunk) => {
        received += chunk.length;
        if (received > maxBytes) {
          response.destroy(new PublicHttpError("PUBLIC_FETCH_RESPONSE_TOO_LARGE"));
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      response.once("error", (error) => {
        clearTimeout(timer);
        reject(asPublicHttpError(error));
      });
      response.once("end", () => {
        clearTimeout(timer);
        resolve({
          status: response.statusCode || 0,
          location: response.headers.location || "",
          text: Buffer.concat(chunks, received).toString("utf8")
        });
      });
    });
    request.once("error", (error) => {
      clearTimeout(timer);
      reject(asPublicHttpError(error));
    });
    request.end();
  });
}

function asPublicHttpError(error) {
  return error instanceof PublicHttpError
    ? error
    : new PublicHttpError("PUBLIC_FETCH_NETWORK_ERROR", { retryable: true });
}

function isRedirect(status) {
  return new Set([301, 302, 303, 307, 308]).has(status);
}

function withTimeout(promise, timeoutMs, code) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new PublicHttpError(code, { retryable: true })), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}

function boundedInteger(value, fallback, minimum, maximum, name) {
  const parsed = value === undefined || value === null || value === ""
    ? fallback
    : Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function createBlockedAddressList() {
  const list = new BlockList();
  for (const [address, prefix] of [
    ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
    ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
    ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
    ["224.0.0.0", 4], ["240.0.0.0", 4]
  ]) {
    list.addSubnet(address, prefix, "ipv4");
  }
  for (const [address, prefix] of [
    ["::", 128], ["::1", 128], ["100::", 64], ["2001:db8::", 32],
    ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]
  ]) {
    list.addSubnet(address, prefix, "ipv6");
  }
  return list;
}
