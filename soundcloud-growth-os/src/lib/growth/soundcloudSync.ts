import type { PrismaClient, Track } from "@prisma/client";
import { SoundCloudClient } from "../soundcloud/client";
import { refreshAccessToken } from "../soundcloud/oauth";
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

async function getFreshToken(prisma: PrismaClient) {
  const token = await prisma.soundCloudToken.findFirst({
    orderBy: { updatedAt: "desc" }
  });

  if (!token) {
    throw new SoundCloudConnectionRequiredError();
  }

  const refreshSkewMs = 60 * 1000;
  if (token.expiresAt.getTime() > Date.now() + refreshSkewMs) {
    return token;
  }

  if (!token.refreshToken) {
    throw new SoundCloudConnectionRequiredError("SoundCloud token expired. Reconnect SoundCloud.");
  }

  const refreshed = await refreshAccessToken(token.refreshToken);
  return prisma.soundCloudToken.update({
    where: { id: token.id },
    data: {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      scope: refreshed.scope ?? token.scope
    }
  });
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
