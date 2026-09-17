import type { PrismaClient, SoundCloudToken, Track } from "@prisma/client";
import { SoundCloudClient } from "../soundcloud/client";
import { refreshAccessToken } from "../soundcloud/oauth";
import { withSoundCloudRefreshLease } from "../soundcloud/refreshLease";
import { decryptSoundCloudTokenRow, encryptSoundCloudTokenPair, type PlaintextSoundCloudToken } from "../soundcloud/tokenStore";
import type { SoundCloudTrack } from "../soundcloud/types";
import { engagementRate, roundScore } from "./scoring";

export class SoundCloudConnectionRequiredError extends Error {
  constructor(message = "Connect SoundCloud first.") {
    super(message);
    this.name = "SoundCloudConnectionRequiredError";
  }
}

export function startOfUtcDay(input = new Date()) {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

export function parseSoundCloudTagList(tagList?: string) {
  const matches = tagList?.match(/"[^"]+"|\S+/g) ?? [];
  return matches.map((tag) => tag.replace(/^"|"$/g, "").trim()).filter(Boolean);
}

function getSoundCloudTrackKey(track: SoundCloudTrack) {
  return track.urn ?? String(track.id);
}

function getReleaseDate(track: SoundCloudTrack) {
  const date = track.release_date ?? track.created_at;
  return date ? new Date(date) : null;
}

function getTrackMetrics(track: SoundCloudTrack) {
  const plays = track.playback_count ?? 0;
  const likes = track.favoritings_count ?? 0;
  const comments = track.comment_count ?? 0;
  const reposts = track.reposts_count ?? 0;
  const downloads = track.download_count ?? 0;

  return {
    plays,
    likes,
    comments,
    reposts,
    downloads,
    engagementScore: roundScore(engagementRate({ plays, likes, comments, reposts, downloads }))
  };
}

function tokenVersionChanged(previous: SoundCloudToken, current: SoundCloudToken) {
  return (
    previous.revision !== current.revision ||
    previous.updatedAt.getTime() !== current.updatedAt.getTime() ||
    previous.accessToken !== current.accessToken ||
    previous.refreshToken !== current.refreshToken
  );
}

function tokenIsFresh(token: SoundCloudToken, now: number) {
  return token.expiresAt.getTime() > now + 60 * 1_000;
}

export async function getFreshToken(
  prisma: PrismaClient,
  options: {
    now?: () => number;
    refresh?: typeof refreshAccessToken;
    env?: Record<string, string | undefined>;
  } = {}
): Promise<PlaintextSoundCloudToken> {
  const now = options.now ?? Date.now;
  const refresh = options.refresh ?? refreshAccessToken;
  const env = options.env ?? process.env;
  const candidate = await prisma.soundCloudToken.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { id: true, artistId: true }
  });

  if (!candidate) {
    throw new SoundCloudConnectionRequiredError();
  }

  return withSoundCloudRefreshLease(prisma, candidate.artistId, async (transaction) => {
    // This reread is deliberately inside the cross-replica lease. No token is
    // decrypted and no provider I/O starts from the stale pre-lock snapshot.
    const token = await transaction.soundCloudToken.findUnique({ where: { id: candidate.id } });
    if (!token) throw new SoundCloudConnectionRequiredError();

    const decrypted = decryptSoundCloudTokenRow(token, env);
    const currentTime = now();
    if (tokenIsFresh(token, currentTime)) return decrypted;

    if (!decrypted.refreshToken) {
      throw new SoundCloudConnectionRequiredError("SoundCloud token expired. Reconnect SoundCloud.");
    }

    let refreshed;
    try {
      refreshed = await refresh(decrypted.refreshToken);
    } catch (error) {
      const current = await transaction.soundCloudToken.findUnique({ where: { id: token.id } });
      if (current && tokenVersionChanged(token, current) && tokenIsFresh(current, now())) {
        return decryptSoundCloudTokenRow(current, env);
      }
      throw error;
    }

    const nextRefreshToken = refreshed.refresh_token ?? decrypted.refreshToken;
    const encrypted = encryptSoundCloudTokenPair(token.artistId, refreshed.access_token, nextRefreshToken, env);
    const expiresAt = new Date(now() + refreshed.expires_in * 1_000);
    const update = await transaction.soundCloudToken.updateMany({
      where: {
        id: token.id,
        revision: token.revision,
        updatedAt: token.updatedAt,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken
      },
      data: {
        ...encrypted,
        expiresAt,
        scope: refreshed.scope ?? token.scope,
        revision: { increment: 1 }
      }
    });

    if (update.count === 1) {
      const persisted = await transaction.soundCloudToken.findUnique({ where: { id: token.id } });
      if (!persisted) throw new SoundCloudConnectionRequiredError();
      return decryptSoundCloudTokenRow(persisted, env);
    }

    // The revision and encrypted row values form the fencing condition. A
    // non-participating writer can win, but this lease holder cannot overwrite
    // that newer credential after provider I/O.
    const winner: SoundCloudToken | null = await transaction.soundCloudToken.findUnique({ where: { id: token.id } });
    if (winner && tokenVersionChanged(token, winner) && tokenIsFresh(winner, now())) {
      return decryptSoundCloudTokenRow(winner, env);
    }
    if (winner && tokenVersionChanged(token, winner)) {
      const winnerPlaintext = decryptSoundCloudTokenRow(winner, env);
      const keyRotationOnly =
        winnerPlaintext.accessToken === decrypted.accessToken &&
        winnerPlaintext.refreshToken === decrypted.refreshToken &&
        winner.expiresAt.getTime() === token.expiresAt.getTime() &&
        winner.scope === token.scope;

      if (keyRotationOnly) {
        // A key-rotation worker may have re-encrypted the same credential while
        // the provider request was in flight. Re-fence and persist the already
        // obtained provider response without making a second refresh call.
        const rotatedEncryption = encryptSoundCloudTokenPair(
          winner.artistId,
          refreshed.access_token,
          nextRefreshToken,
          env
        );
        const rotationAwareUpdate = await transaction.soundCloudToken.updateMany({
          where: {
            id: winner.id,
            revision: winner.revision,
            updatedAt: winner.updatedAt,
            accessToken: winner.accessToken,
            refreshToken: winner.refreshToken
          },
          data: {
            ...rotatedEncryption,
            expiresAt,
            scope: refreshed.scope ?? winner.scope,
            revision: { increment: 1 }
          }
        });
        if (rotationAwareUpdate.count === 1) {
          const persisted = await transaction.soundCloudToken.findUnique({ where: { id: winner.id } });
          if (!persisted) throw new SoundCloudConnectionRequiredError();
          return decryptSoundCloudTokenRow(persisted, env);
        }
      }
    }
    throw new SoundCloudConnectionRequiredError("SoundCloud credential refresh conflicted. Retry the operation.");
  }, env);
}

