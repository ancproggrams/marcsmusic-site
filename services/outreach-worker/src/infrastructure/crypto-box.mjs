import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export class CryptoBox {
  constructor({ encryptionKey, keyVersion, decryptionKeys = {}, hashKey, hashKeyEpoch = "v1" }) {
    if (!Buffer.isBuffer(encryptionKey) || encryptionKey.length !== 32) {
      throw new TypeError("encryptionKey must be a 32-byte Buffer");
    }
    if (typeof keyVersion !== "string" || !/^[A-Za-z0-9._-]{1,32}$/u.test(keyVersion)) {
      throw new TypeError("keyVersion must contain 1-32 safe identifier characters");
    }
    if (!decryptionKeys || Array.isArray(decryptionKeys) || typeof decryptionKeys !== "object") {
      throw new TypeError("decryptionKeys must be an object keyed by key version");
    }
    if (Object.hasOwn(decryptionKeys, keyVersion)) {
      throw new TypeError("decryptionKeys must not redefine the active key version");
    }
    this.encryptionKey = Buffer.from(encryptionKey);
    this.keyVersion = keyVersion;
    this.decryptionKeys = new Map([[keyVersion, this.encryptionKey]]);
    for (const [version, key] of Object.entries(decryptionKeys)) {
      if (typeof version !== "string" || !/^[A-Za-z0-9._-]{1,32}$/u.test(version)) {
        throw new TypeError("decryption key versions must contain 1-32 safe identifier characters");
      }
      if (!Buffer.isBuffer(key) || key.length !== 32) {
        throw new TypeError(`decryption key ${version} must be a 32-byte Buffer`);
      }
      this.decryptionKeys.set(version, Buffer.from(key));
    }
    this.hashKey = String(hashKey);
    if (!/^[A-Za-z0-9._-]{1,32}$/u.test(String(hashKeyEpoch))) {
      throw new TypeError("hashKeyEpoch must contain 1-32 safe identifier characters");
    }
    this.hashKeyEpoch = String(hashKeyEpoch);
    this.subjectHashVersion = "hmac-sha256-subject-v1";
    this.integrityVersion = "hmac-sha256-exact-v1";
  }

  encryptJson(value, associatedData = "") {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
    cipher.setAAD(Buffer.from(String(associatedData), "utf8"));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return Object.freeze({
      ciphertext,
      iv,
      tag: cipher.getAuthTag(),
      keyVersion: this.keyVersion
    });
  }

  decryptJson(record, associatedData = "") {
    const decryptionKey = this.decryptionKeys.get(record.keyVersion);
    if (!decryptionKey) {
      throw Object.assign(new Error(`Unsupported key version: ${record.keyVersion}`), { code: "ENCRYPTION_KEY_VERSION_UNSUPPORTED" });
    }
    const decipher = createDecipheriv("aes-256-gcm", decryptionKey, Buffer.from(record.iv));
    decipher.setAAD(Buffer.from(String(associatedData), "utf8"));
    decipher.setAuthTag(Buffer.from(record.tag));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(record.ciphertext)), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8"));
  }

  reencryptJson(record, associatedData = "") {
    return this.encryptJson(this.decryptJson(record, associatedData), associatedData);
  }

  privacyHash(value) {
    return this.subjectHash(value);
  }

  subjectHash(value) {
    return createHmac("sha256", this.hashKey)
      .update(normalizeHashInput(value), "utf8")
      .digest("hex");
  }

  integrityHash(value) {
    const input = Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ""), "utf8");
    return createHmac("sha256", this.hashKey)
      .update("privacy-integrity:v1\0", "utf8")
      .update(input)
      .digest("hex");
  }

  integrityMac(value) {
    return Object.freeze({
      digest: this.integrityHash(value),
      version: this.integrityVersion
    });
  }

  hashKeyAttestation(bootstrapReference) {
    const fingerprint = createHmac("sha256", this.hashKey)
      .update("outreach-hash-key-fingerprint:v1\0", "utf8")
      .update(this.hashKeyEpoch, "utf8")
      .update("\0", "utf8")
      .update(this.subjectHashVersion, "utf8")
      .digest("hex");
    const reference = String(bootstrapReference ?? "");
    const mac = createHmac("sha256", this.hashKey)
      .update("outreach-hash-key-attestation:v1\0", "utf8")
      .update(this.hashKeyEpoch, "utf8")
      .update("\0", "utf8")
      .update(this.subjectHashVersion, "utf8")
      .update("\0", "utf8")
      .update(this.integrityVersion, "utf8")
      .update("\0", "utf8")
      .update(fingerprint, "utf8")
      .update("\0", "utf8")
      .update(reference, "utf8")
      .digest("hex");
    return Object.freeze({
      hashEpoch: this.hashKeyEpoch,
      subjectHashVersion: this.subjectHashVersion,
      integrityHashVersion: this.integrityVersion,
      keyFingerprint: fingerprint,
      attestationMac: mac
    });
  }
}

export function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

export function safeEqualText(actual, expected) {
  const actualDigest = createHash("sha256").update(String(actual)).digest();
  const expectedDigest = createHash("sha256").update(String(expected)).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

export function hmacHex(secret, value) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function normalizeHashInput(value) {
  return String(value ?? "").trim().toLowerCase();
}
