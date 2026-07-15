const TRACKING_QUERY_KEYS = new Set(["fbclid", "gclid", "msclkid"]);
const RAW_UNSAFE_CHARACTERS = /[\s\u0000-\u001f\u007f-\u009f\\]/u;
const DECODED_CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const INVALID_PERCENT_ESCAPE = /%(?![0-9a-f]{2})/iu;

// This service is deployed from an independent Railway root. Keep this
// implementation aligned with the worker through source-url-conformance-v1.json.
export function canonicalizeSourceHttpsUrl(value) {
  if (typeof value !== "string" || !value) invalid("A non-empty URL string is required");
  if (value.length > 512) invalid("Source URLs may contain at most 512 characters");
  if (!/^https:\/\//iu.test(value)) invalid("An absolute HTTPS URL with authority is required");
  if (typeof value.isWellFormed === "function" && !value.isWellFormed()) {
    invalid("The URL contains malformed Unicode");
  }
  if (RAW_UNSAFE_CHARACTERS.test(value)) invalid("Whitespace, controls and backslashes must be encoded safely");
  if (value.includes("#")) invalid("Fragments are not accepted on source URLs");
  if (INVALID_PERCENT_ESCAPE.test(value)) invalid("The URL contains a malformed percent escape");

  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    invalid("The URL contains an invalid UTF-8 percent encoding");
  }
  if (DECODED_CONTROL_CHARACTERS.test(decoded)) invalid("Encoded control characters are not accepted");

  let url;
  try {
    url = new URL(value);
  } catch {
    invalid("The URL is not absolute");
  }
  if (url.protocol !== "https:") invalid("HTTPS is required");
  if (url.username || url.password || rawAuthority(value).includes("@")) {
    invalid("Credentials are not accepted on source URLs");
  }
  if (!url.hostname) invalid("A hostname is required");

  const hostname = url.hostname.toLowerCase().replace(/\.+$/u, "");
  if (!hostname) invalid("A hostname is required");
  url.hostname = hostname;
  if (url.port === "443") url.port = "";
  url.pathname = uppercasePercentEscapes(url.pathname);

  const retained = [];
  let position = 0;
  for (const [key, queryValue] of url.searchParams) {
    if (!isTrackingQueryKey(key)) retained.push({ key, value: queryValue, position });
    position += 1;
  }
  retained.sort((left, right) => (
    compareCodeUnits(left.key, right.key)
      || compareCodeUnits(left.value, right.value)
      || left.position - right.position
  ));
  url.search = "";
  for (const { key, value: queryValue } of retained) url.searchParams.append(key, queryValue);

  const canonical = url.toString();
  if (canonical.length > 512) invalid("Canonical source URLs may contain at most 512 characters");
  return canonical;
}

function isTrackingQueryKey(value) {
  const key = value.toLowerCase();
  return key.startsWith("utm_") || TRACKING_QUERY_KEYS.has(key);
}

function uppercasePercentEscapes(value) {
  return value.replace(/%[0-9a-f]{2}/giu, (escape) => escape.toUpperCase());
}

function rawAuthority(value) {
  const separator = value.indexOf("://");
  return value.slice(separator + 3).split(/[/?]/u, 1)[0];
}

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function invalid(reason) {
  const error = new TypeError("Source URL cannot be canonicalized");
  error.code = "SOURCE_HTTPS_URL_INVALID";
  error.reason = reason;
  throw error;
}
