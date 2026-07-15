import { createHmac } from "node:crypto";
import { safeEqualText } from "../infrastructure/crypto-box.mjs";

const TOKEN_VERSION = "v2";
const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/u;
const ENTITY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/u;
const MAX_PAYLOAD_LENGTH = 2_048;
const MAX_CLOCK_SKEW_SECONDS = 300;

export function createUnsubscribeToken({ contactId, matchId, keyring, expiresAt, issuedAt = new Date() }) {
  const active = assertKeyring(keyring).active;
  const issued = validEpochSeconds(issuedAt, "issuedAt");
  const expires = validEpochSeconds(expiresAt, "expiresAt");
  const maximumExpiry = addUtcYears(new Date(issued * 1_000), 2).getTime() / 1_000;
  if (expires <= issued || expires > maximumExpiry) throw new RangeError("Unsubscribe token expiry must be within two years");
  const payloadData = Object.freeze({
    v: 2,
    kid: active.kid,
    contactId: validEntityId(contactId, "contactId"),
    matchId: validEntityId(matchId, "matchId"),
    iat: issued,
    exp: expires
  });
  const payload = Buffer.from(JSON.stringify(payloadData)).toString("base64url");
  const signingInput = `${TOKEN_VERSION}.${active.kid}.${payload}`;
  const signature = createHmac("sha256", active.key).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

export function verifyUnsubscribeToken(token, keyring, now = Date.now()) {
  const configured = assertKeyring(keyring, false);
  const segments = String(token ?? "").split(".");
  if (segments.length === 2) return verifyLegacyV1(segments, configured, now);
  if (segments.length !== 4) return invalid("token_invalid_shape");
  const [version, kid, payload, signature] = segments;
  if (version !== TOKEN_VERSION) return invalid("token_version_unsupported");
  if (!KEY_ID_PATTERN.test(kid)) return invalid("token_key_id_invalid");
  if (!payload || payload.length > MAX_PAYLOAD_LENGTH || !/^[A-Za-z0-9_-]+$/u.test(payload)) return invalid("token_payload_invalid");
  if (!/^[A-Za-z0-9_-]{43}$/u.test(signature)) return invalid("token_signature_invalid");
  const signingKey = signingKeyFor(configured, kid);
  if (!signingKey) return invalid("token_key_id_unknown");
  const expected = createHmac("sha256", signingKey).update(`${version}.${kid}.${payload}`).digest("base64url");
  if (!safeEqualText(signature, expected)) return invalid("token_signature_invalid");
  const data = decodePayload(payload);
  if (!isExactObject(data, ["contactId", "exp", "iat", "kid", "matchId", "v"])) return invalid("token_payload_invalid");
  if (data.v !== 2 || data.kid !== kid || !validTokenEntityId(data.contactId) || !validTokenEntityId(data.matchId)) {
    return invalid("token_payload_invalid");
  }
  if (!Number.isSafeInteger(data.iat) || !Number.isSafeInteger(data.exp)) return invalid("token_expired_or_incomplete");
  const nowMilliseconds = validNow(now);
  const issuedMilliseconds = data.iat * 1_000;
  const expiresMilliseconds = data.exp * 1_000;
  if (
    issuedMilliseconds > nowMilliseconds + MAX_CLOCK_SKEW_SECONDS * 1_000
    || expiresMilliseconds <= nowMilliseconds
    || expiresMilliseconds <= issuedMilliseconds
    || expiresMilliseconds > addUtcYears(new Date(issuedMilliseconds), 2).getTime()
  ) {
    return invalid("token_expired_or_incomplete");
  }
  return Object.freeze({ valid: true, data: Object.freeze(data), version: 2, kid });
}

function verifyLegacyV1([payload, signature], keyring, now) {
  if (!keyring.legacyV1VerifyKey || !keyring.legacyV1VerifyUntil) return invalid("token_version_unsupported");
  if (!payload || payload.length > MAX_PAYLOAD_LENGTH || !/^[A-Za-z0-9_-]+$/u.test(payload)) return invalid("token_payload_invalid");
  if (!/^[A-Za-z0-9_-]{43}$/u.test(signature)) return invalid("token_signature_invalid");
  const expected = createHmac("sha256", keyring.legacyV1VerifyKey).update(payload).digest("base64url");
  if (!safeEqualText(signature, expected)) return invalid("token_signature_invalid");
  const data = decodePayload(payload);
  if (!isExactObject(data, ["contactId", "exp", "matchId"])) return invalid("token_payload_invalid");
  if (!validTokenEntityId(data.contactId) || !validTokenEntityId(data.matchId) || !Number.isSafeInteger(data.exp)) {
    return invalid("token_expired_or_incomplete");
  }
  const nowMilliseconds = validNow(now);
  if (nowMilliseconds > Date.parse(keyring.legacyV1VerifyUntil)) return invalid("token_version_unsupported");
  const expiresMilliseconds = data.exp * 1_000;
  if (expiresMilliseconds <= nowMilliseconds || expiresMilliseconds > addUtcYears(new Date(nowMilliseconds), 2).getTime()) {
    return invalid("token_expired_or_incomplete");
  }
  return Object.freeze({ valid: true, data: Object.freeze(data), version: 1, kid: "legacy-v1" });
}

function assertKeyring(value, throws = true) {
  const active = value?.active;
  const historical = value?.verifyOnly;
  const entries = Array.isArray(historical) ? [active, ...historical] : [];
  const kids = new Set();
  const keys = new Set();
  const valid = value?.schemaVersion === 2
    && validSigningKey(active)
    && Array.isArray(historical)
    && historical.length <= 5
    && entries.every((entry) => {
      if (!validSigningKey(entry) || kids.has(entry.kid) || keys.has(entry.key)) return false;
      kids.add(entry.kid);
      keys.add(entry.key);
      return true;
    })
    && (value.legacyV1VerifyKey === undefined
      || (typeof value.legacyV1VerifyKey === "string"
        && value.legacyV1VerifyKey.length >= 32
        && value.legacyV1VerifyKey.length <= 512
        && !keys.has(value.legacyV1VerifyKey)))
    && (value.legacyV1VerifyKey === undefined
      ? value.legacyV1VerifyUntil === undefined
      : typeof value.legacyV1VerifyUntil === "string" && Number.isFinite(Date.parse(value.legacyV1VerifyUntil)));
  if (!valid && throws) throw new TypeError("A version 2 unsubscribe signing keyring is required");
  return valid ? value : Object.freeze({ schemaVersion: 2, active: {}, verifyOnly: [] });
}

function validSigningKey(value) {
  return Boolean(value)
    && !Array.isArray(value)
    && typeof value === "object"
    && KEY_ID_PATTERN.test(value.kid ?? "")
    && typeof value.key === "string"
    && value.key.length >= 32
    && value.key.length <= 512;
}

function signingKeyFor(keyring, kid) {
  if (keyring.active.kid === kid) return keyring.active.key;
  return keyring.verifyOnly.find((entry) => entry?.kid === kid)?.key;
}

function decodePayload(payload) {
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}

function isExactObject(value, keys) {
  if (!value || Array.isArray(value) || typeof value !== "object") return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validTokenEntityId(value) {
  return typeof value === "string" && ENTITY_ID_PATTERN.test(value);
}

function validEntityId(value, field) {
  if (!validTokenEntityId(value)) throw new TypeError(`${field} is invalid`);
  return value;
}

function validEpochSeconds(value, field) {
  const milliseconds = new Date(value).getTime();
  if (!Number.isFinite(milliseconds)) throw new TypeError(`${field} is invalid`);
  return Math.floor(milliseconds / 1_000);
}

function validNow(value) {
  const milliseconds = value instanceof Date ? value.getTime() : Number(value);
  return Number.isFinite(milliseconds) ? milliseconds : Date.now();
}

function addUtcYears(value, years) {
  const result = new Date(value);
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

function invalid(reason) {
  return Object.freeze({ valid: false, reason });
}
