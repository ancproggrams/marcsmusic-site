import type { Prisma, PrismaClient, SoundCloudToken } from "@prisma/client";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getFreshToken } from "../lib/growth/soundcloudSync";
import {
  decryptSoundCloudToken,
  encryptSoundCloudToken,
  isEncryptedSoundCloudToken,
  TokenDecryptionError,
  TokenEncryptionConfigurationError
} from "../lib/security/tokenEncryption";
import {
  decryptSoundCloudTokenRow,
  reencryptSoundCloudTokenRow,
  upsertEncryptedSoundCloudToken
} from "../lib/soundcloud/tokenStore";
import { refreshAccessToken } from "../lib/soundcloud/oauth";
import { getSoundCloudConfig, SoundCloudConfigurationError } from "../lib/soundcloud/config";

const OLD_KEY = Buffer.alloc(32, 17).toString("base64");
const NEW_KEY = Buffer.alloc(32, 29).toString("base64");
const oldEnv = {
  SOUNDCLOUD_TOKEN_ACTIVE_KID: "old-2026",
  SOUNDCLOUD_TOKEN_KEYS_JSON: JSON.stringify({ "old-2026": OLD_KEY })
};
const rotatedEnv = {
  SOUNDCLOUD_TOKEN_ACTIVE_KID: "new-2026",
  SOUNDCLOUD_TOKEN_KEYS_JSON: JSON.stringify({ "new-2026": NEW_KEY, "old-2026": OLD_KEY })
};
const context = { artistId: "artist-1", field: "accessToken" as const };

function tokenRow(overrides: Partial<SoundCloudToken> = {}): SoundCloudToken {
  return {
    id: "token-1",
    artistId: "artist-1",
    accessToken: encryptSoundCloudToken("access-secret", context, oldEnv),
    refreshToken: encryptSoundCloudToken("refresh-secret", { artistId: "artist-1", field: "refreshToken" }, oldEnv),
    expiresAt: new Date("2026-07-15T00:00:00.000Z"),
    scope: "read",
    revision: 0,
    createdAt: new Date("2026-07-14T00:00:00.000Z"),
    updatedAt: new Date("2026-07-14T00:00:00.000Z"),
    ...overrides
  };
}

