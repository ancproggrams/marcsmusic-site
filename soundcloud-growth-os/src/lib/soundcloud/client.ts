import { assertReadOnlyResearch } from "@/lib/security/policy";
import { getSoundCloudConfig } from "./config";
import type { SoundCloudCollection, SoundCloudComment, SoundCloudTrack, SoundCloudUser } from "./types";

export type SoundCloudClientOptions = {
  accessToken: string;
  maxRetries?: number;
};

export type TrackSearchParams = {
  q?: string;
  tags?: string;
  genres?: string;
  bpmFrom?: number;
  bpmTo?: number;
  durationFrom?: number;
  durationTo?: number;
  createdAtFrom?: string;
  createdAtTo?: string;
  limit?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendDefined(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value !== undefined && value !== "") params.set(key, String(value));
}

export class SoundCloudClient {
  private readonly apiBaseUrl = getSoundCloudConfig().apiBaseUrl;
  private readonly accessToken: string;
  private readonly maxRetries: number;

  constructor(options: SoundCloudClientOptions) {
    this.accessToken = options.accessToken;
    this.maxRetries = options.maxRetries ?? 3;
  }

  async request<T>(pathOrUrl: string, init: RequestInit = {}): Promise<T> {
    const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${this.apiBaseUrl}${pathOrUrl}`;
    assertReadOnlyResearch(url, init.method ?? "GET");

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const response = await fetch(url, {
        ...init,
        headers: {
          Authorization: `OAuth ${this.accessToken}`,
          Accept: "application/json",
          ...init.headers
        }
      });

      if (response.status === 429 && attempt < this.maxRetries) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        await sleep(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
        continue;
      }

      if (!response.ok) {
        throw new Error(`SoundCloud API request failed: ${response.status} ${await response.text()}`);
      }

      return (await response.json()) as T;
    }

    throw new Error("SoundCloud API request exhausted retries.");
  }

  async getMe() {
    return this.request<SoundCloudUser>("/me");
  }

  async getMyTracks(limit = 50) {
    return this.request<SoundCloudCollection<SoundCloudTrack>>(`/me/tracks?linked_partitioning=true&limit=${limit}`);
  }

  async getTrackComments(trackUrn: string, limit = 50) {
    return this.request<SoundCloudCollection<SoundCloudComment>>(
      `/tracks/${encodeURIComponent(trackUrn)}/comments?linked_partitioning=true&limit=${limit}`
    );
  }

  async getTrackFavoriters(trackUrn: string, limit = 50) {
    return this.request<SoundCloudCollection<SoundCloudUser>>(
      `/tracks/${encodeURIComponent(trackUrn)}/favoriters?linked_partitioning=true&limit=${limit}`
    );
  }

  async getTrackReposters(trackUrn: string, limit = 50) {
    return this.request<SoundCloudCollection<SoundCloudUser>>(
      `/tracks/${encodeURIComponent(trackUrn)}/reposters?linked_partitioning=true&limit=${limit}`
    );
  }

  async getRelatedTracks(trackUrn: string, limit = 50) {
    return this.request<SoundCloudCollection<SoundCloudTrack>>(
      `/tracks/${encodeURIComponent(trackUrn)}/related?linked_partitioning=true&limit=${limit}`
    );
  }

  async getRelatedUsers(userUrn: string, limit = 50) {
    return this.request<SoundCloudCollection<SoundCloudUser>>(
      `/users/${encodeURIComponent(userUrn)}/related?linked_partitioning=true&limit=${limit}`
    );
  }

  async searchTracks(params: TrackSearchParams) {
    const query = new URLSearchParams({ linked_partitioning: "true" });
    appendDefined(query, "q", params.q);
    appendDefined(query, "tags", params.tags);
    appendDefined(query, "genres", params.genres);
    appendDefined(query, "bpm[from]", params.bpmFrom);
    appendDefined(query, "bpm[to]", params.bpmTo);
    appendDefined(query, "duration[from]", params.durationFrom);
    appendDefined(query, "duration[to]", params.durationTo);
    appendDefined(query, "created_at[from]", params.createdAtFrom);
    appendDefined(query, "created_at[to]", params.createdAtTo);
    appendDefined(query, "limit", params.limit ?? 50);
    return this.request<SoundCloudCollection<SoundCloudTrack>>(`/tracks?${query.toString()}`);
  }
}

export async function paginateSoundCloud<T>(
  firstPage: SoundCloudCollection<T>,
  fetchPage: (nextHref: string) => Promise<SoundCloudCollection<T>>,
  maxPages = 10
) {
  const items = [...firstPage.collection];
  let nextHref = firstPage.next_href;
  let page = 1;

  while (nextHref && page < maxPages) {
    const next = await fetchPage(nextHref);
    items.push(...next.collection);
    nextHref = next.next_href;
    page += 1;
  }

  return items;
}
