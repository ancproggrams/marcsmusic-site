import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

import { ApplicationError } from "../errors.mjs";
import { isPublicHttpAddress } from "./release-link-reachability-checker.mjs";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const TLS_FAILURE_CODES = new Set([
  "CERT_HAS_EXPIRED", "CERT_NOT_YET_VALID", "DEPTH_ZERO_SELF_SIGNED_CERT",
  "ERR_TLS_CERT_ALTNAME_INVALID", "ERR_TLS_CERT_SIGNATURE_ALGORITHM_UNSUPPORTED",
  "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_GET_ISSUER_CERT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
]);
const URL_MAX_BYTES = 2_048;
const ASSET_PROBE_BODY_BYTES = 1_024;
const ASSET_CONTENT_TYPES = Object.freeze({
  artwork: Object.freeze(["image/jpeg", "image/png", "image/webp"]),
  stream: Object.freeze(["audio/", "text/html", "application/xhtml+xml"]),
  mp3: Object.freeze(["audio/mpeg", "audio/mp3", "application/octet-stream"]),
  wav: Object.freeze(["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave", "application/octet-stream"]),
  radioEdit: Object.freeze(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave", "application/octet-stream"])
});

export class EpkVerificationClient {
  constructor(config, options = {}) {
    this.approvedOrigins = config.approvedOrigins;
    this.maxRedirects = config.maxRedirects;
    this.maxHeaderBytes = config.maxHeaderBytes;
    this.maxJsonBodyBytes = config.maxJsonBodyBytes;
    this.maxHtmlBodyBytes = config.maxHtmlBodyBytes;
    this.maxAssetBytes = config.maxAssetBytes;
    this.lookup = options.lookup ?? dnsLookup;
    this.request = options.request ?? requestPinnedHttps;
  }

  async fetchHealth(url, { signal } = {}) {
    const response = await this.#request(url, {
      signal,
      method: "GET",
      expectedPath: "/api/health",
      maxBodyBytes: this.maxJsonBodyBytes,
      contentTypes: ["application/json"]
    });
    const body = parseJson(response.body, "EPK_HEALTH_JSON_INVALID");
    if (!isPlainObject(body) || !isPlainObject(body.capabilities) || body.capabilities.epk !== true) {
      throw permanentError("EPK_HEALTH_UNAVAILABLE", "EPK capability is not available");
    }
    if (body.capabilities.epkStale !== false) {
      throw permanentError("EPK_HEALTH_STALE", "EPK capability is stale");
    }
    return Object.freeze({ epk: true, stale: false });
  }

  async fetchManifest(url, expectedPath, { signal } = {}) {
    const response = await this.#request(url, {
      signal,
      method: "GET",
      expectedPath,
      maxBodyBytes: this.maxJsonBodyBytes,
      contentTypes: ["application/json"]
    });
    return parseJson(response.body, "EPK_MANIFEST_JSON_INVALID");
  }

  async fetchHtml(url, expectedPath, { signal } = {}) {
    const response = await this.#request(url, {
      signal,
      method: "GET",
      expectedPath,
      maxBodyBytes: this.maxHtmlBodyBytes,
      contentTypes: ["text/html"]
    });
    const body = response.body.toString("utf8");
    if (!body || Buffer.from(body, "utf8").byteLength !== response.body.byteLength) {
      throw permanentError("EPK_HTML_INVALID", "EPK HTML response is invalid");
    }
    return body;
  }

  async probeAssets(assets, { signal } = {}) {
    if (!Array.isArray(assets) || assets.length < 3 || assets.length > 5) {
      throw permanentError("EPK_ASSET_COUNT_INVALID", "EPK asset count is outside the verifier bound");
    }
    const results = [];
    for (const asset of assets) results.push(await this.#probeAsset(asset, signal));
    return Object.freeze(results);
  }

  async #probeAsset(asset, signal) {
    const allowedContentTypes = ASSET_CONTENT_TYPES[asset.kind];
    if (!allowedContentTypes) throw permanentError("EPK_ASSET_KIND_INVALID", "EPK asset kind is invalid");
    let response = await this.#request(asset.url, {
      signal,
      method: "HEAD",
      maxBodyBytes: 0,
      contentTypes: allowedContentTypes,
      allowedStatuses: new Set([405, 501])
    });
    let size = assetSize(response, { allowMissing: true });
    if ([405, 501].includes(response.statusCode) || !size) {
      response = await this.#request(asset.url, {
        signal,
        method: "GET",
        headers: { range: "bytes=0-0" },
        maxBodyBytes: ASSET_PROBE_BODY_BYTES,
        contentTypes: allowedContentTypes
      });
      size = assetSize(response, { allowMissing: false });
    }
    if (!Number.isSafeInteger(size) || size < 1 || size > this.maxAssetBytes) {
      throw permanentError("EPK_ASSET_SIZE_INVALID", "EPK asset size is outside the verifier bound", {
        maxAssetBytes: this.maxAssetBytes
      });
    }
    return Object.freeze({ kind: asset.kind, reachable: true, sizeBytes: size });
  }

  async #request(initialUrl, options) {
    let current = parseNetworkUrl(initialUrl, this.approvedOrigins);
    const visited = new Set();
    for (let redirects = 0; ; redirects += 1) {
      if (options.expectedPath && current.pathname !== options.expectedPath) {
        throw permanentError("EPK_ROUTE_REDIRECT_INVALID", "EPK core route changed during verification");
      }
      if (visited.has(current.href)) throw permanentError("EPK_REDIRECT_LOOP", "EPK redirect loop detected");
      visited.add(current.href);
      const destination = await resolvePublicDestination(current, this.lookup, options.signal);
      let response;
      try {
        response = await awaitWithAbort(this.request({
          url: current,
          method: options.method,
          headers: options.headers,
          ...destination,
          signal: options.signal,
          maxHeaderBytes: this.maxHeaderBytes,
          maxBodyBytes: options.maxBodyBytes
        }), options.signal);
      } catch (error) {
        throw classifyTransportError(error, options.signal);
      }
      validateResponseEnvelope(response, this.maxHeaderBytes, options.maxBodyBytes);
      if (REDIRECT_STATUSES.has(response.statusCode)) {
        if (redirects >= this.maxRedirects) throw permanentError("EPK_REDIRECT_LIMIT", "EPK redirect limit exceeded");
        const location = singleHeader(response.headers, "location", { required: true });
        let redirected;
        try {
          redirected = new URL(location, current);
        } catch {
          throw permanentError("EPK_REDIRECT_INVALID", "EPK redirect location is invalid");
        }
        current = parseNetworkUrl(redirected.href, this.approvedOrigins);
        continue;
      }
      const allowedStatuses = options.allowedStatuses ?? new Set();
      if (!isSuccess(response.statusCode) && !allowedStatuses.has(response.statusCode)) {
        if (RETRYABLE_STATUSES.has(response.statusCode)) {
          throw retryableError(`EPK_HTTP_${response.statusCode}`, "EPK endpoint returned a retryable status");
        }
        throw permanentError(`EPK_HTTP_${response.statusCode}`, "EPK endpoint returned a non-success status");
      }
      if (!allowedStatuses.has(response.statusCode)) {
        const encoding = singleHeader(response.headers, "content-encoding");
        if (encoding && encoding.toLowerCase() !== "identity") {
          throw permanentError("EPK_CONTENT_ENCODING_INVALID", "EPK response compression is not allowed during verification");
        }
        assertContentType(response.headers, options.contentTypes);
      }
      return response;
    }
  }
}