describe("SoundCloud token encryption", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("writes a versioned AES-256-GCM envelope and decrypts only with matching AAD", () => {
    const envelope = encryptSoundCloudToken("top-secret-access-token", context, oldEnv);
    expect(isEncryptedSoundCloudToken(envelope)).toBe(true);
    expect(envelope).not.toContain("top-secret-access-token");
    expect(decryptSoundCloudToken(envelope, context, oldEnv)).toMatchObject({
      value: "top-secret-access-token",
      kid: "old-2026",
      legacyPlaintext: false,
      requiresReencryption: false
    });

    expect(() => decryptSoundCloudToken(envelope, { ...context, artistId: "artist-2" }, oldEnv)).toThrow(TokenDecryptionError);
    expect(() => decryptSoundCloudToken(envelope, { ...context, field: "refreshToken" }, oldEnv)).toThrow(TokenDecryptionError);
  });

  it("installs a non-blocking database guard that rejects every new plaintext write", () => {
    const migration = readFileSync(
      new URL("../../prisma/migrations/20260715143000_require_encrypted_soundcloud_tokens/migration.sql", import.meta.url),
      "utf8"
    );
    expect(migration).toContain('"accessToken" LIKE \'scg1.%\'');
    expect(migration).toContain('"refreshToken" LIKE \'scg1.%\'');
    expect(migration).toContain('ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0');
    expect(migration).toContain("NOT VALID");
  });

  it("fails closed on tampering, wrong keys, unknown kids and malformed envelopes", () => {
    const envelope = encryptSoundCloudToken("top-secret-access-token", context, oldEnv);
    const parts = envelope.split(".");
    const tamperedCiphertext = [...parts];
    tamperedCiphertext[3] = `${parts[3].slice(0, -1)}${parts[3].endsWith("A") ? "B" : "A"}`;
    const tamperedKid = [...parts];
    tamperedKid[1] = "unknown";

    expect(() => decryptSoundCloudToken(tamperedCiphertext.join("."), context, oldEnv)).toThrow(TokenDecryptionError);
    expect(() => decryptSoundCloudToken(tamperedKid.join("."), context, oldEnv)).toThrow(TokenDecryptionError);
    expect(() =>
      decryptSoundCloudToken(envelope, context, {
        SOUNDCLOUD_TOKEN_ACTIVE_KID: "old-2026",
        SOUNDCLOUD_TOKEN_KEYS_JSON: JSON.stringify({ "old-2026": NEW_KEY })
      })
    ).toThrow(TokenDecryptionError);
    expect(() => decryptSoundCloudToken("scg1.old-2026.invalid", context, oldEnv)).toThrow(TokenDecryptionError);
  });

  it("uses historical keys for decryption only and marks old envelopes for re-encryption", () => {
    const oldEnvelope = encryptSoundCloudToken("old-value", context, oldEnv);
    const decrypted = decryptSoundCloudToken(oldEnvelope, context, rotatedEnv);
    expect(decrypted).toMatchObject({ value: "old-value", kid: "old-2026", requiresReencryption: true });

    const newEnvelope = encryptSoundCloudToken("new-value", context, rotatedEnv);
    expect(newEnvelope.split(".")[1]).toBe("new-2026");
    expect(() =>
      decryptSoundCloudToken(oldEnvelope, context, {
        SOUNDCLOUD_TOKEN_ACTIVE_KID: "new-2026",
        SOUNDCLOUD_TOKEN_KEYS_JSON: JSON.stringify({ "new-2026": NEW_KEY })
      })
    ).toThrow(TokenDecryptionError);
  });

  it("allows legacy plaintext reads only behind the exact migration flag and never treats malformed envelopes as plaintext", () => {
    expect(() => decryptSoundCloudToken("legacy-token", context, oldEnv)).toThrow(TokenDecryptionError);
    expect(() =>
      decryptSoundCloudToken("legacy-token", context, {
        ...oldEnv,
        SOUNDCLOUD_TOKEN_ALLOW_LEGACY_PLAINTEXT_MIGRATION: "true"
      })
    ).toThrow(TokenDecryptionError);
    expect(() =>
      decryptSoundCloudToken("legacy-token", context, {
        ...oldEnv,
        SOUNDCLOUD_TOKEN_ALLOW_LEGACY_PLAINTEXT_MIGRATION: "TRUE"
      },
      { allowLegacyPlaintextMigration: true })
    ).toThrow(TokenDecryptionError);

    expect(
      decryptSoundCloudToken("legacy-token", context, {
        ...oldEnv,
        SOUNDCLOUD_TOKEN_ALLOW_LEGACY_PLAINTEXT_MIGRATION: "true"
      },
      { allowLegacyPlaintextMigration: true })
    ).toMatchObject({ value: "legacy-token", legacyPlaintext: true, requiresReencryption: true });

    expect(() =>
      decryptSoundCloudToken("scg0.looks-like-an-envelope", context, {
        ...oldEnv,
        SOUNDCLOUD_TOKEN_ALLOW_LEGACY_PLAINTEXT_MIGRATION: "true"
      },
      { allowLegacyPlaintextMigration: true })
    ).toThrow(TokenDecryptionError);
  });

  it.each([
    {},
    { SOUNDCLOUD_TOKEN_ACTIVE_KID: "old-2026", SOUNDCLOUD_TOKEN_KEYS_JSON: "{}" },
    { SOUNDCLOUD_TOKEN_ACTIVE_KID: "old-2026", SOUNDCLOUD_TOKEN_KEYS_JSON: "not-json" },
    { SOUNDCLOUD_TOKEN_ACTIVE_KID: "missing", SOUNDCLOUD_TOKEN_KEYS_JSON: JSON.stringify({ "old-2026": OLD_KEY }) },
    { SOUNDCLOUD_TOKEN_ACTIVE_KID: "old-2026", SOUNDCLOUD_TOKEN_KEYS_JSON: JSON.stringify({ "old-2026": "weak" }) }
  ])("fails closed for missing or invalid keyring configuration", (env) => {
    expect(() => encryptSoundCloudToken("secret", context, env)).toThrow(TokenEncryptionConfigurationError);
  });

  it("encrypts both columns before an OAuth upsert", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const prisma = { soundCloudToken: { upsert } } as unknown as PrismaClient;

    await upsertEncryptedSoundCloudToken(
      prisma,
      "artist-1",
      {
        access_token: "plain-access",
        refresh_token: "plain-refresh",
        expires_in: 3_600,
        token_type: "OAuth",
        scope: "read"
      },
      rotatedEnv,
      Date.parse("2026-07-15T00:00:00.000Z")
    );

    const call = upsert.mock.calls[0][0];
    expect(call.update.accessToken).not.toContain("plain-access");
    expect(call.update.refreshToken).not.toContain("plain-refresh");
    expect(call.update.revision).toEqual({ increment: 1 });
    expect(decryptSoundCloudToken(call.update.accessToken, context, rotatedEnv).value).toBe("plain-access");
    expect(decryptSoundCloudToken(call.update.refreshToken, { artistId: "artist-1", field: "refreshToken" }, rotatedEnv).value).toBe(
      "plain-refresh"
    );
  });

  it("supports dry-run and OCC-protected re-encryption of legacy or historical rows", async () => {
    const row = tokenRow();
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = { soundCloudToken: { updateMany } } as unknown as PrismaClient;

    const dryRun = await reencryptSoundCloudTokenRow(prisma, row, { apply: false, env: rotatedEnv });
    expect(dryRun).toEqual({ needsReencryption: true, updated: false, conflicted: false });
    expect(updateMany).not.toHaveBeenCalled();

    const applied = await reencryptSoundCloudTokenRow(prisma, row, { apply: true, env: rotatedEnv });
    expect(applied).toEqual({ needsReencryption: true, updated: true, conflicted: false });
    const operation = updateMany.mock.calls[0][0];
    expect(operation.where).toMatchObject({
      id: row.id,
      revision: row.revision
    });
    expect(operation.where.accessToken).toBeUndefined();
    expect(operation.where.refreshToken).toBeUndefined();
    expect(decryptSoundCloudTokenRow({ ...row, ...operation.data }, rotatedEnv)).toMatchObject({
      accessToken: "access-secret",
      refreshToken: "refresh-secret"
    });
  });

  it("migrates plaintext only with the one-off gate and writes only active-key envelopes", async () => {
    const row = tokenRow({ accessToken: "legacy-access", refreshToken: "legacy-refresh" });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = { soundCloudToken: { updateMany } } as unknown as PrismaClient;
    const migrationEnv = {
      ...rotatedEnv,
      SOUNDCLOUD_TOKEN_ALLOW_LEGACY_PLAINTEXT_MIGRATION: "true"
    };

    const result = await reencryptSoundCloudTokenRow(prisma, row, { apply: true, env: migrationEnv });
    expect(result).toEqual({ needsReencryption: true, updated: true, conflicted: false });
    const operation = updateMany.mock.calls[0][0];
    expect(operation.data.accessToken.split(".")[1]).toBe("new-2026");
    expect(operation.data.refreshToken.split(".")[1]).toBe("new-2026");
    expect(operation.data.accessToken).not.toContain("legacy-access");
    expect(operation.data.refreshToken).not.toContain("legacy-refresh");
  });

  it("never includes provider bodies or refresh-token plaintext in OAuth errors", async () => {
    vi.stubEnv("SOUNDCLOUD_CLIENT_ID", "client-id");
    vi.stubEnv("SOUNDCLOUD_REDIRECT_URI", "https://growth.example.test/api/auth/soundcloud/callback");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://growth.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("provider-secret-diagnostic", {
          status: 400,
          headers: { "content-type": "text/plain" }
        })
      )
    );

    let message = "";
    try {
      await refreshAccessToken("plain-refresh-secret");
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("SoundCloud OAuth request failed");
    expect(message).not.toContain("provider-secret-diagnostic");
    expect(message).not.toContain("plain-refresh-secret");
  });

  it("requires an exact same-origin HTTPS OAuth callback in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SOUNDCLOUD_CLIENT_ID", "client-id");
    vi.stubEnv("SOUNDCLOUD_REDIRECT_URI", "https://attacker.example/api/auth/soundcloud/callback");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://growth.example.test");
    expect(() => getSoundCloudConfig()).toThrow(SoundCloudConfigurationError);

    vi.stubEnv("SOUNDCLOUD_REDIRECT_URI", "http://growth.example.test/api/auth/soundcloud/callback");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://growth.example.test");
    expect(() => getSoundCloudConfig()).toThrow(SoundCloudConfigurationError);

    vi.stubEnv("SOUNDCLOUD_REDIRECT_URI", "https://growth.example.test/api/auth/soundcloud/callback");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://growth.example.test");
    expect(getSoundCloudConfig()).toMatchObject({
      appUrl: "https://growth.example.test/",
      redirectUri: "https://growth.example.test/api/auth/soundcloud/callback"
    });
  });
});

