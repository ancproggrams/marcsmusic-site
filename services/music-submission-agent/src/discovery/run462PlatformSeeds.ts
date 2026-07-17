import type { PlatformInput } from '../models/types.js';
import { run463SeedPlatforms } from './run463PlatformSeeds.js';

export const run462SeedPlatforms: PlatformInput[] = [
  {
    name: 'JAM Audio Live Worldwide Independent Artist Google Form Submission Route',
    websiteUrl: 'https://jamaudio.live/',
    submissionUrl: 'https://jamaudio.live/artist-submissions',
    sourceUrl: 'https://jamaudio.live/artist-submissions',
    sourceType: 'automation_run_462_public_research',
    country:
      'Worldwide independent-music radio and artist-discovery platform; first-party pages state that artists from around the world are already in rotation',
    language: 'en',
    genres: [
      'independent-music',
      'underground-radio',
      'electronic',
      'dnb',
      'pop',
      'rock',
      'alternative',
      'hip-hop',
      'rap',
      'r-and-b',
      'metal',
      'indie',
      'experimental',
      'singer-songwriter',
      'all-genres',
      'working-streaming-link',
      'artist-bio',
      'rights-confirmation',
      'external-google-form',
      'worldwide',
      'free-first',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-submission-page-linking-to-external-google-form-for-human-reviewed-radio-rotation',
    feeRequired: false,
    feeAmount:
      'The standard submission page does not publish a submission fee. A separate optional premium spotlight is advertised elsewhere and is not required for the standard rotation-submission route.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The first-party page links to an external Google Form that could not be passively inspected in this runtime. A human must verify whether Google sign-in, CAPTCHA, file upload, consent, personal-data or payment fields appear; confirm the current AI-assisted-music policy; check ownership and permission to submit; select a working track link; and submit manually.',
    notes:
      'Verified on 2026-07-17 from JAM Audio Live’s first-party submission, homepage, about and current artist-spotlight pages. The platform states that submissions are open to independent artists from every genre for possible 24/7 live rotation, artist spotlights, charts, interviews and future broadcasts. It asks for a working Spotify, Apple Music, SoundCloud, YouTube, Bandcamp, Dropbox, Google Drive or direct music link; a short bio; origin; song context; an explicit-lyrics disclosure; and permission to submit. The submission buttons resolve to Google Form ID 1FAIpQLSfXuI50gVuW34PspgEayoaAl5Op9Fi3_gdc1W0IeNsmWhR8YA. The form itself was not fetched, no public submission email was retained, and no field, login, CAPTCHA, payment or submission action was attempted.'
  },
  ...run463SeedPlatforms
];