export function requestPinnedHttps({ url, method, headers = {}, address, family, signal, maxHeaderBytes, maxBodyBytes }) {
  return new Promise((resolve, reject) => {
    const hostname = unbracket(url.hostname);
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };
    const requestOptions = {
      protocol: "https:",
      hostname,
      port: 443,
      path: `${url.pathname}${url.search}`,
      method,
      headers: {
        accept: method === "GET" ? "application/json, text/html;q=0.9, */*;q=0.1" : "*/*",
        "accept-encoding": "identity",
        connection: "close",
        "user-agent": "MarcsMusic-EPK-Verifier/1.0",
        ...headers
      },
      agent: false,
      signal,
      maxHeaderSize: maxHeaderBytes,
      rejectUnauthorized: true,
      lookup(_hostname, lookupOptions, callback) {
        if (lookupOptions?.all) callback(null, [{ address, family }]);
        else callback(null, address, family);
      }
    };
    if (!isIP(hostname)) requestOptions.servername = hostname;

    const outgoing = httpsRequest(requestOptions, (incoming) => {
      const chunks = [];
      let bytes = 0;
      incoming.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > maxBodyBytes) {
          incoming.destroy(Object.assign(new Error("EPK response body exceeds the byte limit"), { code: "EPK_BODY_TOO_LARGE" }));
          return;
        }
        chunks.push(chunk);
      });
      incoming.once("end", () => finish(resolve, Object.freeze({
        statusCode: Number(incoming.statusCode ?? 0),
        headers: normalizeRawHeaders(incoming.rawHeaders),
        body: Buffer.concat(chunks, bytes)
      })));
      incoming.once("error", (error) => finish(reject, error));
    });
    outgoing.once("error", (error) => finish(reject, error));
    outgoing.end();
  });
}

