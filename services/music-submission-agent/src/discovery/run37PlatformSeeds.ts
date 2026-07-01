import type { PlatformInput } from '../models/types.js';

export const run37SeedPlatforms: PlatformInput[] = [
  {
    name: 'Jamendo Artist Upload and Licensing',
    websiteUrl: 'https://www.jamendo.com/',
    submissionUrl: 'https://artists.jamendo.com/',
    sourceUrl: 'https://artists.jamendo.com/',
    sourceType: 'automation_run_37_public_research',
    country: 'Global / independent artist streaming and music licensing platform',
    language: 'en',
    genres: [
      'electronic',
      'world',
      'reggae',
      'dub',
      'pop',
      'hip-hop',
      'instrumental',
      'sync',
      'in-store',
      'creator-licensing'
    ],
    submissionMethod: 'official-public-artist-account-upload-and-licensing-onboarding-route',
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Jamendo exposes an official artist-services route, but it requires account sign-in/start-now onboarding plus Creative Commons, PRO/collecting-society, licensing opt-in, Content ID and rights review before any catalog action.',
    notes:
      'Official Jamendo Artists page presents Jamendo Music, Licensing, In-Store, Content ID and promotion tools, with a sign-in/start-now flow. Public research also confirms Jamendo is a global independent-artist platform. No upload, account creation or licensing opt-in was attempted.'
  },
  {
    name: 'Free Music Archive / Tribe of Noise Curated Upload',
    websiteUrl: 'https://freemusicarchive.org/',
    submissionUrl: 'https://freemusicarchive.org/',
    sourceUrl: 'https://freemusicarchive.org/',
    sourceType: 'automation_run_37_public_research',
    country: 'Global / curated Creative Commons and royalty-free music archive',
    language: 'en',
    genres: [
      'electronic',
      'world',
      'reggae',
      'dub',
      'instrumental',
      'creative-commons',
      'royalty-free',
      'archive',
      'library',
      'sync-friendly'
    ],
    submissionMethod: 'official-public-curated-upload-permission-or-invitation-route',
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'FMA content is curated and upload/edit permission is invitation-based; license selection, attribution, rights ownership, Tribe of Noise/FMA policy fit and catalog suitability require manual owner review.',
    notes:
      'Publicly documented FMA/Tribe of Noise route is legitimate for curated Creative Commons and royalty-free music, but not a safe public auto-submit form. No account, invitation request or upload was attempted.'
  },
  {
    name: 'Audiomack Creator Upload',
    websiteUrl: 'https://audiomack.com/',
    submissionUrl: 'https://creators.audiomack.com/',
    sourceUrl: 'https://audiomack.com/',
    sourceType: 'automation_run_37_public_research',
    country: 'Global / streaming and audio discovery platform for artists and creators',
    language: 'en',
    genres: [
      'electronic',
      'hip-hop',
      'rap',
      'r-and-b',
      'afrobeats',
      'latin',
      'caribbean',
      'pop',
      'world',
      'creator-upload'
    ],
    submissionMethod: 'official-public-creator-upload-route-requiring-signup-or-signin',
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Audiomack exposes a creator upload route, but signup/signin, rights ownership, metadata, explicit-content status, copyright/fingerprint checks and creator profile setup require manual review before upload.',
    notes:
      'Official Audiomack page states it lets artists and creators upload limitless music and podcasts, exposes an Upload link and Sign Up/Sign In controls, and shows active 2026 content. No account or upload was attempted.'
  },
  {
    name: 'Bandcamp Artist Release Upload',
    websiteUrl: 'https://bandcamp.com/',
    submissionUrl: 'https://bandcamp.com/artists',
    sourceUrl: 'https://bandcamp.com/artists',
    sourceType: 'automation_run_37_public_research',
    country: 'Global / direct-to-fan artist store and music community',
    language: 'en',
    genres: [
      'electronic',
      'bass-music',
      'reggae',
      'dub',
      'world',
      'pop',
      'hip-hop',
      'independent-music',
      'direct-to-fan',
      'merch'
    ],
    submissionMethod: 'official-public-free-artist-account-and-release-store-route-with-revenue-share',
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Bandcamp artist accounts are free, but release upload requires desktop signup/login, pricing, PayPal/payout settings, metadata, artwork, rights, moderation and AI-policy review; paid Pro features must not be selected without owner approval.',
    notes:
      'Official Bandcamp for Artists page confirms free artist accounts, direct artist store, pricing control, revenue share and a Pro tier. Recent public reporting notes Bandcamp has an AI-generated music policy, so originality/AI review is mandatory. No signup, store setup or upload was attempted.'
  },
  {
    name: 'SoundClick Artist and Beat Producer Upload',
    websiteUrl: 'https://www.soundclick.com/',
    submissionUrl: 'https://www.soundclick.com/',
    sourceUrl: 'https://www.soundclick.com/',
    sourceType: 'automation_run_37_public_research',
    country: 'Global / independent music community, charts, beat licensing and full-song uploads',
    language: 'en',
    genres: [
      'electronic',
      'dance',
      'hip-hop',
      'rap',
      'reggaeton',
      'club-beats',
      'r-and-b',
      'pop',
      'world',
      'beats'
    ],
    submissionMethod: 'official-public-artist-signup-upload-license-and-sell-route',
    feeRequired: false,
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'SoundClick offers free artist tools and uploads, but signup/login, music licensing choices, store settings, download/stream settings, rights, explicit-content metadata and promo options require manual owner review.',
    notes:
      'Official SoundClick page says artists and beat producers can upload unlimited songs/beats, license and sell music, customize an artist page and join free. No account, upload, listing, license configuration or payment setup was attempted.'
  }
];
