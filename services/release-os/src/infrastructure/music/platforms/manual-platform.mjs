import { getPlatformCapability } from "../../../domain/music/platform-capabilities.mjs";
import { createManualTask, createPublicationResult, workflow } from "./result-helpers.mjs";

const DEFAULT_WORKFLOWS = Object.freeze({
  audiomack: workflow("manual_upload", "https://audiomack.com/upload", [
    "Open the creator upload flow.",
    "Upload the audio file and artwork.",
    "Apply canonical title, artist, genre, description, tags, and release date.",
    "Save as draft or publish, then store the final Audiomack URL on the release record."
  ]),
  bandcamp: workflow("manual_store_release", "https://bandcamp.com/", [
    "Open the artist dashboard.",
    "Create a track or album release.",
    "Upload the master audio and artwork.",
    "Set price, licensing, download, lyrics, tags, and publication date.",
    "Publish or save draft, then store the Bandcamp URL on the release record."
  ]),
  bandlab: workflow("manual_upload", "https://www.bandlab.com/", [
    "Open the BandLab library or profile publishing flow.",
    "Upload the final audio file.",
    "Apply title, description, genre, artwork, and tags.",
    "Publish, then store the BandLab URL on the release record."
  ]),
  drooble: workflow("manual_social_post", "https://drooble.com/", [
    "Open the artist profile.",
    "Create a music upload or release post.",
    "Attach the audio file, artwork, metadata, and external release links.",
    "Publish, then store the Drooble URL on the release record."
  ]),
  hearthis: workflow("manual_upload", "https://hearthis.at/upload/", [
    "Open the HearThis upload page.",
    "Upload the audio file and artwork.",
    "Set title, artist, genre, description, tags, visibility, and release date.",
    "Publish or save draft, then store the HearThis URL on the release record."
  ]),
  hypeddit: workflow("manual_promo_campaign", "https://hypeddit.com/", [
    "Open the Hypeddit dashboard.",
    "Create a download gate, smart link, or promotion for the release.",
    "Attach the release URL, artwork, title, artist, and campaign copy.",
    "Publish the campaign, then store the Hypeddit URL on the release record."
  ]),
  linktree: workflow("manual_link_update", "https://linktr.ee/admin", [
    "Open Linktree admin.",
    "Create or update the release link.",
    "Use the canonical release title, artwork, and destination URL.",
    "Publish the link, then store the Linktree URL on the release record."
  ]),
  n1m: workflow("manual_upload", "https://www.n1m.com/", [
    "Open the N1M artist dashboard.",
    "Upload the audio file and artwork.",
    "Apply title, artist, genre, description, and tags.",
    "Publish, then store the N1M URL on the release record."
  ]),
  podomatic: workflow("manual_episode_upload", "https://www.podomatic.com/manage/episodes/new", [
    "Open the Podomatic episode editor.",
    "Upload the audio file and artwork.",
    "Apply episode title, description, tags, category, and publication settings.",
    "Publish or save draft, then store the Podomatic URL on the release record."
  ]),
  reverbnation: workflow("manual_upload", "https://www.reverbnation.com/", [
    "Open the artist control room.",
    "Upload the song and artwork.",
    "Apply canonical metadata and visibility settings.",
    "Publish, then store the ReverbNation URL on the release record."
  ]),
  soundclick: workflow("manual_upload", "https://www.soundclick.com/", [
    "Open the SoundClick artist dashboard.",
    "Upload the audio file and artwork.",
    "Apply title, artist, genre, description, lyrics, and tags.",
    "Publish, then store the SoundClick URL on the release record."
  ])
});

export function createManualPlatformAdapter(platformId, options = {}) {
  const capability = getPlatformCapability(platformId);

  if (!capability) {
    throw new TypeError(`Unsupported manual platform: ${platformId}`);
  }

  const workflowDefinition =
    options.workflow ?? DEFAULT_WORKFLOWS[platformId] ?? workflow("manual_review", capability.apiUrl, [
      "Review current provider documentation and terms.",
      "Complete the provider-specific release workflow manually.",
      "Store the final external URL on the release record."
    ]);

  return Object.freeze({
    capability,
    async publish({ release, action, dryRun, artist, platformAccount }) {
      const missingArtistAccount = !platformAccount && capability.canAutoPost;
      return createPublicationResult({
        action,
        dryRun,
        status: missingArtistAccount ? "blocked" : "manual_task",
        message: missingArtistAccount
          ? `${capability.name} is missing an artist platform account/profile.`
          : `${capability.name} has no confirmed safe public upload API. A manual workflow task was created.`,
        manualTask: createManualTask(capability, release, action, workflowDefinition, {
          artist,
          missingArtistAccount
        })
      });
    }
  });
}

export { DEFAULT_WORKFLOWS };

