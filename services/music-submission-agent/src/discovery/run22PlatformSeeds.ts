import type { PlatformInput } from '../models/types.js';

export const run22SeedPlatforms: PlatformInput[] = [
  {
    name: 'BBC Music Introducing UK Upload Route',
    websiteUrl: 'https://www.bbc.co.uk/introducing',
    submissionUrl: 'https://www.bbc.co.uk/introducing/uploader',
    sourceUrl: 'https://www.bbc.co.uk/introducing',
    sourceType: 'automation_run_22_public_research',
    country: 'United Kingdom / local BBC Introducing network',
    language: 'en',
    genres: ['electronic', 'dance', 'reggae', 'world', 'pop', 'hip-hop', 'indie'],
    submissionMethod: 'authenticated-public-uploader-needs-uk-postcode-and-rights-review',
    feeRequired: false,
    loginRequired: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'BBC Introducing is account-gated and UK-locality/postcode based; verify artist eligibility, account access, UGC terms, track ownership and local show routing before upload.',
    notes:
      'Public research verifies BBC Music Introducing as an active UK unsigned/under-the-radar upload platform. No login, upload or account action attempted.'
  },
  {
    name: 'Triple J Unearthed Australia Artist Upload Route',
    websiteUrl: 'https://www.abc.net.au/triplejunearthed',
    submissionUrl: 'https://www.abc.net.au/triplejunearthed',
    sourceUrl: 'https://www.abc.net.au/triplejunearthed',
    sourceType: 'automation_run_22_public_research',
    country: 'Australia / ABC triple j Unearthed',
    language: 'en',
    genres: ['electronic', 'dance', 'pop', 'hip-hop', 'indie', 'rock', 'beats'],
    submissionMethod: 'artist-profile-track-upload-route-needs-account-region-and-rights-review',
    feeRequired: false,
    loginRequired: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Requires account/profile workflow and likely Australian artist eligibility; verify region, rights ownership, explicit tags and ABC terms before upload.',
    notes:
      'Official ABC page is active in 2026, showing featured artists, staff reviews, track pages and electronic/dance material. No sign-up or upload attempted.'
  },
  {
    name: 'Amazing Radio Emerging Artist Upload Route',
    websiteUrl: 'https://amazingradio.com/',
    submissionUrl: 'https://amazingradio.com/',
    sourceUrl: 'https://amazingradio.com/',
    sourceType: 'automation_run_22_public_research',
    country: 'United Kingdom / United States / international online radio',
    language: 'en',
    genres: ['new-music', 'electronic', 'dance', 'pop', 'indie', 'hip-hop', 'alternative'],
    submissionMethod: 'artist-upload-radio-airplay-route-needs-js-account-and-rights-review',
    feeRequired: false,
    loginRequired: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Official site is JavaScript app-gated; verify account flow, upload terms, rights ownership and any regional/program-specific restrictions manually.',
    notes:
      'Public research verifies Amazing Radio as an active emerging-artist radio platform with artist upload history. No JS app interaction, sign-up or upload attempted.'
  },
  {
    name: 'TIDAL Upload Independent Artist Route',
    websiteUrl: 'https://tidal.com/',
    submissionUrl: 'https://tidal.com/',
    sourceUrl: 'https://tidal.com/',
    sourceType: 'automation_run_22_public_research',
    country: 'United States currently / potential future expansion',
    language: 'en',
    genres: ['electronic', 'dance', 'reggae', 'world', 'pop', 'hip-hop', 'independent'],
    submissionMethod: 'artist-upload-platform-route-needs-us-eligibility-ai-policy-and-rights-review',
    feeRequired: false,
    loginRequired: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Free upload route is reported as US-only and age-gated; TIDAL AI and royalty policies require manual rights, human/AI content and monetization review before use.',
    notes:
      'Current research flags a free self-upload route, no royalties for uploaded files, US 18+ limitation and AI-generated music policy changes. No account, upload or publishing action attempted.'
  },
  {
    name: 'Soundplate Free Spotify Deezer Playlist Submission Route',
    websiteUrl: 'https://play.soundplate.com/',
    submissionUrl: 'https://play.soundplate.com/',
    sourceUrl: 'https://play.soundplate.com/',
    sourceType: 'automation_run_22_public_research',
    country: 'United Kingdom / global independent playlist reach',
    language: 'en',
    genres: ['electronic', 'dance', 'house', 'techno', 'garage', 'bass', 'festival', 'disco'],
    submissionMethod: 'free-public-playlist-grid-select-and-form-route',
    feeRequired: false,
    loginRequired: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Free route, but each playlist must be matched manually to avoid spam and irrelevant submissions; inspect selected playlist form for CAPTCHA/login before queueing submit.',
    notes:
      'Official page says artists can submit to Spotify and Deezer playlists for free by selecting relevant playlists. No playlist selection or form submission attempted.'
  },
  {
    name: 'DailyPlaylists Standard Free Playlist Submission Route',
    websiteUrl: 'https://dailyplaylists.com/',
    submissionUrl: 'https://dailyplaylists.com/',
    sourceUrl: 'https://dailyplaylists.com/',
    sourceType: 'automation_run_22_public_research',
    country: 'Global playlist marketplace',
    language: 'en',
    genres: ['electronic', 'dance', 'reggae', 'world', 'pop', 'hip-hop', 'independent'],
    submissionMethod: 'free-standard-tier-playlist-marketplace-route-needs-login-track-link-and-curator-review',
    feeRequired: false,
    loginRequired: true,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Standard submissions are free but require sign-in, track lookup/link, curator matching, and premium/pro upsell separation before use.',
    notes:
      'Official page shows Standard Tier free submissions, 18,000+ playlists, pricing page, premium credits and info@dailyplaylists.com. No sign-in or submit action attempted.'
  }
];
