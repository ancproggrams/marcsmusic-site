import { createHmac } from "node:crypto";
import { hmacHex, safeEqualText } from "../infrastructure/crypto-box.mjs";

export function verifyEspoWebhook({ rawBody, signature, secrets }) {
  if (!signature) return Object.freeze({ valid: false, reason: "signature_missing" });
  if (typeof signature !== "string" || signature.length > 512 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(signature)) {
    return Object.freeze({ valid: false, reason: "signature_invalid_encoding" });
  }
  let decoded;
  try {
    decoded = Buffer.from(signature, "base64").toString("utf8");
  } catch {
    return Object.freeze({ valid: false, reason: "signature_invalid_encoding" });
  }
  const separator = decoded.indexOf(":");
  if (separator <= 0) return Object.freeze({ valid: false, reason: "signature_invalid_shape" });
  const webhookId = decoded.slice(0, separator);
  const suppliedDigest = decoded.slice(separator + 1);
  if (!/^[A-Za-z0-9._:-]{1,128}$/u.test(webhookId) || !/^[0-9a-f]{64}$/u.test(suppliedDigest)) {
    return Object.freeze({ valid: false, reason: "signature_invalid_shape" });
  }
  const secret = Object.hasOwn(secrets, webhookId) ? secrets[webhookId] : undefined;
  if (!secret) return Object.freeze({ valid: false, reason: "webhook_unknown" });
  const expectedDigest = hmacHex(secret, rawBody);
  const valid = safeEqualText(suppliedDigest, expectedDigest);
  return Object.freeze({ valid, webhookId, reason: valid ? undefined : "signature_mismatch" });
}

export function verifyMailgunWebhook({ timestamp, token, signature, signingKey, now = Date.now(), toleranceSeconds = 900 }) {
  const timestampText = String(timestamp ?? "");
  const tokenText = String(token ?? "");
  const signatureText = String(signature ?? "").toLowerCase();
  const seconds = Number(timestampText);
  if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > toleranceSeconds) {
    return Object.freeze({ valid: false, reason: "timestamp_outside_tolerance" });
  }
  if (!token || !signature) return Object.freeze({ valid: false, reason: "signature_fields_missing" });
  if (
    !/^\d{9,12}$/u.test(timestampText) ||
    !/^[A-Za-z0-9._:-]{8,256}$/u.test(tokenText) ||
    !/^[0-9a-f]{64}$/u.test(signatureText)
  ) {
    return Object.freeze({ valid: false, reason: "signature_mismatch" });
  }
  const expected = createHmac("sha256", signingKey).update(`${timestampText}${tokenText}`).digest("hex");
  const valid = safeEqualText(signatureText, expected);
  return Object.freeze({ valid, reason: valid ? undefined : "signature_mismatch" });
}
