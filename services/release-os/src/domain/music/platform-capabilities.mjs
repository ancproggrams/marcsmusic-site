const DIRECT_UPLOAD = "direct_upload";
const POSSIBLE_WRITE_API = "possible_write_api";
const METADATA_OR_SOCIAL = "metadata_or_social";
const RESTRICTED_PARTNER_API = "restricted_partner_api";
const MANUAL_ONLY = "manual_only";
const DISTRIBUTION_ONLY = "distribution_only";

export const MARCSMUSIC_RELEASE_PLATFORM_IDS = Object.freeze([
  "audiomack",
  "audius",
  "bandcamp",
  "bandlab",
  "drooble",
  "hearthis",
  "hypeddit",
  "jamendo",
  "linktree",
  "n1m",
  "podomatic",
  "reverbnation",
  "soundclick",
  "soundcloud",
  "spreaker"
]);

const PLATFORM_CAPABILITIES = Object.freeze([
  {
    id: "soundcloud",
    name: "SoundCloud",
    category: "music_host",
    observedOnRailway: true,
    credentialEnvPrefix: "MUSIC_SOUNDCLOUD",
    officialApiStatus: DIRECT_UPLOAD,
    uploadSupport: "track_upload",
    canAutoPost: true,
    authType: "oauth2_pkce",
    apiUrl: "https://developers.soundcloud.com/docs/api/guide",
    postingModes: ["upload_track", "update_metadata", "create_playlist"],
    requiredCredentialEnv: [
      "SOUNDCLOUD_ACCESS_TOKEN",
      "SOUNDCLOUD_CLIENT_ID",
      "SOUNDCLOUD_CLIENT_SECRET",
      "SOUNDCLOUD_REDIRECT_URI",
      "SOUNDCLOUD_REFRESH_TOKEN"
    ],
    requirements: ["audio file", "title"],
    notes: [
      "Official API supports multipart track upload to /tracks.",
      "Audio cannot be replaced after upload; metadata can be edited."
    ]
  },
  {
    id: "audius",
    name: "Audius",
    category: "music_host",
    observedOnRailway: true,
    credentialEnvPrefix: "MUSIC_AUDIUS",
    officialApiStatus: DIRECT_UPLOAD,
    uploadSupport: "track_upload",
    canAutoPost: true,
    authType: "api_key_and_backend_bearer_token",
    apiUrl: "https://docs.audius.co/sdk/",
    postingModes: ["upload_track", "update_metadata", "favorite", "repost", "playlist"],
    requiredCredentialEnv: ["AUDIUS_API_KEY", "AUDIUS_BEARER_TOKEN"],
    requirements: ["audio file", "title", "artist account authorization"],
    notes: [
      "Official SDK supports track uploads and user-scoped actions.",
      "Bearer token must stay server-side."
    ]
  },
  {
    id: "mixcloud",
    name: "Mixcloud",
    category: "show_host",
    observedOnRailway: true,
    credentialEnvPrefix: "MUSIC_MIXCLOUD",
    officialApiStatus: DIRECT_UPLOAD,
    uploadSupport: "show_upload",
    canAutoPost: true,
    authType: "oauth_access_token",
    apiUrl: "https://www.mixcloud.com/developers/",
    postingModes: ["upload_show"],
    requiredCredentialEnv: ["MIXCLOUD_ACCESS_TOKEN"],
    requirements: ["mp3 file", "name"],
    notes: [
      "Official API uploads shows via one multipart/form-data POST to /upload/.",
      "Pro-only fields include scheduled publish dates and host tagging."
    ]
  },
  {
    id: "spreaker",
    name: "Spreaker",
    category: "podcast_host",
    observedOnRailway: true,
    credentialEnvPrefix: "MUSIC_SPREAKER",
    officialApiStatus: DIRECT_UPLOAD,
    uploadSupport: "episode_upload",
    canAutoPost: true,
    authType: "oauth_bearer",
    apiUrl: "https://developers.spreaker.com/api/episodes/",
    postingModes: ["upload_episode", "create_draft", "update_episode"],
    requiredCredentialEnv: ["SPREAKER_ACCESS_TOKEN", "SPREAKER_SHOW_ID"],
    requirements: ["audio file", "title", "show id"],
    notes: [
      "Official API supports POST /v2/shows/SHOW-ID/episodes with media_file.",
      "Useful for podcast/RSS distribution, not a normal music-streaming catalog."
    ]
  },
  {
    id: "youtube",
    name: "YouTube",
    category: "video_host",
    observedOnRailway: false,
    credentialEnvPrefix: "YOUTUBE",
    officialApiStatus: DIRECT_UPLOAD,
    uploadSupport: "video_upload",
    canAutoPost: true,
    authType: "oauth2",
    apiUrl: "https://developers.google.com/youtube/v3/guides/uploading_a_video",
    postingModes: ["upload_video"],
    requiredCredentialEnv: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"],
    requirements: ["video file", "title", "description"],
    notes: [
      "Official YouTube Data API supports video upload with metadata.",
      "Use for music videos, visualizers, lyric videos, or shorts, not audio-only releases."
    ]
  },
  {
    id: "jamendo",
    name: "Jamendo",
    category: "music_catalog",
    observedOnRailway: true,
    credentialEnvPrefix: "MUSIC_JAMENDO",
    officialApiStatus: POSSIBLE_WRITE_API,
    uploadSupport: "requires_contract_check",
    canAutoPost: false,
    authType: "oauth2",
    apiUrl: "https://devportal.jamendo.com/",
    postingModes: ["catalog_read", "limited_write"],
    requiredCredentialEnv: ["JAMENDO_CLIENT_ID", "JAMENDO_CLIENT_SECRET"],
    requirements: ["Jamendo read/write plan", "explicit user-initiated action"],
    notes: [
      "Developer portal offers read-only and read/write plans.",
      "Confirm current upload/write endpoints and rights terms before automating release delivery."
    ]
  },
  {
    id: "audiomack",
    name: "Audiomack",
    category: "music_host",
    observedOnRailway: true,
    credentialEnvPrefix: "MUSIC_AUDIOMACK",
    officialApiStatus: METADATA_OR_SOCIAL,
    uploadSupport: "no_confirmed_public_upload_endpoint",
    canAutoPost: false,
    authType: "oauth1_for_data_api",
    apiUrl: "https://audiomack.com/data-api/docs",
    postingModes: ["read_uploads", "playlist", "favorite", "repost", "follow"],
    requiredCredentialEnv: ["AUDIOMACK_CONSUMER_KEY", "AUDIOMACK_CONSUMER_SECRET"],
    requirements: ["creator account for manual upload or separate upload access"],
    notes: [
      "Data API covers catalog, playlists, favorites, reposts, follows, and user uploads.",
      "The public Data API docs do not expose a current music upload endpoint."
    ]
  },
  {
    id: "bandcamp",
    name: "Bandcamp",
    category: "music_store",
    observedOnRailway: true,
    credentialEnvPrefix: "MUSIC_BANDCAMP",
    officialApiStatus: RESTRICTED_PARTNER_API,
    uploadSupport: "restricted_no_public_upload_endpoint",
    canAutoPost: false,
    authType: "oauth2_partner",
    apiUrl: "https://bandcamp.com/developer",
    postingModes: ["account", "sales_report", "merch_orders"],
    requiredCredentialEnv: ["BANDCAMP_CLIENT_ID", "BANDCAMP_CLIENT_SECRET"],
    requirements: ["Bandcamp-granted API access"],
    notes: [
      "Official API access is for labels and merchandise fulfillment partners.",
      "Current public docs do not document track upload automation."
    ]
  },
  manualPlatform("bandlab", "BandLab", "MUSIC_BANDLAB", "music_creation"),
  manualPlatform("drooble", "Drooble", "MUSIC_DROOBLE", "music_social"),
  manualPlatform("fandalism", "Fandalism", "MUSIC_FANDALISM", "music_social"),
  manualPlatform("hearthis", "HearThis", "MUSIC_HEARTHIS", "music_host"),
  manualPlatform("hypeddit", "Hypeddit", "MUSIC_HYPEDDIT", "promotion"),
  manualPlatform("linktree", "Linktree", "MUSIC_LINKTREE", "link_hub"),
  manualPlatform("n1m", "N1M", "MUSIC_N1M", "music_host"),
  manualPlatform("podomatic", "Podomatic", "MUSIC_PODOMATIC", "podcast_host"),
  manualPlatform("reverbnation", "ReverbNation", "MUSIC_REVERBNATION", "music_host"),
  manualPlatform("soundclick", "SoundClick", "MUSIC_SOUNDCLICK", "music_host"),
  manualPlatform("vowave", "Vowave", "MUSIC_VOWAVE", "music_host"),
  {
    id: "spotify",
    name: "Spotify",
    category: "streaming_dsp",
    observedOnRailway: false,
    credentialEnvPrefix: "SPOTIFY",
    officialApiStatus: DISTRIBUTION_ONLY,
    uploadSupport: "audio_via_distributor",
    canAutoPost: false,
    authType: "oauth2_for_web_api",
    apiUrl: "https://developer.spotify.com/documentation/web-api",
    postingModes: ["catalog_read", "playlist", "library", "playback"],
    requiredCredentialEnv: ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"],
    requirements: ["distributor for audio releases"],
    notes: [
      "Spotify Web API can manage playlists and library items.",
      "Audio delivery to Spotify is handled by distributors, not public Web API upload."
    ]
  },
  {
    id: "apple_music",
    name: "Apple Music",
    category: "streaming_dsp",
    observedOnRailway: false,
    credentialEnvPrefix: "APPLE_MUSIC",
    officialApiStatus: DISTRIBUTION_ONLY,
    uploadSupport: "audio_via_distributor",
    canAutoPost: false,
    authType: "developer_token_and_user_token",
    apiUrl: "https://developer.apple.com/musickit/",
    postingModes: ["catalog_read", "library", "playlist"],
    requiredCredentialEnv: ["APPLE_MUSIC_TEAM_ID", "APPLE_MUSIC_KEY_ID", "APPLE_MUSIC_PRIVATE_KEY"],
    requirements: ["distributor or label delivery path for audio releases"],
    notes: [
      "Apple Music API is for catalog, playback, library, and playlist features.",
      "It is not a public artist audio upload API."
    ]
  },
  distributionPlatform("deezer", "Deezer", "DEEZER", "https://developers.deezer.com/api"),
  distributionPlatform("tidal", "Tidal", "TIDAL", undefined),
  distributionPlatform("amazon_music", "Amazon Music", "AMAZON_MUSIC", undefined),
  distributionPlatform("qobuz", "Qobuz", "QOBUZ", undefined)
].map(freezeCapability));

