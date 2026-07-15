import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { withExclusiveFileMutation, writeJsonAtomically } from "../storage/atomic-json-file.mjs";

export class PlayerManifestClient {
  constructor(options = {}) {
    this.manifestPath = resolve(
      options.manifestPath ??
        process.env.MARCSMUSIC_PLAYER_MANIFEST_PATH ??
        join(process.cwd(), "data", "player-manifest.json")
    );
    this.siteBaseUrl = stripTrailingSlash(
      options.siteBaseUrl ?? process.env.MARCSMUSIC_SITE_BASE_URL ?? "https://www.marcsmusic.nl"
    );
    this.downloadBaseUrl = stripTrailingSlash(
      options.downloadBaseUrl ?? process.env.MARCSMUSIC_DOWNLOAD_BASE_URL ?? "/assets/audio"
    );
    this.artworkBaseUrl = stripTrailingSlash(
      options.artworkBaseUrl ?? process.env.MARCSMUSIC_ARTWORK_BASE_URL ?? "/assets/artwork"
    );
    this.assetUrlSigner = options.assetUrlSigner;
    this.lockOptions = {
      lockTimeoutMs: options.lockTimeoutMs ?? process.env.MUSIC_FILE_LOCK_TIMEOUT_MS,
      lockLeaseMs: options.lockLeaseMs ?? process.env.MUSIC_FILE_LOCK_LEASE_MS
    };
  }

  createAudioUrl(asset) {
    return asset
      ? this.signAssetPath(`${this.downloadBaseUrl}/${encodeURIComponent(asset.storageFilename)}`)
      : undefined;
  }

  createArtworkUrl(asset) {
    return asset
      ? this.signAssetPath(`${this.artworkBaseUrl}/${encodeURIComponent(asset.storageFilename)}`)
      : undefined;
  }

  signAssetPath(pathname) {
    if (!this.assetUrlSigner) {
      throw Object.assign(new Error("Private asset URL signing is not configured safely."), {
        statusCode: 503,
        code: "ASSET_SIGNING_NOT_CONFIGURED"
      });
    }
    return this.assetUrlSigner.signPath(pathname);
  }

  createPlayerUrl(release) {
    return `${this.siteBaseUrl}/#listen`;
  }

  async readManifest() {
    try {
      const raw = await readFile(this.manifestPath, "utf8");
      const parsed = JSON.parse(raw);
      return {
        version: parsed.version ?? 1,
        tracks: Array.isArray(parsed.tracks) ? parsed.tracks : []
      };
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }

      return { version: 1, tracks: [] };
    }
  }

  async upsertTrack(entry) {
    return withExclusiveFileMutation(this.manifestPath, async (lease) => {
      const manifest = await this.readManifest();
      const index = manifest.tracks.findIndex((track) => track.releaseId === entry.releaseId);

      if (index >= 0) {
        manifest.tracks[index] = {
          ...manifest.tracks[index],
          ...entry,
          updatedAt: new Date().toISOString()
        };
      } else {
        manifest.tracks.push(entry);
      }

      await writeJsonAtomically(this.manifestPath, manifest, { assertLease: lease.assertOwned });

      return manifest.tracks.find((track) => track.releaseId === entry.releaseId);
    }, this.lockOptions);
  }
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/u, "");
}
