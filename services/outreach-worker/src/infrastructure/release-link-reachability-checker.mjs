import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

import { ApplicationError } from "../errors.mjs";
import { createAbortScope } from "./abort-signal.mjs";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const HEAD_FALLBACK_STATUSES = new Set([405, 501]);
const MAX_URL_BYTES = 2_048;
const PERMANENT_TLS_CODES = new Set([
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "ERR_TLS_CERT_SIGNATURE_ALGORITHM_UNSUPPORTED",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
]);

const BLOCKED_IPV4_RANGES = Object.freeze([
  [0x00000000, 8], // current network
  [0x0a000000, 8], // private
  [0x64400000, 10], // carrier-grade NAT
  [0x7f000000, 8], // loopback
  [0xa9fe0000, 16], // link-local
  [0xac100000, 12], // private
  [0xc0000000, 24], // IETF protocol assignments
  [0xc0000200, 24], // documentation
  [0xc01fc400, 24], // AS112 service
  [0xc034c100, 24], // AMT
  [0xc0586300, 24], // deprecated 6to4 relay anycast
  [0xc0a80000, 16], // private
  [0xc0af3000, 24], // direct delegation AS112 service
  [0xc6120000, 15], // benchmarking
  [0xc6336400, 24], // documentation
  [0xcb007100, 24], // documentation
  [0xe0000000, 4], // multicast
  [0xf0000000, 4] // reserved and limited broadcast
]);

export class ReleaseLinkReachabilityChecker {
  constructor(config, options = {}) {
    this.timeoutMs = config.timeoutMs;
    this.maxRedirects = config.maxRedirects;
    this.maxHeaderBytes = config.maxHeaderBytes;
    this.lookup = options.lookup ?? dnsLookup;
    this.request = options.request ?? requestPinnedHttps;
    this.signal = options.signal;
  }

  async assertReachable(value, { signal } = {}) {
    const abortScope = createAbortScope({
      signals: [this.signal, signal],
      timeoutMs: this.timeoutMs
    });

    try {
      let current = parseReleaseUrl(value);
      const visited = new Set();

      for (let redirects = 0; ; redirects += 1) {
        const visitKey = current.toString();
        if (visited.has(visitKey)) {
          throw permanentError("RELEASE_LINK_REDIRECT_LOOP", "Release link redirect loop detected");
        }
        visited.add(visitKey);

        const destination = await this.#resolvePublicDestination(current, abortScope.signal);
        let method = "HEAD";
        let response = await awaitWithAbort(this.request({
          url: current,
          method,
          ...destination,
          signal: abortScope.signal,
          maxHeaderBytes: this.maxHeaderBytes
        }), abortScope.signal);

        if (HEAD_FALLBACK_STATUSES.has(response.statusCode)) {
          method = "GET";
          response = await awaitWithAbort(this.request({
            url: current,
            method,
            ...destination,
            signal: abortScope.signal,
            maxHeaderBytes: this.maxHeaderBytes
          }), abortScope.signal);
        }

        if (REDIRECT_STATUSES.has(response.statusCode)) {
          if (redirects >= this.maxRedirects) {
            throw permanentError("RELEASE_LINK_REDIRECT_LIMIT", "Release link exceeds the redirect limit", {
              redirects: this.maxRedirects
            });
          }
          const location = firstHeader(response.headers?.location);
          if (!location) {
            throw permanentError("RELEASE_LINK_REDIRECT_INVALID", "Release link redirect is missing a location");
          }
          try {
            current = parseReleaseUrl(new URL(location, current).toString());
          } catch (error) {
            if (error instanceof ApplicationError) throw error;
            throw permanentError("RELEASE_LINK_REDIRECT_INVALID", "Release link redirect location is invalid", undefined, error);
          }
          continue;
        }

        assertAcceptableStatus(response.statusCode);
        return Object.freeze({
          reachable: true,
          statusCode: response.statusCode,
          method,
          redirects
        });
      }
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      if (abortScope.externallyAborted) {
        throw retryableError("RELEASE_LINK_CHECK_ABORTED", "Release link check was aborted", undefined, error);
      }
      if (abortScope.timedOut) {
        throw retryableError("RELEASE_LINK_CHECK_TIMEOUT", "Release link check timed out", {
          timeoutMs: this.timeoutMs
        }, error, 504);
      }
      if (PERMANENT_TLS_CODES.has(error?.code)) {
        throw permanentError("RELEASE_LINK_TLS_INVALID", "Release link TLS validation failed", undefined, error);
      }
      if (error?.code === "HPE_HEADER_OVERFLOW") {
        throw permanentError("RELEASE_LINK_HEADERS_TOO_LARGE", "Release link response headers exceed the byte limit", {
          maxHeaderBytes: this.maxHeaderBytes
        }, error);
      }
      throw retryableError("RELEASE_LINK_NETWORK_ERROR", "Release link could not be reached", undefined, error);
    } finally {
      abortScope.cleanup();
    }
  }

