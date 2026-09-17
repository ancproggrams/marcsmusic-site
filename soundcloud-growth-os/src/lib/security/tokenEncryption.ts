import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENVELOPE_VERSION = "scg1";
const ENVELOPE_PREFIX = `${ENVELOPE_VERSION}.`;
const RESERVED_PREFIX = "scg";
const MAX_KEYRING_JSON_BYTES = 2_048;
const MAX_KEYS = 5;
const MAX_KID_BYTES = 32;
const MAX_ARTIST_ID_BYTES = 256;
const MAX_TOKEN_BYTES = 8_192;
const MAX_ENVELOPE_BYTES = 16_384;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const KID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/u;
const BASE64_KEY_PATTERN = /^[A-Za-z0-9+/]{43}=$/u;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;

type Env = Record<string, string | undefined>;

export type SoundCloudTokenField = "accessToken" | "refreshToken";

export type SoundCloudTokenContext = {
  artistId: string;
  field: SoundCloudTokenField;
};

type Keyring = {
  activeKid: string;
  keys: ReadonlyMap<string, Buffer>;
  allowLegacyPlaintextMigration: boolean;
};

export type DecryptedSoundCloudToken = {
  value: string;
  kid: string | null;
  legacyPlaintext: boolean;
  requiresReencryption: boolean;
};

export class TokenEncryptionConfigurationError extends Error {
  constructor() {
    super("SoundCloud token encryption is not configured securely.");
    this.name = "TokenEncryptionConfigurationError";
  }
}

export class TokenDecryptionError extends Error {
  constructor() {
    super("Stored SoundCloud credentials could not be decrypted.");
    this.name = "TokenDecryptionError";
  }
}

function byteLength(value: string) {
  return Buffer.byteLength(value, "utf8");
}

function validateContext(context: SoundCloudTokenContext) {
  if (
    !context.artistId ||
    byteLength(context.artistId) > MAX_ARTIST_ID_BYTES ||
    /[\u0000-\u001f\u007f]/u.test(context.artistId) ||
    (context.field !== "accessToken" && context.field !== "refreshToken")
  ) {
    throw new TokenDecryptionError();
  }
}

function parseKeyring(env: Env): Keyring {
  const activeKid = env.SOUNDCLOUD_TOKEN_ACTIVE_KID;
  const serialized = env.SOUNDCLOUD_TOKEN_KEYS_JSON;

  if (
    !activeKid ||
    !KID_PATTERN.test(activeKid) ||
    byteLength(activeKid) > MAX_KID_BYTES ||
    !serialized ||
    byteLength(serialized) > MAX_KEYRING_JSON_BYTES
  ) {
    throw new TokenEncryptionConfigurationError();
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(serialized);
  } catch {
    throw new TokenEncryptionConfigurationError();
  }

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new TokenEncryptionConfigurationError();
  }

  const entries = Object.entries(candidate as Record<string, unknown>);
  if (entries.length < 1 || entries.length > MAX_KEYS) throw new TokenEncryptionConfigurationError();

  const keys = new Map<string, Buffer>();
  for (const [kid, encodedKey] of entries) {
    if (!KID_PATTERN.test(kid) || typeof encodedKey !== "string" || !BASE64_KEY_PATTERN.test(encodedKey)) {
      throw new TokenEncryptionConfigurationError();
    }

    const key = Buffer.from(encodedKey, "base64");
    if (key.length !== KEY_BYTES || key.toString("base64") !== encodedKey) {
      throw new TokenEncryptionConfigurationError();
    }
    keys.set(kid, key);
  }

  if (!keys.has(activeKid)) throw new TokenEncryptionConfigurationError();

  return {
    activeKid,
    keys,
    allowLegacyPlaintextMigration: env.SOUNDCLOUD_TOKEN_ALLOW_LEGACY_PLAINTEXT_MIGRATION === "true"
  };
}

function aad(context: SoundCloudTokenContext, kid: string) {
  return Buffer.from(
    `service=soundcloud-growth-os\nrecord=SoundCloudToken\nversion=${ENVELOPE_VERSION}\nkid=${kid}\nartistId=${context.artistId}\nfield=${context.field}`,
    "utf8"
  );
}

function decodeBase64Url(value: string, expectedBytes?: number) {
  if (!value || !BASE64URL_PATTERN.test(value)) throw new TokenDecryptionError();

  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value || (expectedBytes !== undefined && decoded.length !== expectedBytes)) {
    throw new TokenDecryptionError();
  }
  return decoded;
}

export function isEncryptedSoundCloudToken(value: string) {
  return value.startsWith(ENVELOPE_PREFIX);
}

export function encryptSoundCloudToken(
  value: string,
  context: SoundCloudTokenContext,
  env: Env = process.env
) {
  validateContext(context);
  if (byteLength(value) > MAX_TOKEN_BYTES) throw new TokenEncryptionConfigurationError();

  const keyring = parseKeyring(env);
  const key = keyring.keys.get(keyring.activeKid);
  if (!key) throw new TokenEncryptionConfigurationError();

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(aad(context, keyring.activeKid));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope = [
    ENVELOPE_VERSION,
    keyring.activeKid,
    iv.toString("base64url"),
    ciphertext.toString("base64url") || "_",
    tag.toString("base64url")
  ].join(".");

  if (byteLength(envelope) > MAX_ENVELOPE_BYTES) throw new TokenEncryptionConfigurationError();
  return envelope;
}

export function decryptSoundCloudToken(
  envelope: string,
  context: SoundCloudTokenContext,
  env: Env = process.env,
  options: { allowLegacyPlaintextMigration?: boolean } = {}
): DecryptedSoundCloudToken {
  validateContext(context);
  const keyring = parseKeyring(env);

  if (!envelope.startsWith(ENVELOPE_PREFIX)) {
    if (
      envelope.startsWith(RESERVED_PREFIX) ||
      !keyring.allowLegacyPlaintextMigration ||
      options.allowLegacyPlaintextMigration !== true ||
      byteLength(envelope) > MAX_TOKEN_BYTES
    ) {
      throw new TokenDecryptionError();
    }

    return {
      value: envelope,
      kid: null,
      legacyPlaintext: true,
      requiresReencryption: true
    };
  }

  if (byteLength(envelope) > MAX_ENVELOPE_BYTES) throw new TokenDecryptionError();
  const parts = envelope.split(".");
  if (parts.length !== 5) throw new TokenDecryptionError();

  const [version, kid, encodedIv, encodedCiphertext, encodedTag] = parts;
  if (version !== ENVELOPE_VERSION || !KID_PATTERN.test(kid)) throw new TokenDecryptionError();
  const key = keyring.keys.get(kid);
  if (!key) throw new TokenDecryptionError();

  const iv = decodeBase64Url(encodedIv, IV_BYTES);
  const ciphertext = encodedCiphertext === "_" ? Buffer.alloc(0) : decodeBase64Url(encodedCiphertext);
  const tag = decodeBase64Url(encodedTag, TAG_BYTES);
  if (ciphertext.length > MAX_TOKEN_BYTES) throw new TokenDecryptionError();

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(aad(context, kid));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    if (plaintext.length > MAX_TOKEN_BYTES) throw new TokenDecryptionError();

    return {
      value: new TextDecoder("utf-8", { fatal: true }).decode(plaintext),
      kid,
      legacyPlaintext: false,
      requiresReencryption: kid !== keyring.activeKid
    };
  } catch (error) {
    if (error instanceof TokenDecryptionError) throw error;
    throw new TokenDecryptionError();
  }
}

export function assertSoundCloudTokenEncryptionConfigured(env: Env = process.env) {
  parseKeyring(env);
}
