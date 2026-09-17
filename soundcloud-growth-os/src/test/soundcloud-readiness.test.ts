import type { Prisma, PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isSoundCloudServiceReady } from "../lib/soundcloud/readiness";

const KEY = Buffer.alloc(32, 41).toString("base64");
const readyEnv = {
  NODE_ENV: "production",
  SOUNDCLOUD_CLIENT_ID: "client-id",
  SOUNDCLOUD_REDIRECT_URI: "https://growth.example.test/api/auth/soundcloud/callback",
  NEXT_PUBLIC_APP_URL: "https://growth.example.test",
  SOUNDCLOUD_TOKEN_ACTIVE_KID: "prod-2026",
  SOUNDCLOUD_TOKEN_KEYS_JSON: JSON.stringify({ "prod-2026": KEY }),
  SOUNDCLOUD_HEALTH_DB_TIMEOUT_MS: "100"
};

function readinessPrisma(databaseCheck: () => Promise<unknown>) {
  const query = vi.fn(databaseCheck);
  const transaction = vi.fn(async (
    operation: (database: Prisma.TransactionClient) => Promise<unknown>,
    settings?: { maxWait?: number; timeout?: number }
  ) => {
    void settings;
    return operation({ $queryRaw: query } as unknown as Prisma.TransactionClient);
  });

  return {
    prisma: { $transaction: transaction } as unknown as PrismaClient,
    query,
    transaction
  };
}

describe("SoundCloud readiness", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires valid provider config, keyring, runtime limits and bounded database connectivity", async () => {
    const database = readinessPrisma(async () => [{ ready: 1 }]);

    await expect(isSoundCloudServiceReady(database.prisma, readyEnv)).resolves.toBe(true);
    expect(database.query).toHaveBeenCalledTimes(1);
    expect(database.transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 100, timeout: 100 });
  });

  it.each([
    ["provider config", { ...readyEnv, SOUNDCLOUD_CLIENT_ID: "" }],
    ["keyring", { ...readyEnv, SOUNDCLOUD_TOKEN_KEYS_JSON: "{}" }],
    ["API bounds", { ...readyEnv, SOUNDCLOUD_API_MAX_RESPONSE_BYTES: "999999999" }],
    ["refresh bounds", { ...readyEnv, SOUNDCLOUD_REFRESH_LOCK_WAIT_MS: "999999" }]
  ])("fails closed for invalid %s without touching the database", async (_name, env) => {
    const database = readinessPrisma(async () => [{ ready: 1 }]);

    await expect(isSoundCloudServiceReady(database.prisma, env)).resolves.toBe(false);
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it("maps database diagnostics to one non-diagnostic not-ready result", async () => {
    const database = readinessPrisma(async () => {
      throw new Error("postgres://user:secret@internal.example/private-table");
    });

    const result = await isSoundCloudServiceReady(database.prisma, readyEnv);

    expect(result).toBe(false);
    expect(JSON.stringify({ status: result ? "ready" : "not_ready" })).not.toContain("secret");
  });

  it("returns within the configured application deadline even if the database client stalls", async () => {
    vi.useFakeTimers();
    const database = readinessPrisma(() => new Promise(() => undefined));

    const readiness = isSoundCloudServiceReady(database.prisma, readyEnv);
    const assertion = expect(readiness).resolves.toBe(false);
    await vi.advanceTimersByTimeAsync(100);

    await assertion;
  });
});
