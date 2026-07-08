import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

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
  }

  createAudioUrl(asset) {
    return asset ? `${this.downloadBaseUrl}/${encodeURIComponent(asset.storageFilename)}` : undefined;
  }

  createArtworkUrl(asset) {
    return asset ? `${this.artworkBaseUrl}/${encodeURIComponent(asset.storageFilename)}` : undefined;
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

    await mkdir(dirname(this.manifestPath), { recursive: true });
    const tmpPath = `${this.manifestPath}.${process.pid}.tmp`;
    await writeFile(tmpPath, JSON.stringify(manifest, null, 2), "utf8");
    await rename(tmpPath, this.manifestPath);

    return manifest.tracks.find((track) => track.releaseId === entry.releaseId);
  }
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/u, "");
}