type RefreshUpdate = {
  where: {
    id: string;
    revision: number;
    updatedAt: Date;
    accessToken: string;
    refreshToken: string;
  };
  data: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    scope: string | null;
    revision: { increment: number };
  };
};

function serializedRefreshHarness(
  initialRow: SoundCloudToken,
  options: { beforeFirstUpdate?: (row: SoundCloudToken) => SoundCloudToken } = {}
) {
  let row = { ...initialRow };
  let updateAttempts = 0;
  let successfulUpdates = 0;
  const events: string[] = [];
  let firstQueuedResolve!: () => void;
  let bothQueuedResolve!: () => void;
  const firstTransactionQueued = new Promise<void>((resolve) => {
    firstQueuedResolve = resolve;
  });
  const bothTransactionsQueued = new Promise<void>((resolve) => {
    bothQueuedResolve = resolve;
  });
  let queuedTransactions = 0;
  let leaseOwner: symbol | null = null;
  let leaseAttempts = 0;

  const soundCloudToken = {
    findUnique: vi.fn(async () => {
      events.push("read");
      return { ...row };
    }),
    updateMany: vi.fn(async ({ where, data }: RefreshUpdate) => {
      events.push("persist");
      updateAttempts += 1;
      if (updateAttempts === 1 && options.beforeFirstUpdate) {
        row = options.beforeFirstUpdate({ ...row });
      }

      const matches =
        where.id === row.id &&
        where.revision === row.revision &&
        where.updatedAt.getTime() === row.updatedAt.getTime() &&
        where.accessToken === row.accessToken &&
        where.refreshToken === row.refreshToken;
      if (!matches) return { count: 0 };

      const previousRevision = row.revision;
      const previousUpdatedAt = row.updatedAt;
      successfulUpdates += 1;
      row = {
        ...row,
        ...data,
        revision: previousRevision + data.revision.increment,
        updatedAt: new Date(previousUpdatedAt.getTime() + 1_000)
      };
      return { count: 1 };
    })
  };

  function client() {
    const transactionSpy = vi.fn(async (
      operation: (database: Prisma.TransactionClient) => Promise<unknown>,
      settings?: { maxWait?: number; timeout?: number }
    ) => {
      void settings;
      queuedTransactions += 1;
      if (queuedTransactions === 1) firstQueuedResolve();
      if (queuedTransactions === 2) bothQueuedResolve();
      const owner = Symbol("transaction");
      const transaction = {
        $queryRaw: vi.fn(async () => {
          leaseAttempts += 1;
          if (leaseOwner === null || leaseOwner === owner) {
            leaseOwner = owner;
            events.push("lease");
            return [{ acquired: true }];
          }
          events.push("lease-wait");
          return [{ acquired: false }];
        }),
        soundCloudToken
      } as unknown as Prisma.TransactionClient;
      try {
        return await operation(transaction);
      } finally {
        if (leaseOwner === owner) leaseOwner = null;
      }
    });

    return {
      prisma: {
        soundCloudToken: {
          findFirst: vi.fn(async () => ({ id: row.id, artistId: row.artistId }))
        },
        $transaction: transactionSpy
      } as unknown as PrismaClient,
      transactionSpy
    };
  }

  return {
    client,
    events,
    firstTransactionQueued,
    bothTransactionsQueued,
    get row() {
      return row;
    },
    get updateAttempts() {
      return updateAttempts;
    },
    get successfulUpdates() {
      return successfulUpdates;
    },
    get leaseAttempts() {
      return leaseAttempts;
    }
  };
}

