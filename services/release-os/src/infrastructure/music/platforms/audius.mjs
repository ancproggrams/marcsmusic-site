import { getPlatformCapability } from "../../../domain/music/platform-capabilities.mjs";
import { createPublicationResult } from "./result-helpers.mjs";

const capability = getPlatformCapability("audius");

export const audiusAdapter = Object.freeze({
  capability,
  async publish({ release, action, dryRun }) {
    return createPublicationResult({
      action,
      dryRun,
      status: dryRun ? "dry_run" : "blocked",
      message: dryRun
        ? "Audius upload is represented as exact SDK steps. Real execution is blocked until this repo moves to Node >=22 or an SDK-compatible runtime is isolated."
        : "Audius execution is blocked because @audius/sdk@15.x requires Node >=22 while this repo currently supports Node >=20.12.",
      request: {
        sdk: "@audius/sdk",
        docs: "https://docs.audius.co/sdk/uploads",
        requiredCredentialEnv: ["AUDIUS_API_KEY", "AUDIUS_BEARER_TOKEN"],
        steps: [
          "Resolve an authenticated Audius user context.",
          "Upload the audio file with sdk.createAudioUpload.",
          "Upload artwork with sdk.createImageUpload when coverArtSource is present.",
          "Create the track with sdk.tracks.createTrack using title, genre, tags, description, and CIDs."
        ],
        release: {
          title: release.title,
          artist: release.artist,
          hasCoverArt: Boolean(release.coverArtSource)
        }
      }
    });
  }
});

