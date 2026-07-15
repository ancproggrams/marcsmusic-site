import assert from "node:assert/strict";
import test from "node:test";

import { ConfigurationError, loadConfig } from "../src/config.mjs";
import { CryptoBox } from "../src/infrastructure/crypto-box.mjs";

const oldKey = Buffer.alloc(32, 3);
const activeKey = Buffer.alloc(32, 7);

test("CryptoBox decrypts historical versions while encrypting only with the active key", () => {
  const oldBox = new CryptoBox({
    encryptionKey: oldKey,
    keyVersion: "v1",
    hashKey: "key-rotation-hash-key-with-at-least-32-characters"
  });
  const rotatingBox = new CryptoBox({
    encryptionKey: activeKey,
    keyVersion: "v2",
    decryptionKeys: { v1: oldKey },
    hashKey: "key-rotation-hash-key-with-at-least-32-characters"
  });
  const value = { contactId: "contact-1", body: "encrypted evidence" };
  const historical = oldBox.encryptJson(value, "event:event-1");

  assert.equal(historical.keyVersion, "v1");
  assert.deepEqual(rotatingBox.decryptJson(historical, "event:event-1"), value);
  const reencrypted = rotatingBox.reencryptJson(historical, "event:event-1");
  assert.equal(reencrypted.keyVersion, "v2");
  assert.deepEqual(rotatingBox.decryptJson(reencrypted, "event:event-1"), value);
  assert.throws(
    () => oldBox.decryptJson(reencrypted, "event:event-1"),
    (error) => error.code === "ENCRYPTION_KEY_VERSION_UNSUPPORTED"
  );
});

test("CryptoBox rejects unknown and conflicting key versions", () => {
  const box = new CryptoBox({
    encryptionKey: activeKey,
    keyVersion: "v2",
    decryptionKeys: { v1: oldKey },
    hashKey: "key-rotation-hash-key-with-at-least-32-characters"
  });
  const encrypted = box.encryptJson({ ok: true }, "rotation:test");
  assert.throws(
    () => box.decryptJson({ ...encrypted, keyVersion: "unknown" }, "rotation:test"),
    (error) => error.code === "ENCRYPTION_KEY_VERSION_UNSUPPORTED"
  );
  assert.throws(
    () => new CryptoBox({
      encryptionKey: activeKey,
      keyVersion: "v2",
      decryptionKeys: { v2: oldKey },
      hashKey: "key-rotation-hash-key-with-at-least-32-characters"
    }),
    /must not redefine the active key version/u
  );
});

test("configuration loads a bounded decrypt-only keyring", () => {
  const config = loadConfig({
    ...validEnvironment(),
    OUTREACH_DATA_KEY_VERSION: "v2",
    OUTREACH_DATA_ENCRYPTION_KEY: activeKey.toString("base64"),
    OUTREACH_DATA_DECRYPTION_KEYS_JSON: JSON.stringify({ v1: oldKey.toString("base64") })
  });

  assert.equal(config.crypto.keyVersion, "v2");
  assert.deepEqual(config.crypto.encryptionKey, activeKey);
  assert.deepEqual(config.crypto.decryptionKeys.v1, oldKey);
  assert.equal(config.crypto.unsubscribeSigning.active.kid, "unsub-test-2026-07");
  assert.equal(config.crypto.unsubscribeSigning.legacyV1VerifyKey, undefined);
});

test("configuration rejects malformed, oversized and active-version keyrings", () => {
  for (const historicalKeys of [
    "not-json",
    "[]",
    JSON.stringify({ v2: oldKey.toString("base64") }),
    JSON.stringify({ "unsafe/version": oldKey.toString("base64") }),
    JSON.stringify({ v1: "not-base64" }),
    JSON.stringify(Object.fromEntries(Array.from({ length: 11 }, (_, index) => [`v${index}`, oldKey.toString("base64")])))
  ]) {
    assert.throws(
      () => loadConfig({
        ...validEnvironment(),
        OUTREACH_DATA_KEY_VERSION: "v2",
        OUTREACH_DATA_ENCRYPTION_KEY: activeKey.toString("base64"),
        OUTREACH_DATA_DECRYPTION_KEYS_JSON: historicalKeys
      }),
      (error) => error instanceof ConfigurationError,
      historicalKeys
    );
  }
});

