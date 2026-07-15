import type { Prisma, PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { SoundCloudRefreshBusyError, withSoundCloudRefreshLease } from "../lib/soundcloud/refreshLease";

describe("SoundCloud refresh advisory lease", () => {
  it("fails within the zero-wait bound without invoking provider work when another replica owns the lease", async () => {
    const operation = vi.fn();
    const query = vi.fn(async () => [{ acquired: false }]);
    const transaction = vi.fn(async (
      callback: (database: Prisma.TransactionClient) => Promise<unknown>,
      settings?: { maxWait?: number; timeout?: number }
    ) => {
      void settings;
      return callback({ $queryRaw: query } as unknown as Prisma.TransactionClient);
    });
    const prisma = { $transaction: transaction } as unknown as PrismaClient;

    await expect(withSoundCloudRefreshLease(
      prisma,
      "artist-1",
      operation,
      { SOUNDCLOUD_REFRESH_LOCK_WAIT_MS: "0" }
    )).rejects.toBeInstanceOf(SoundCloudRefreshBusyError);

    expect(query).toHaveBeenCalledTimes(1);
    expect(operation).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 2_000, timeout: 20_000 });
  });
});
