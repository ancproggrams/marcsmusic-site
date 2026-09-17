import type { PrismaClient } from "@prisma/client";
import { assertSoundCloudTokenEncryptionConfigured } from "@/lib/security/tokenEncryption";
import { getSoundCloudConfig } from "./config";
import {
  getSoundCloudApiReliabilityConfig,
  getSoundCloudHealthConfig,
  getSoundCloudRefreshLeaseConfig,
  type SoundCloudRuntimeEnv
} from "./runtimeConfig";

async function withDeadline<T>(operation: Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("readiness deadline exceeded")), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function checkDatabase(prisma: PrismaClient, timeoutMs: number) {
  const transaction = prisma.$transaction(
    async (database) => {
      await database.$queryRaw`SELECT 1 AS "ready"`;
    },
    { maxWait: timeoutMs, timeout: timeoutMs }
  );
  await withDeadline(transaction, timeoutMs);
}

export async function isSoundCloudServiceReady(
  prisma: PrismaClient,
  env: SoundCloudRuntimeEnv = process.env
) {
  try {
    getSoundCloudConfig(env);
    assertSoundCloudTokenEncryptionConfigured(env);
    getSoundCloudApiReliabilityConfig(env);
    getSoundCloudRefreshLeaseConfig(env);
    const { databaseTimeoutMs } = getSoundCloudHealthConfig(env);
    await checkDatabase(prisma, databaseTimeoutMs);
    return true;
  } catch {
    // The public readiness endpoint deliberately exposes no dependency,
    // credential, key id, database, or provider diagnostics.
    return false;
  }
}