test("configuration enforces strict bounded v2 unsubscribe and per-source keyrings", () => {
  const config = loadConfig({
    ...validEnvironment(),
    SOURCE_INGESTION_ENABLED: "true",
    SOURCE_INGESTION_KEYRINGS_JSON: JSON.stringify(sourceKeyrings())
  });
  assert.equal(config.sourceIngestion.keyrings["dj-finder"].active.kid, "dj-test-2026-07");
  assert.equal(config.sourceIngestion.keyrings["dj-finder"].verifyOnly[0].kid, "dj-test-2026-06");

  for (const override of [
    { OUTREACH_UNSUBSCRIBE_KEYRING_JSON: JSON.stringify({ ...unsubscribeKeyring(), schemaVersion: 1 }) },
    { OUTREACH_UNSUBSCRIBE_KEYRING_JSON: JSON.stringify({ ...unsubscribeKeyring(), unexpected: true }) },
    { OUTREACH_UNSUBSCRIBE_KEYRING_JSON: JSON.stringify({
      ...unsubscribeKeyring(),
      verifyOnly: [{ ...unsubscribeKeyring().active }]
    }) },
    { OUTREACH_UNSUBSCRIBE_KEYRING_JSON: JSON.stringify({
      ...unsubscribeKeyring(),
      verifyOnly: Array.from({ length: 6 }, (_, index) => ({
        kid: `unsub-old-${index}`,
        key: `unsubscribe-historical-${index}-key-for-tests-at-least-32-characters`
      }))
    }) },
    { SOURCE_INGESTION_ENABLED: "true", SOURCE_INGESTION_KEYRINGS_JSON: JSON.stringify({
      ...sourceKeyrings(),
      unexpected: true
    }) },
    { SOURCE_INGESTION_ENABLED: "true", SOURCE_INGESTION_KEYRINGS_JSON: JSON.stringify({
      schemaVersion: 2,
      sources: {
        ...sourceKeyrings().sources,
        unknown: { active: { kid: "unknown", key: "unknown-source-key-with-at-least-32-characters" }, verifyOnly: [] }
      }
    }) },
    { SOURCE_INGESTION_ENABLED: "true", SOURCE_INGESTION_KEYRINGS_JSON: JSON.stringify({
      schemaVersion: 2,
      sources: {
        ...sourceKeyrings().sources,
        "music-submission-agent": {
          active: {
            kid: "msa-test-2026-07",
            key: sourceKeyrings().sources["dj-finder"].active.key
          },
          verifyOnly: []
        }
      }
    }) }
  ]) {
    assert.throws(() => loadConfig({ ...validEnvironment(), ...override }), (error) => error instanceof ConfigurationError);
  }
});

test("legacy unsubscribe verification key is explicit, bounded and independent", () => {
  const legacyKey = "legacy-unsubscribe-key-for-tests-at-least-32-characters";
  const legacyUntil = new Date(Date.now() + 86_400_000).toISOString();
  const config = loadConfig({
    ...validEnvironment(),
    OUTREACH_UNSUBSCRIBE_LEGACY_V1_VERIFY_KEY: legacyKey,
    OUTREACH_UNSUBSCRIBE_LEGACY_V1_VERIFY_UNTIL: legacyUntil
  });
  assert.equal(config.crypto.unsubscribeSigning.legacyV1VerifyKey, legacyKey);
  assert.equal(config.crypto.unsubscribeSigning.legacyV1VerifyUntil, legacyUntil);
  assert.throws(() => loadConfig({
    ...validEnvironment(),
    OUTREACH_UNSUBSCRIBE_LEGACY_V1_VERIFY_KEY: unsubscribeKeyring().active.key,
    OUTREACH_UNSUBSCRIBE_LEGACY_V1_VERIFY_UNTIL: legacyUntil
  }), (error) => error instanceof ConfigurationError);
  assert.throws(() => loadConfig({
    ...validEnvironment(),
    OUTREACH_UNSUBSCRIBE_LEGACY_V1_VERIFY_KEY: legacyKey
  }), (error) => error instanceof ConfigurationError);
});

function validEnvironment() {
  return {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://user:password@localhost:5432/outreach",
    ESPOCRM_BASE_URL: "https://crm.example.test",
    ESPOCRM_API_KEY: "espo-api-key-for-tests",
    MAILGUN_API_KEY: "mailgun-test-key",
    MAILGUN_DOMAIN: "mail.example.test",
    MAILGUN_FROM: "MarcsMusic <music@example.test>",
    MAILGUN_REPLY_TO: "music@example.test",
    MAILGUN_WEBHOOK_SIGNING_KEY: "mailgun-signing-key-for-tests",
    OUTREACH_PUBLIC_BASE_URL: "https://outreach.example.test",
    OUTREACH_DATA_ENCRYPTION_KEY: activeKey.toString("base64"),
    OUTREACH_HASH_KEY: "privacy-hash-key-for-tests-at-least-32-characters",
    OUTREACH_UNSUBSCRIBE_KEYRING_JSON: JSON.stringify(unsubscribeKeyring()),
    METRICS_TOKEN: "metrics-token-for-tests-at-least-24"
  };
}

function unsubscribeKeyring() {
  return {
    schemaVersion: 2,
    active: { kid: "unsub-test-2026-07", key: "unsubscribe-key-for-tests-at-least-32-characters" },
    verifyOnly: []
  };
}

function sourceKeyrings() {
  return {
    schemaVersion: 2,
    sources: {
      "dj-finder": {
        active: { kid: "dj-test-2026-07", key: "dj-active-source-key-for-tests-at-least-32-characters" },
        verifyOnly: [{ kid: "dj-test-2026-06", key: "dj-historical-source-key-for-tests-at-least-32-characters" }]
      }
    }
  };
}