describe("SoundCloud refresh concurrency", () => {
  const now = () => Date.parse("2026-07-15T12:00:00.000Z");

  it("serializes two replicas before provider I/O and refreshes a single-use token once", async () => {
    const harness = serializedRefreshHarness(tokenRow({
      accessToken: encryptSoundCloudToken("expired-access", context, rotatedEnv),
      refreshToken: encryptSoundCloudToken("refresh-0", { artistId: "artist-1", field: "refreshToken" }, rotatedEnv)
    }));
    const firstClient = harness.client();
    const secondClient = harness.client();
    const refresh = vi.fn(async (refreshToken: string) => {
      harness.events.push(`provider:${refreshToken}`);
      await harness.bothTransactionsQueued;
      return {
        access_token: "winning-access",
        refresh_token: "winning-refresh",
        expires_in: 3_600,
        token_type: "OAuth"
      };
    });

    const firstRequest = getFreshToken(firstClient.prisma, { now, refresh, env: rotatedEnv });
    await harness.firstTransactionQueued;
    const secondRequest = getFreshToken(secondClient.prisma, { now, refresh, env: rotatedEnv });
    const [first, second] = await Promise.all([firstRequest, secondRequest]);
    const stored = decryptSoundCloudTokenRow(harness.row, rotatedEnv);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith("refresh-0");
    expect(harness.successfulUpdates).toBe(1);
    expect(harness.leaseAttempts).toBeGreaterThanOrEqual(3);
    expect(first).toMatchObject({ accessToken: stored.accessToken, refreshToken: stored.refreshToken });
    expect(second).toMatchObject({ accessToken: stored.accessToken, refreshToken: stored.refreshToken });
    expect(harness.events.indexOf("lease")).toBeLessThan(harness.events.indexOf("provider:refresh-0"));
    expect(firstClient.transactionSpy).toHaveBeenCalledWith(expect.any(Function), { maxWait: 2_000, timeout: 21_500 });
    expect(secondClient.transactionSpy).toHaveBeenCalledWith(expect.any(Function), { maxWait: 2_000, timeout: 21_500 });
  });

  it("lets a rotated-key replica consume an old-key winner without another provider call", async () => {
    const harness = serializedRefreshHarness(tokenRow({
      accessToken: encryptSoundCloudToken("expired-access", context, oldEnv),
      refreshToken: encryptSoundCloudToken("refresh-0", { artistId: "artist-1", field: "refreshToken" }, oldEnv)
    }));
    const oldKeyClient = harness.client();
    const rotatedKeyClient = harness.client();
    const refresh = vi.fn(async () => {
      await harness.bothTransactionsQueued;
      return {
        access_token: "old-writer-access",
        refresh_token: "old-writer-refresh",
        expires_in: 3_600,
        token_type: "OAuth"
      };
    });

    const oldWriter = getFreshToken(oldKeyClient.prisma, { now, refresh, env: oldEnv });
    await harness.firstTransactionQueued;
    const rotatedReader = getFreshToken(rotatedKeyClient.prisma, { now, refresh, env: rotatedEnv });
    const [first, second] = await Promise.all([oldWriter, rotatedReader]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({ accessToken: "old-writer-access", refreshToken: "old-writer-refresh" });
    expect(second).toMatchObject({ accessToken: "old-writer-access", refreshToken: "old-writer-refresh" });
  });

  it("fails an obsolete-key replica before provider I/O after a new-key winner", async () => {
    const harness = serializedRefreshHarness(tokenRow({
      accessToken: encryptSoundCloudToken("expired-access", context, rotatedEnv),
      refreshToken: encryptSoundCloudToken("refresh-0", { artistId: "artist-1", field: "refreshToken" }, rotatedEnv)
    }));
    const rotatedKeyClient = harness.client();
    const obsoleteKeyClient = harness.client();
    const winningRefresh = vi.fn(async () => {
      await harness.bothTransactionsQueued;
      return {
        access_token: "new-key-access",
        refresh_token: "new-key-refresh",
        expires_in: 3_600,
        token_type: "OAuth"
      };
    });
    const forbiddenSecondRefresh = vi.fn();

    const winningRequest = getFreshToken(rotatedKeyClient.prisma, { now, refresh: winningRefresh, env: rotatedEnv });
    await harness.firstTransactionQueued;
    const obsoleteRequest = getFreshToken(obsoleteKeyClient.prisma, {
      now,
      refresh: forbiddenSecondRefresh,
      env: oldEnv
    });
    const [winner, obsolete] = await Promise.allSettled([winningRequest, obsoleteRequest]);

    expect(winner.status).toBe("fulfilled");
    expect(obsolete.status).toBe("rejected");
    if (obsolete.status === "rejected") expect(obsolete.reason).toBeInstanceOf(TokenDecryptionError);
    expect(winningRefresh).toHaveBeenCalledTimes(1);
    expect(forbiddenSecondRefresh).not.toHaveBeenCalled();
  });

  it("re-fences an in-flight provider result after envelope rotation without refreshing twice", async () => {
    const initial = tokenRow({
      accessToken: encryptSoundCloudToken("expired-access", context, oldEnv),
      refreshToken: encryptSoundCloudToken("refresh-0", { artistId: "artist-1", field: "refreshToken" }, oldEnv)
    });
    const harness = serializedRefreshHarness(initial, {
      beforeFirstUpdate: (current) => ({
        ...current,
        ...encryptSoundCloudTokenPairForTest(current.artistId, "expired-access", "refresh-0", rotatedEnv),
        revision: current.revision + 1,
        updatedAt: new Date(current.updatedAt.getTime() + 500)
      })
    });
    const client = harness.client();
    const refresh = vi.fn(async () => ({
      access_token: "rotation-safe-access",
      refresh_token: "rotation-safe-refresh",
      expires_in: 3_600,
      token_type: "OAuth"
    }));

    const result = await getFreshToken(client.prisma, { now, refresh, env: rotatedEnv });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(harness.updateAttempts).toBe(2);
    expect(harness.successfulUpdates).toBe(1);
    expect(result).toMatchObject({ accessToken: "rotation-safe-access", refreshToken: "rotation-safe-refresh" });
    expect(harness.row.accessToken.split(".")[1]).toBe("new-2026");
    expect(harness.row.refreshToken.split(".")[1]).toBe("new-2026");
  });
});

function encryptSoundCloudTokenPairForTest(
  artistId: string,
  accessToken: string,
  refreshToken: string,
  env: Record<string, string | undefined>
) {
  return {
    accessToken: encryptSoundCloudToken(accessToken, { artistId, field: "accessToken" }, env),
    refreshToken: encryptSoundCloudToken(refreshToken, { artistId, field: "refreshToken" }, env)
  };
}