async function upsertTrackFromSoundCloud(prisma: PrismaClient, artistId: string, track: SoundCloudTrack): Promise<Track> {
  const soundcloudUrn = getSoundCloudTrackKey(track);
  const data = {
    title: track.title,
    permalinkUrl: track.permalink_url,
    genre: track.genre,
    tags: parseSoundCloudTagList(track.tag_list),
    durationMs: track.duration,
    releaseDate: getReleaseDate(track)
  };

  return prisma.track.upsert({
    where: { soundcloudUrn },
    update: data,
    create: {
      artistId,
      soundcloudUrn,
      ...data
    }
  });
}

export async function syncTracksForLatestToken(prisma: PrismaClient, limit = 50) {
  const token = await getFreshToken(prisma);
  const client = new SoundCloudClient({ accessToken: token.accessToken });
  const tracks = await client.getMyTracks(limit);
  const synced: string[] = [];

  for (const track of tracks.collection) {
    const saved = await upsertTrackFromSoundCloud(prisma, token.artistId, track);
    synced.push(saved.id);
  }

  return {
    synced: synced.length,
    trackIds: synced
  };
}

export async function createDailySnapshotForLatestToken(prisma: PrismaClient, date = startOfUtcDay(), limit = 50) {
  const token = await getFreshToken(prisma);
  const client = new SoundCloudClient({ accessToken: token.accessToken });
  const tracks = await client.getMyTracks(limit);
  const snapshots: string[] = [];

  for (const track of tracks.collection) {
    const dbTrack = await upsertTrackFromSoundCloud(prisma, token.artistId, track);
    const metrics = getTrackMetrics(track);

    const metric = await prisma.dailyTrackMetric.upsert({
      where: { trackId_date: { trackId: dbTrack.id, date } },
      update: metrics,
      create: {
        trackId: dbTrack.id,
        date,
        ...metrics
      }
    });

    snapshots.push(metric.id);
  }

  return {
    snapshots: snapshots.length,
    date: date.toISOString().slice(0, 10)
  };
}
