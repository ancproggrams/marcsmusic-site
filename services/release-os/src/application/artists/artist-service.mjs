import {
  DEFAULT_ARTIST,
  createReleaseArtistDisplayName,
  normalizeArtistInput
} from "../../domain/artists/artist-model.mjs";
import { audit } from "../../infrastructure/storage/json-store.mjs";

export function createArtistService({ store }) {
  if (!store || typeof store.read !== "function" || typeof store.update !== "function") {
    throw new TypeError("artist service requires a JsonStore-like store");
  }

  return Object.freeze({
    async listArtists() {
      const state = await ensureDefaultArtist(store);
      return state.artists;
    },

    async getArtist(artistId) {
      const state = await ensureDefaultArtist(store);
      const artist = state.artists.find((entry) => entry.id === artistId || entry.slug === artistId);

      if (!artist) {
        throw Object.assign(new Error(`Artist not found: ${artistId}`), {
          statusCode: 404,
          code: "ARTIST_NOT_FOUND"
        });
      }

      return artist;
    },

    async createArtist(input) {
      return store.update((state) => {
        ensureDefaultArtistInState(state);
        const artist = normalizeArtistInput(input);

        if (state.artists.some((entry) => entry.slug === artist.slug)) {
          throw Object.assign(new Error(`Artist slug already exists: ${artist.slug}`), {
            statusCode: 409,
            code: "ARTIST_SLUG_EXISTS"
          });
        }

        state.artists.push(artist);
        audit(state, "artist.created", { artistId: artist.id, slug: artist.slug });
        return artist;
      });
    },

    async updateArtist(artistId, input) {
      return store.update((state) => {
        ensureDefaultArtistInState(state);
        const index = state.artists.findIndex((entry) => entry.id === artistId || entry.slug === artistId);

        if (index < 0) {
          throw Object.assign(new Error(`Artist not found: ${artistId}`), {
            statusCode: 404,
            code: "ARTIST_NOT_FOUND"
          });
        }

        const next = normalizeArtistInput({
          ...state.artists[index],
          ...input,
          id: state.artists[index].id,
          createdAt: state.artists[index].createdAt
        });
        state.artists[index] = next;
        audit(state, "artist.updated", { artistId: next.id, slug: next.slug });
        return next;
      });
    },

    async resolveReleaseArtists(input = {}) {
      const state = await ensureDefaultArtist(store);
      const primaryArtistId = input.primaryArtistId ?? input.artistId ?? DEFAULT_ARTIST.id;
      const primaryArtist = findArtistOrThrow(state.artists, primaryArtistId);
      const featuredArtists = (input.featuredArtistIds ?? [])
        .map((artistId) => findArtistOrThrow(state.artists, artistId));

      return Object.freeze({
        primaryArtist,
        featuredArtists: Object.freeze(featuredArtists),
        artistDisplayName:
          input.artistDisplayName ??
          createReleaseArtistDisplayName({
            primaryArtist,
            featuredArtists
          })
      });
    }
  });
}

export async function ensureDefaultArtist(store) {
  return store.update((state) => {
    ensureDefaultArtistInState(state);
    return state;
  });
}

function ensureDefaultArtistInState(state) {
  state.artists ??= [];

  if (!state.artists.some((artist) => artist.id === DEFAULT_ARTIST.id || artist.slug === DEFAULT_ARTIST.slug)) {
    const now = new Date().toISOString();
    state.artists.unshift({
      ...DEFAULT_ARTIST,
      biographyByLanguage: {},
      defaultVisibility: "private",
      createdAt: now,
      updatedAt: now
    });
  }
}

function findArtistOrThrow(artists, artistId) {
  const artist = artists.find((entry) => entry.id === artistId || entry.slug === artistId);

  if (!artist) {
    throw Object.assign(new Error(`Artist not found: ${artistId}`), {
      statusCode: 404,
      code: "ARTIST_NOT_FOUND"
    });
  }

  return artist;
}

