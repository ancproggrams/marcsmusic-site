import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_SECONDS = 3_600;
const MAX_TTL_SECONDS = 86_400;
const MIN_SECRET_BYTES = 32;
const MAX_SECRET_BYTES = 256;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

export class AssetUrlSigner {
  constructor(options = {}) {
    const env = options.env ?? process.env;
    const secret = options.secret ?? env.MUSIC_ASSET_SIGNING_KEY;
    this.secret = validSecret(secret) ? Buffer.from(secret, "utf8") : undefined;
    this.defaultTtlSeconds = boundedInteger(
      options.defaultTtlSeconds ?? env.MUSIC_ASSET_URL_TTL_SECONDS,
      DEFAULT_TTL_SECONDS,
      60,
      MAX_TTL_SECONDS,
      { statusCode: 503, code: "ASSET_SIGNING_CONFIG_INVALID" }
    );
    this.maximumTtlSeconds = boundedInteger(
      options.maximumTtlSeconds ?? env.MUSIC_ASSET_URL_MAX_TTL_SECONDS,
      MAX_TTL_SECONDS,
      this.defaultTtlSeconds,
      MAX_TTL_SECONDS,
      { statusCode: 503, code: "ASSET_SIGNING_CONFIG_INVALID" }
    );
    this.now = options.now ?? Date.now;
  }

  get configured() {
    return Boolean(this.secret);
  }

  signPath(pathname, options = {}) {
    this.assertConfigured();
    const canonicalPath = normalizeAssetPath(pathname);
    const ttlSeconds = boundedInteger(
      options.ttlSeconds,
      this.defaultTtlSeconds,
      1,
      this.maximumTtlSeconds,
      { statusCode: 400, code: "ASSET_URL_TTL_INVALID" }
    );
    const expires = Math.floor(this.now() / 1_000) + ttlSeconds;
    const signature = this.signature(canonicalPath, expires);
    return `${canonicalPath}?expires=${expires}&signature=${signature}`;
  }

  verifyRequest({ method, pathname, searchParams }) {
    if (!this.secret || method !== "GET") return false;

    let canonicalPath;
    try {
      canonicalPath = normalizeAssetPath(pathname);
    } catch {
      return false;
    }

    const keys = [...searchParams.keys()];
    if (keys.length !== 2 || keys.filter((key) => key === "expires").length !== 1 || keys.filter((key) => key === "signature").length !== 1) {
      return false;
    }
    const expiresText = searchParams.get("expires") ?? "";
    const signature = searchParams.get("signature") ?? "";
    if (!/^[0-9]{1,12}$/u.test(expiresText) || !SIGNATURE_PATTERN.test(signature)) return false;

    const expires = Number(expiresText);
    const nowSeconds = Math.floor(this.now() / 1_000);
    if (!Number.isSafeInteger(expires) || expires <= nowSeconds || expires > nowSeconds + this.maximumTtlSeconds) {
      return false;
    }

    const expected = this.signature(canonicalPath, expires);
    return timingSafeEqual(Buffer.from(signature, "ascii"), Buffer.from(expected, "ascii"));
  }

  assertConfigured() {
    if (!this.secret) {
      throw Object.assign(new Error("Private asset URL signing is not configured safely."), {
        statusCode: 503,
        code: "ASSET_SIGNING_NOT_CONFIGURED"
      });
    }
  }

  signature(pathname, expires) {
    return createHmac("sha256", this.secret)
      .update(`release-os-asset-v1\nGET\n${pathname}\n${expires}`, "utf8")
      .digest("base64url");
  }
}

function normalizeAssetPath(value) {
  if (typeof value !== "string" || !value.startsWith("/assets/")) throw new TypeError("asset path is invalid");
  const parsed = new URL(value, "https://release-assets.invalid");
  if (
    parsed.origin !== "https://release-assets.invalid" ||
    parsed.search ||
    parsed.hash ||
    !/^\/assets\/(?:audio|artwork)\/[^/]+$/u.test(parsed.pathname)
  ) {
    throw new TypeError("asset path is invalid");
  }
  return parsed.pathname;
}

function validSecret(value) {
  return (
    typeof value === "string" &&
    Buffer.byteLength(value, "utf8") >= MIN_SECRET_BYTES &&
    Buffer.byteLength(value, "utf8") <= MAX_SECRET_BYTES &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function boundedInteger(value, fallback, minimum, maximum, errorDetails) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw Object.assign(new Error("Private asset URL lifetime is outside its allowed bound."), {
      statusCode: errorDetails.statusCode,
      code: errorDetails.code
    });
  }
  return parsed;
}
