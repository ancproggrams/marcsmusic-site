import type { PlatformInput } from '../models/types.js';
import { run141SeedPlatforms } from './run141PlatformSeeds.js';

const run140StandaloneSeedPlatforms: PlatformInput[] = [
  {
    name: "Amazing Radio Emerging Artist Upload and Airplay Discovery Route",
    websiteUrl: "https://amazingradio.com/",
    submissionUrl: "https://amazingradio.com/",
    sourceUrl: "https://amazingradio.com/",
    sourceType: "automation_run_140_public_research",
    country: "United Kingdom / United States / global emerging-artist online radio and discovery platform",
    language: "en",
    genres: ["amazing-radio", "emerging-artists", "radio-airplay", "artist-upload", "manual-review"],
    submissionMethod: "official-amazing-radio-emerging-artist-upload-airplay-route",
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Manual review required for account/session, track-rights, metadata and airplay-fit choices.",
    notes: "Run 140 standalone route preserved; no login, upload or submission was performed."
  },
  {
    name: "DistroKid Distribution Playlister HyperFollow and Release Upload Route",
    websiteUrl: "https://distrokid.com/",
    submissionUrl: "https://distrokid.com/",
    sourceUrl: "https://distrokid.com/",
    sourceType: "automation_run_140_public_research",
    country: "United States / global independent digital music distribution and artist tools platform",
    language: "en",
    genres: ["distrokid", "digital-distribution", "release-upload", "payment-required", "account-required", "manual-review"],
    submissionMethod: "official-distrokid-distribution-playlister-release-upload-route",
    feeRequired: true,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: true,
    manualReviewRequired: true,
    manualReviewReason: "Manual review required for subscription, release upload, rights, splits, cover licensing, platform delivery and promo-tool choices.",
    notes: "Run 140 standalone route preserved; no login, release setup, delivery selection or payment was performed."
  },
  {
    name: "TopHit Radio TV Music Upload Testing and Airplay Distribution Route",
    websiteUrl: "https://tophit.com/",
    submissionUrl: "https://tophit.com/",
    sourceUrl: "https://tophit.com/",
    sourceType: "automation_run_140_public_research",
    country: "United States / Europe / CIS / international radio, TV, chart, airplay-monitoring and music-distribution platform",
    language: "en/ru/uk/es/de/pl/lt/lv/et/ro",
    genres: ["tophit", "radio-distribution", "tv-distribution", "music-upload", "account-required", "manual-review"],
    submissionMethod: "official-tophit-radio-tv-music-upload-testing-airplay-route",
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Manual review required for rights-holder registration, upload/testing workflow, territory fit and commercial terms.",
    notes: "Run 140 standalone route preserved; no registration, login, upload or testing workflow was entered."
  },
  {
    name: "SoundClick Artist Upload Store Licensing and Genre Chart Route",
    websiteUrl: "https://www.soundclick.com/",
    submissionUrl: "https://www.soundclick.com/",
    sourceUrl: "https://www.soundclick.com/",
    sourceType: "automation_run_140_public_research",
    country: "United States / global music social community, artist upload, store, licensing and genre-chart platform",
    language: "en",
    genres: ["soundclick", "artist-upload", "music-store", "licensing", "account-required", "manual-review"],
    submissionMethod: "official-soundclick-artist-upload-store-licensing-genre-chart-route",
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Manual review required for account setup, upload, stream/download/store/licensing settings, genre routing and optional VIP choices.",
    notes: "Run 140 standalone route preserved; no account, upload, store setup or payment-side route was entered."
  },
  {
    name: "TIDAL Upload Direct Artist Self Publishing and Spotlight Review Route",
    websiteUrl: "https://tidal.com/",
    submissionUrl: "https://tidal.com/",
    sourceUrl: "https://tidal.com/",
    sourceType: "automation_run_140_public_research",
    country: "United States eligibility boundary / TIDAL direct artist upload, private sharing and editorial spotlight route",
    language: "en",
    genres: ["tidal-upload", "direct-upload", "artist-self-publishing", "eligibility-boundary", "account-required", "manual-review"],
    submissionMethod: "official-tidal-upload-direct-artist-self-publishing-spotlight-route",
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason: "Manual review required for account/session, eligibility, rights ownership, metadata, public/private sharing, editorial context and policy decisions.",
    notes: "Run 140 standalone route preserved; no login, eligibility flow, upload or sharing route was activated."
  }
];

export const run140SeedPlatforms: PlatformInput[] = [
  ...run140StandaloneSeedPlatforms,
  ...run141SeedPlatforms
];
