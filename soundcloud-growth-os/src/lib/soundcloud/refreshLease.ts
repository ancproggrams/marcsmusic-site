import type { Prisma, PrismaClient } from "@prisma/client";
import { getSoundCloudRefreshLeaseConfig, type SoundCloudRuntimeEnv } from "./runtimeConfig";

const ADVISORY_LOCK_NAMESPACE = "soundcloud-growth-os:oauth-refresh";

export class SoundCloudRefreshBusyError extends Error {
  readonly retryAfterSeconds = 1;

  constructor() {
    super("SoundCloud credential refresh is already in progress.");
    this.name = "SoundCloudRefreshBusyError";
  }
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function acquireTransactionLease(
  transaction: Prisma.TransactionClient,
  artistId: string,
  waitMs: number,
  pollIntervalMs: number
) {
  const deadline = performance.now() + waitMs;

  while (true) {
    const rows = await transaction.$queryRaw<Array<{ acquired: boolean }>>`
      SELECT pg_try_advisory_xact_lock(
        hashtextextended(${`${ADVISORY_LOCK_NAMESPACE}:${artistId}`}, 0)
      ) AS "acquired"
    `;
    if (rows[0]?.acquired === true) return;

    const remainingMs = deadline - performance.now();
    if (remainingMs <= 0) throw new SoundCloudRefreshBusyError();
    await delay(Math.min(pollIntervalMs, remainingMs));
  }
}

export async function withSoundCloudRefreshLease<T>(
  prisma: PrismaClient,
  artistId: string,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  env: SoundCloudRuntimeEnv = process.env
) {
  const config = getSoundCloudRefreshLeaseConfig(env);

  return prisma.$transaction(
    async (transaction) => {
      await acquireTransactionLease(transaction, artistId, config.lockWaitMs, config.pollIntervalMs);
      return operation(transaction);
    },
    {
      maxWait: config.transactionMaxWaitMs,
      timeout: config.transactionTimeoutMs
    }
  );
}