  async #resolvePublicDestination(url, signal) {
    const hostname = unbracket(url.hostname);
    const literalFamily = isIP(hostname);
    const records = literalFamily
      ? [{ address: hostname, family: literalFamily }]
      : await awaitWithAbort(this.lookup(hostname, { all: true, verbatim: true }), signal);
    const normalized = (Array.isArray(records) ? records : [records])
      .map((record) => normalizeAddressRecord(record))
      .filter(Boolean);

    if (normalized.length === 0) {
      throw retryableError("RELEASE_LINK_DNS_EMPTY", "Release link hostname has no usable DNS records");
    }
    if (normalized.some(({ address }) => !isPublicHttpAddress(address))) {
      throw permanentError(
        "RELEASE_LINK_DESTINATION_DISALLOWED",
        "Release link resolves to a non-public or reserved destination"
      );
    }

    normalized.sort((left, right) => left.family - right.family || left.address.localeCompare(right.address));
    return Object.freeze(normalized[0]);
  }
}

export function isPublicHttpAddress(value) {
  const address = String(value ?? "").trim();
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

export function requestPinnedHttps({ url, method, address, family, signal, maxHeaderBytes }) {
  return new Promise((resolve, reject) => {
    const hostname = unbracket(url.hostname);
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };
    const headers = {
      accept: "*/*",
      "accept-encoding": "identity",
      connection: "close",
      "user-agent": "MarcsMusic-Outreach-LinkCheck/1.0",
      ...(method === "GET" ? { range: "bytes=0-0" } : {})
    };
    const requestOptions = {
      protocol: "https:",
      hostname,
      port: 443,
      path: `${url.pathname}${url.search}`,
      method,
      headers,
      agent: false,
      signal,
      maxHeaderSize: maxHeaderBytes,
      rejectUnauthorized: true,
      lookup(_hostname, options, callback) {
        if (options?.all) callback(null, [{ address, family }]);
        else callback(null, address, family);
      }
    };
    if (!isIP(hostname)) requestOptions.servername = hostname;

    const request = httpsRequest(requestOptions, (response) => {
      const result = Object.freeze({
        statusCode: Number(response.statusCode ?? 0),
        headers: response.headers
      });
      response.on("error", () => {});
      response.destroy();
      finish(resolve, result);
    });
    request.on("error", (error) => finish(reject, error));
    request.end();
  });
}

