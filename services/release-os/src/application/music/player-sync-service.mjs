import { audit } from "../../infrastructure/storage/json-store.mjs";

export function createPlayerSyncService({ store, playerClient, artistService }) {
  if (!store || !playerClient || !artistService) {
    throw new TypeError("player sync service requires store, playerClient, and artistService");
  }

  return Object.freeze({
    async syncRelease(releaseId) {
      const state = await store.read();
      const release = state.releases.find((entry) => entry.id === releaseId || entry.slug === releaseId);

      if (!release) {
        throw Object.assign(new Error(`Release not found: ${releaseId}`), {
          statusCode: 404,
          code: "RELEASE_NOT_FOUND"
        });
      }

      const assets = state.assets.filter((asset) => asset.releaseId === release.id);
      const artist = await artistService.getArtist(release.primaryArtistId);
      const mp3 = assets.find((asset) => asset.id === release.mp3AssetId);
      const wav = assets.find((asset) => asset.id === release.wavAssetId);
      const artwork = assets.find((asset) => asset.id === release.artworkAssetId);
      const entry = {
        releaseId: release.id,
        trackId: release.slug,
        title: release.title,
        artist: release.artistDisplayName,
        artistId: artist.id,
        artistSlug: artist.slug,
        genre: release.genre,
        tags: release.tags,
        visibility: release.visibility,
        playerUrl: playerClient.createPlayerUrl(release),
        mp3DownloadUrl: playerClient.createAudioUrl(mp3),
        wavDownloadUrl: playerClient.createAudioUrl(wav),
        artworkUrl: playerClient.createArtworkUrl(artwork),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const syncedEntry = await playerClient.upsertTrack(entry);
      await store.update((nextState) => {
        const index = nextState.playerEntries.findIndex((item) => item.releaseId === release.id);
        if (index >= 0) {
          nextState.playerEntries[index] = syncedEntry;
        } else {
          nextState.playerEntries.push(syncedEntry);
        }
        audit(nextState, "player.synced", { releaseId: release.id, trackId: syncedEntry.trackId });
      });

      return Object.freeze(syncedEntry);
    }
  });
}