async function resolvePublicDestination(url, lookup, signal) {
  const hostname = unbracket(url.hostname);
  const family = isIP(hostname);
  let records;
  try {
    records = family ? [{ address: hostname, family }] : await awaitWithAbort(lookup(hostname, { all: true, verbatim: true }), signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    throw retryableError("EPK_DNS_LOOKUP_FAILED", "EPK DNS lookup failed", undefined, error);
  }
  const rawRecords = Array.isArray(records) ? records : [records];
  const normalized = rawRecords.map(normalizeAddress).filter(Boolean);
  if (!normalized.length) throw retryableError("EPK_DNS_EMPTY", "EPK hostname has no usable DNS records");
  if (normalized.length !== rawRecords.length) throw retryableError("EPK_DNS_RESPONSE_INVALID", "EPK DNS response is invalid");
  if (normalized.some((record) => !isPublicHttpAddress(record.address))) {
    throw permanentError("EPK_DESTINATION_DISALLOWED", "EPK hostname resolves to a non-public or reserved destination");
  }
  normalized.sort((left, right) => left.family - right.family || left.address.localeCompare(right.address));
  return normalized[0];
}

function parseNetworkUrl(value, approvedOrigins) {
  const raw = String(value ?? "");
  if (Buffer.byteLength(raw, "utf8") > URL_MAX_BYTES || raw.includes("\\")) {
    throw permanentError("EPK_NETWORK_URL_INVALID", "EPK network URL is invalid");
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw permanentError("EPK_NETWORK_URL_INVALID", "EPK network URL is invalid");
  }
  if (
    url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash ||
    !approvedOrigins.has(url.origin)
  ) {
    throw permanentError("EPK_NETWORK_URL_FORBIDDEN", "EPK network URL is not an approved HTTPS URL");
  }
  return url;
}

function validateResponseEnvelope(response, maxHeaderBytes, maxBodyBytes) {
  if (!response || !Number.isInteger(response.statusCode) || !isHeaderObject(response.headers) || !Buffer.isBuffer(response.body)) {
    throw retryableError("EPK_RESPONSE_INVALID", "EPK endpoint returned an invalid response");
  }
  const headerBytes = Object.entries(response.headers).reduce((total, [name, values]) => {
    const entries = Array.isArray(values) ? values : [values];
    return total + entries.reduce((sum, value) => sum + Buffer.byteLength(name) + Buffer.byteLength(String(value)) + 4, 0);
  }, 2);
  if (headerBytes > maxHeaderBytes) throw permanentError("EPK_HEADERS_TOO_LARGE", "EPK response headers exceed the byte limit");
  if (response.body.byteLength > maxBodyBytes) throw permanentError("EPK_BODY_TOO_LARGE", "EPK response body exceeds the byte limit");
  singleHeader(response.headers, "content-length");
  singleHeader(response.headers, "content-encoding");
}

function assertContentType(headers, allowed) {
  const value = singleHeader(headers, "content-type", { required: true }).split(";", 1)[0].trim().toLowerCase();
  if (!allowed.some((candidate) => candidate.endsWith("/") ? value.startsWith(candidate) : value === candidate)) {
    throw permanentError("EPK_CONTENT_TYPE_INVALID", "EPK response content type is invalid");
  }
}

function assetSize(response, { allowMissing }) {
  const contentRange = singleHeader(response.headers, "content-range");
  if (contentRange) {
    const match = contentRange.match(/^bytes\s+\d+-\d+\/(\d+)$/iu);
    if (!match) throw permanentError("EPK_ASSET_RANGE_INVALID", "EPK asset content range is invalid");
    return parsePositiveInteger(match[1], "EPK_ASSET_SIZE_INVALID");
  }
  const contentLength = singleHeader(response.headers, "content-length");
  if (contentLength) return parsePositiveInteger(contentLength, "EPK_ASSET_SIZE_INVALID");
  if (!allowMissing && response.statusCode === 200 && response.body.byteLength > 0) return response.body.byteLength;
  if (allowMissing) return undefined;
  throw permanentError("EPK_ASSET_SIZE_MISSING", "EPK asset size is missing");
}

function parsePositiveInteger(value, code) {
  if (!/^\d+$/u.test(value)) throw permanentError(code, "EPK asset size is invalid");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw permanentError(code, "EPK asset size is invalid");
  return parsed;
}

function singleHeader(headers, name, { required = false } = {}) {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  const value = entry?.[1];
  if (Array.isArray(value)) {
    if (value.length !== 1) throw permanentError("EPK_HEADER_AMBIGUOUS", "EPK response contains an ambiguous header");
    return String(value[0]);
  }
  if (value === undefined || value === null || value === "") {
    if (required) throw permanentError("EPK_HEADER_MISSING", "EPK response is missing a required header");
    return undefined;
  }
  return String(value);
}

function normalizeRawHeaders(rawHeaders) {
  const headers = Object.create(null);
  for (let index = 0; index < rawHeaders.length; index += 2) {
    const name = String(rawHeaders[index]).toLowerCase();
    const value = String(rawHeaders[index + 1] ?? "");
    headers[name] = headers[name] === undefined ? value : [...(Array.isArray(headers[name]) ? headers[name] : [headers[name]]), value];
  }
  return Object.freeze(headers);
}

function normalizeAddress(record) {
  const address = typeof record === "string" ? record : record?.address;
  const family = isIP(String(address ?? ""));
  return family ? Object.freeze({ address: String(address), family }) : undefined;
}

function classifyTransportError(error, signal) {
  if (error instanceof ApplicationError) return error;
  if (signal?.aborted) return retryableError("EPK_REQUEST_ABORTED", "EPK request was aborted", undefined, error);
  if (TLS_FAILURE_CODES.has(error?.code)) return permanentError("EPK_TLS_INVALID", "EPK TLS validation failed", undefined, error);
  if (error?.code === "HPE_HEADER_OVERFLOW") return permanentError("EPK_HEADERS_TOO_LARGE", "EPK response headers exceed the byte limit", undefined, error);
  if (error?.code === "EPK_BODY_TOO_LARGE") return permanentError("EPK_BODY_TOO_LARGE", "EPK response body exceeds the byte limit", undefined, error);
  return retryableError("EPK_NETWORK_ERROR", "EPK endpoint could not be reached", undefined, error);
}

function parseJson(body, code) {
  try {
    return JSON.parse(body.toString("utf8"));
  } catch (error) {
    throw permanentError(code, "EPK endpoint returned invalid JSON", undefined, error);
  }
}

function isSuccess(statusCode) {
  return statusCode >= 200 && statusCode < 300;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function isHeaderObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function unbracket(value) {
  const text = String(value);
  return text.startsWith("[") && text.endsWith("]") ? text.slice(1, -1) : text;
}

function awaitWithAbort(promise, signal) {
  if (!signal) return Promise.resolve(promise);
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

function retryableError(code, message, details, cause) {
  return new ApplicationError(message, { code, statusCode: 503, retryable: true, details, cause });
}