const PLATFORM_BY_ID = new Map(PLATFORM_CAPABILITIES.map((platform) => [platform.id, platform]));

export function listPlatformCapabilities(options = {}) {
  const observedOnly = Boolean(options.observedOnly);
  const autoPostOnly = Boolean(options.autoPostOnly);

  return PLATFORM_CAPABILITIES.filter((platform) => {
    if (observedOnly && !platform.observedOnRailway) {
      return false;
    }

    if (autoPostOnly && !platform.canAutoPost) {
      return false;
    }

    return true;
  });
}

export function getPlatformCapability(platformId) {
  const normalizedId = normalizePlatformId(platformId);
  return PLATFORM_BY_ID.get(normalizedId);
}

export function requirePlatformCapability(platformId) {
  const platform = getPlatformCapability(platformId);

  if (!platform) {
    throw new TypeError(`Unsupported music platform: ${platformId}`);
  }

  return platform;
}

export function normalizePlatformId(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("platform id must be a non-empty string");
  }

  return value.trim().toLowerCase().replace(/\s+/gu, "_");
}

function manualPlatform(id, name, credentialEnvPrefix, category) {
  return {
    id,
    name,
    category,
    observedOnRailway: true,
    credentialEnvPrefix,
    officialApiStatus: MANUAL_ONLY,
    uploadSupport: "manual_or_browser_workflow",
    canAutoPost: false,
    authType: "account_credentials_or_session",
    apiUrl: undefined,
    postingModes: ["manual_upload", "profile_update"],
    requiredCredentialEnv: [],
    requirements: ["manual account workflow"],
    notes: [
      "No current official public upload API was confirmed.",
      "Avoid password-based automation unless platform terms explicitly allow it."
    ]
  };
}

function distributionPlatform(id, name, credentialEnvPrefix, apiUrl) {
  return {
    id,
    name,
    category: "streaming_dsp",
    observedOnRailway: false,
    credentialEnvPrefix,
    officialApiStatus: DISTRIBUTION_ONLY,
    uploadSupport: "audio_via_distributor",
    canAutoPost: false,
    authType: "varies",
    apiUrl,
    postingModes: ["catalog_read_or_playlist_when_available"],
    requiredCredentialEnv: [],
    requirements: ["music distributor, label, or delivery partner"],
    notes: [
      "Treat as downstream distributor delivery, not a direct upload target."
    ]
  };
}

function freezeCapability(platform) {
  return Object.freeze({
    ...platform,
    postingModes: Object.freeze([...platform.postingModes]),
    requiredCredentialEnv: Object.freeze([...platform.requiredCredentialEnv]),
    requirements: Object.freeze([...platform.requirements]),
    notes: Object.freeze([...platform.notes])
  });
}
