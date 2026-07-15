import { getPlatformCapability } from "../../../domain/music/platform-capabilities.mjs";
import { createMediaFile } from "../media-source.mjs";
import {
  appendIfPresent,
  createPublicationResult,
  missingCredentialResult,
  postFormData,
  providerFailureResult,
  stringOrUndefined
} from "./result-helpers.mjs";

const capability = getPlatformCapability("soundcloud");
const DEFAULT_VISIBILITY = "private";

export const soundCloudAdapter = Object.freeze({
  capability,
  async publish({ release, artist, platformAccount, action, dryRun, env = process.env, fetch, mediaRootDir }) {
    const request = {
      method: "POST",
      url: "https://api.soundcloud.com/tracks",
      auth: "OAuth ${SOUNDCLOUD_ACCESS_TOKEN}",
      formFields: [
        "track[title]",
        "track[asset_data]",
        "track[description]",
        "track[genre]",
        "track[tag_list]",
        "track[sharing]"
      ]
    };

    if (dryRun) {
      return createPublicationResult({
        action,
        dryRun,
        status: "dry_run",
        message: "SoundCloud upload is ready to execute with a server-side OAuth access token.",
        request
      });
    }

    if (!platformAccount && artist?.id) {
      return createPublicationResult({
        action,
        dryRun,
        status: "blocked",
        message: "SoundCloud execution requires an artist SoundCloud platform account/profile."
      });
    }

    const accessToken =
      env[artistCredentialName(artist, "SOUNDCLOUD_ACCESS_TOKEN")] ?? env.SOUNDCLOUD_ACCESS_TOKEN;

    if (!accessToken) {
      return missingCredentialResult(action, dryRun, "SOUNDCLOUD_ACCESS_TOKEN");
    }

    const audioFile = await createMediaFile(release.audioSource, {
      fieldName: "audioSource",
      rootDir: mediaRootDir,
      env,
      fetch,
      requiredContentTypePrefix: "audio/"
    });
    const form = new FormData();
    form.append("track[title]", release.title);
    form.append("track[asset_data]", audioFile.blob, audioFile.filename);
    appendIfPresent(form, "track[description]", release.description);
    appendIfPresent(form, "track[genre]", release.genre);
    appendIfPresent(form, "track[tag_list]", release.tags?.join(" "));
    form.append("track[sharing]", release.visibility === "public" ? "public" : DEFAULT_VISIBILITY);

    const providerResponse = await postFormData(fetch, request.url, {
      headers: {
        Authorization: `OAuth ${accessToken}`
      },
      body: form,
      timeoutMs: env.MUSIC_PROVIDER_TIMEOUT_MS,
      maxResponseBytes: env.MUSIC_PROVIDER_MAX_RESPONSE_BYTES
    });

    if (!providerResponse.ok) {
      return providerFailureResult(action, dryRun, providerResponse);
    }

    return createPublicationResult({
      action,
      dryRun,
      status: "submitted",
      message: "SoundCloud upload submitted successfully.",
      externalId: stringOrUndefined(providerResponse.body?.id),
      externalUrl: stringOrUndefined(providerResponse.body?.permalink_url)
    });
  }
});

function artistCredentialName(artist, suffix) {
  return artist?.slug ? `ARTIST_${artist.slug.toUpperCase().replace(/[^A-Z0-9]+/gu, "_")}_${suffix}` : suffix;
}
