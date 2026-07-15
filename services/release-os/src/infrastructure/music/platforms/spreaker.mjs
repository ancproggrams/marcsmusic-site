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

const capability = getPlatformCapability("spreaker");

export const spreakerAdapter = Object.freeze({
  capability,
  async publish({ release, artist, platformAccount, action, dryRun, env = process.env, fetch, mediaRootDir }) {
    const request = {
      method: "POST",
      url: "https://api.spreaker.com/v2/shows/${SPREAKER_SHOW_ID}/episodes",
      auth: "Bearer ${SPREAKER_ACCESS_TOKEN}",
      formFields: ["media_file", "title", "description"]
    };

    if (dryRun) {
      return createPublicationResult({
        action,
        dryRun,
        status: "dry_run",
        message: "Spreaker episode upload is ready to execute with a show id and OAuth bearer token.",
        request
      });
    }

    if (!platformAccount && artist?.id) {
      return createPublicationResult({
        action,
        dryRun,
        status: "blocked",
        message: "Spreaker execution requires an artist Spreaker platform account/profile."
      });
    }

    const accessToken =
      env[artistCredentialName(artist, "SPREAKER_ACCESS_TOKEN")] ?? env.SPREAKER_ACCESS_TOKEN;
    const showId = env[artistCredentialName(artist, "SPREAKER_SHOW_ID")] ?? env.SPREAKER_SHOW_ID;

    if (!accessToken) {
      return missingCredentialResult(action, dryRun, "SPREAKER_ACCESS_TOKEN");
    }

    if (!showId) {
      return missingCredentialResult(action, dryRun, "SPREAKER_SHOW_ID");
    }

    const audioFile = await createMediaFile(release.audioSource, {
      fieldName: "audioSource",
      rootDir: mediaRootDir,
      env,
      fetch,
      requiredContentTypePrefix: "audio/"
    });
    const form = new FormData();
    form.append("media_file", audioFile.blob, audioFile.filename);
    form.append("title", release.title);
    appendIfPresent(form, "description", release.description);

    const providerResponse = await postFormData(
      fetch,
      `https://api.spreaker.com/v2/shows/${encodeURIComponent(showId)}/episodes`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: form,
        timeoutMs: env.MUSIC_PROVIDER_TIMEOUT_MS,
        maxResponseBytes: env.MUSIC_PROVIDER_MAX_RESPONSE_BYTES
      }
    );

    if (!providerResponse.ok) {
      return providerFailureResult(action, dryRun, providerResponse);
    }

    const episode = providerResponse.body?.response?.episode ?? providerResponse.body?.episode;

    return createPublicationResult({
      action,
      dryRun,
      status: "submitted",
      message: "Spreaker episode upload submitted successfully.",
      externalId: stringOrUndefined(episode?.episode_id ?? episode?.id),
      externalUrl: stringOrUndefined(episode?.site_url ?? episode?.permalink_url ?? episode?.url)
    });
  }
});

function artistCredentialName(artist, suffix) {
  return artist?.slug ? `ARTIST_${artist.slug.toUpperCase().replace(/[^A-Z0-9]+/gu, "_")}_${suffix}` : suffix;
}