function parseReleaseUrl(value) {
  const raw = String(value ?? "");
  if (Buffer.byteLength(raw, "utf8") > MAX_URL_BYTES) {
    throw permanentError("RELEASE_LINK_URL_TOO_LONG", "Release link exceeds the URL byte limit", {
      maxUrlBytes: MAX_URL_BYTES
    });
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (error) {
    throw permanentError("RELEASE_LINK_URL_INVALID", "Release link must be a valid HTTPS URL", undefined, error);
  }
  if (parsed.protocol !== "https:") {
    throw permanentError("RELEASE_LINK_HTTPS_REQUIRED", "Release link must use HTTPS");
  }
  if (parsed.username || parsed.password) {
    throw permanentError("RELEASE_LINK_CREDENTIALS_DISALLOWED", "Release link must not contain URL credentials");
  }
  if (!parsed.hostname || (parsed.port && parsed.port !== "443")) {
    throw permanentError("RELEASE_LINK_URL_INVALID", "Release link must use the standard HTTPS port");
  }
  parsed.hash = "";
  return parsed;
}

function normalizeAddressRecord(record) {
  const address = typeof record === "string" ? record : record?.address;
  const family = isIP(String(address ?? ""));
  return family ? Object.freeze({ address: String(address), family }) : undefined;
}

function assertAcceptableStatus(statusCode) {
  const status = Number(statusCode);
  if (Number.isInteger(status) && status >= 200 && status < 300) return;
  if (status === 408 || status === 429 || (status >= 500 && status < 600)) {
    throw retryableError(`RELEASE_LINK_HTTP_${status}`, "Release link returned a retryable HTTP status", {
      upstreamStatus: status
    });
  }
  if (status >= 400 && status < 500) {
    throw permanentError(`RELEASE_LINK_HTTP_${status}`, "Release link returned a permanent HTTP status", {
      upstreamStatus: status
    });
  }
  if (status >= 300 && status < 400) {
    throw permanentError(`RELEASE_LINK_HTTP_${status}`, "Release link returned an unsupported redirect status", {
      upstreamStatus: status
    });
  }
  throw retryableError("RELEASE_LINK_RESPONSE_INVALID", "Release link returned an invalid HTTP response");
}

function isPublicIpv4(value) {
  const bytes = value.split(".").map(Number);
  if (bytes.length !== 4 || bytes.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const numeric = ipv4Number(bytes);
  return !BLOCKED_IPV4_RANGES.some(([base, prefix]) => isIpv4InRange(numeric, base, prefix));
}

function isPublicIpv6(value) {
  const bytes = ipv6Bytes(value);
  if (!bytes) return false;
  if ((bytes[0] & 0xe0) !== 0x20) return false; // only global unicast 2000::/3
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] <= 0x01) return false; // IETF special-purpose /23
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return false; // documentation
  if (bytes[0] === 0x20 && bytes[1] === 0x02) return false; // 6to4
  if (bytes[0] === 0x3f && (bytes[1] & 0xf0) === 0xf0) return false; // documentation 3fff::/20
  return true;
}

function ipv6Bytes(value) {
  if (String(value).includes("%")) return undefined;
  let normalized = String(value).toLowerCase();
  const ipv4Index = normalized.lastIndexOf(":");
  if (normalized.includes(".")) {
    const ipv4 = normalized.slice(ipv4Index + 1);
    if (!isPublicSyntaxIpv4(ipv4)) return undefined;
    const bytes = ipv4.split(".").map(Number);
    normalized = `${normalized.slice(0, ipv4Index)}:${((bytes[0] << 8) | bytes[1]).toString(16)}:${((bytes[2] << 8) | bytes[3]).toString(16)}`;
  }

  const halves = normalized.split("::");
  if (halves.length > 2) return undefined;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return undefined;
  const groups = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[a-f0-9]{1,4}$/u.test(group))) return undefined;
  return groups.flatMap((group) => {
    const numeric = Number.parseInt(group, 16);
    return [numeric >> 8, numeric & 0xff];
  });
}

function isPublicSyntaxIpv4(value) {
  return isIP(value) === 4;
}

function ipv4Number(bytes) {
  return (((bytes[0] << 24) >>> 0) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3]) >>> 0;
}

function isIpv4InRange(value, base, prefix) {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) >>> 0 === (base & mask) >>> 0;
}

function firstHeader(value) {
  return Array.isArray(value) ? value[0] : value;
}

function unbracket(value) {
  const text = String(value);
  return text.startsWith("[") && text.endsWith("]") ? text.slice(1, -1) : text;
}

function awaitWithAbort(promise, signal) {
  if (signal.aborted) return Promise.reject(signal.reason ?? new Error("Operation aborted"));
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error("Operation aborted"));
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

function permanentError(code, message, details, cause) {
  return new ApplicationError(message, { code, statusCode: 422, retryable: false, details, cause });
}

function retryableError(code, message, details, cause, statusCode = 503) {
  return new ApplicationError(message, { code, statusCode, retryable: true, details, cause });
}
