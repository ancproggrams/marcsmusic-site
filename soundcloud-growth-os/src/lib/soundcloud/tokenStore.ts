import type { PrismaClient, SoundCloudToken } from "@prisma/client";
import {
  decryptSoundCloudToken,
  encryptSoundCloudToken,
  type DecryptedSoundCloudToken
} from "@/lib/security/tokenEncryption";
import type { SoundCloudTokenResponse } from "./types";

type Env = Record<string, string | undefined>;

export type PlaintextSoundCloudToken = Omit<SoundCloudToken, "accessToken" | "refreshToken"> & {
  accessToken: string;
  refreshToken: string;
};

type DecryptedPair = {
  accessToken: DecryptedSoundCloudToken;
  refreshToken: DecryptedSoundCloudToken;
};

export function decryptSoundCloudTokenRow(row: SoundCloudToken, env: Env = process.env): PlaintextSoundCloudToken {
  const accessToken = decryptSoundCloudToken(row.accessToken, { artistId: row.artistId, field: "accessToken" }, env);
  const refreshToken = decryptSoundCloudToken(row.refreshToken, { artistId: row.artistId, field: "refreshToken" }, env);

  return {
    ...row,
    accessToken: accessToken.value,
    refreshToken: refreshToken.value
  };
}

export function inspectSoundCloudTokenRow(
  row: SoundCloudToken,
  env: Env = process.env,
  options: { allowLegacyPlaintextMigration?: boolean } = {}
): DecryptedPair {
  return {
    accessToken: decryptSoundCloudToken(
      row.accessToken,
      { artistId: row.artistId, field: "accessToken" },
      env,
      options
    ),
    refreshToken: decryptSoundCloudToken(
      row.refreshToken,
      { artistId: row.artistId, field: "refreshToken" },
      env,
      options
    )
  };
}

export function encryptSoundCloudTokenPair(
  artistId: string,
  accessToken: string,
  refreshToken: string,
  env: Env = process.env
) {
  return {
    accessToken: encryptSoundCloudToken(accessToken, { artistId, field: "accessToken" }, env),
    refreshToken: encryptSoundCloudToken(refreshToken, { artistId, field: "refreshToken" }, env)
  };
}

export async function upsertEncryptedSoundCloudToken(
  prisma: PrismaClient,
  artistId: string,
  token: SoundCloudTokenResponse,
  env: Env = process.env,
  now = Date.now()
) {
  const encrypted = encryptSoundCloudTokenPair(artistId, token.access_token, token.refresh_token ?? "", env);
  const data = {
    ...encrypted,
    expiresAt: new Date(now + token.expires_in * 1_000),
    scope: token.scope
  };

  return prisma.soundCloudToken.upsert({
    where: { artistId },
    update: {
      ...data,
      revision: { increment: 1 }
    },
    create: {
      artistId,
      ...data
    }
  });
}

export async function reencryptSoundCloudTokenRow(
  prisma: PrismaClient,
  row: SoundCloudToken,
  options: { apply: boolean; env?: Env }
) {
  const env = options.env ?? process.env;
  const inspected = inspectSoundCloudTokenRow(row, env, { allowLegacyPlaintextMigration: true });
  const needsReencryption = inspected.accessToken.requiresReencryption || inspected.refreshToken.requiresReencryption;

  if (!needsReencryption || !options.apply) {
    return { needsReencryption, updated: false, conflicted: false };
  }

  const encrypted = encryptSoundCloudTokenPair(
    row.artistId,
    inspected.accessToken.value,
    inspected.refreshToken.value,
    env
  );
  const result = await prisma.soundCloudToken.updateMany({
    where: {
      id: row.id,
      revision: row.revision
    },
    data: {
      ...encrypted,
      revision: { increment: 1 }
    }
  });

  return {
    needsReencryption: true,
    updated: result.count === 1,
    conflicted: result.count !== 1
  };
}
