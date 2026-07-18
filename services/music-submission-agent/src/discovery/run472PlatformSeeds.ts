import type { PlatformInput } from '../models/types.js';
import { run473SeedPlatforms } from './run473PlatformSeeds.js';

export const run472SeedPlatforms: PlatformInput[] = [
  {
    name: 'SoundChat Radio Global Caribbean Music Submission',
    websiteUrl: 'https://soundchatradio.com/',
    submissionUrl: 'https://soundchatradio.com/submit-music',
    sourceUrl: 'https://soundchatradio.com/submit-music',
    sourceType: 'automation_run_472_public_research',
    country:
      'United States (New York) and Jamaica; the first-party submission page explicitly promotes global exposure in more than 100 countries',
    language: 'en',
    genres: [
      'reggae',
      'dancehall',
      'soca',
      'caribbean',
      'world',
      'urban',
      'clean-radio',
      'track-link',
      'public-form',
      'broadcast-permission',
      'manual-review'
    ],
    submissionMethod:
      'official first-party public music-submission form using a SoundCloud, Spotify, YouTube or direct-download track link',
    feeRequired: false,
    feeAmount: 'The first-party page states that standard music submission is completely free.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The route is active, global-facing, free and genre-relevant, but clean-edit selection, metadata, biography, external-link permissions, composition/master/sample/contributor rights, broadcast authorization, unpublished AI eligibility, hidden form controls and the final submit action require human approval.',
    notes:
      'Passively verified on 2026-07-18 from first-party submission, schedule, live-radio, home and contact pages. SoundChat publishes a live weekly schedule, 24/7 streaming, current rotation and a story dated March 16, 2026. The form asks for artist name, email, track title, genre, a track link and artist/track information, and states that submission confirms rights ownership and grants broadcast permission. No form field was filled, no external link was submitted, no login was used, no CAPTCHA was solved and no payment or submission action was performed.'
  },
  {
    name: "All'It Radio Music Submission",
    websiteUrl: 'https://allitradio.com/',
    submissionUrl: 'https://forms.gle/efv6J4nT4gAWtac68',
    sourceUrl: 'https://allitradio.com/',
    sourceType: 'automation_run_472_public_research',
    country:
      'United States; the internet station broadcasts globally online, but the inspected first-party submission text does not explicitly confirm international-artist eligibility',
    language: 'en',
    genres: [
      'reggae',
      'hip-hop',
      'r-and-b',
      'urban',
      'independent',
      'one-track-only',
      'direct-audio-upload',
      'cover-art-upload',
      'google-form',
      'login-required',
      'audience-voting',
      'manual-review'
    ],
    submissionMethod:
      'official first-party route to an external Google Form requiring a Gmail account and direct track plus cover-art upload',
    feeRequired: false,
    feeAmount: 'No submission fee or payment step is published for the standard artist-submission route.',
    loginRequired: true,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The route requires a Gmail-authenticated external form, direct audio and cover-art uploads, broadcast authorization, social-follow confirmation and a fan-voting threshold before rotation. International and AI eligibility, Google form fields and consent text, hidden anti-abuse controls, media rights and every final action require human approval.',
    notes:
      'Passively verified on 2026-07-18 from the first-party home, submission, schedule and contact content. The station publishes active weekly shows and 24-hour Hip Hop, R&B and Reggae programming. It requests one downloadable 44.1 kHz 16-bit stereo MP3 or WAV, cover art and a Gmail account; selected tracks enter a one-week vote and require 100 valid-email votes plus following the station on Instagram or Facebook before regular rotation. The external forms.gle route returned 401 Unauthorized in this runtime and was not bypassed. No account was accessed, no form field was filled, no file or artwork was uploaded, no social follow was made, no vote was cast and no payment or submission action was performed.'
  },
  ...run473SeedPlatforms
];
