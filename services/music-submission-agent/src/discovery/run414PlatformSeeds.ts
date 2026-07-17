import type { PlatformInput } from '../models/types.js';
import { run415SeedPlatforms } from './run415PlatformSeeds.js';

export const run414SeedPlatforms: PlatformInput[] = [
  {
    name: 'Eagle Air Radio WINR Music Submission Email Opportunity',
    websiteUrl: 'https://www.winthrop.edu/cas/masscomm/untitled.aspx',
    submissionUrl: 'https://www.winthrop.edu/cas/masscomm/untitled.aspx',
    sourceUrl: 'https://www.winthrop.edu/cas/masscomm/untitled.aspx',
    sourceType: 'automation_run_414_public_research',
    country:
      'United States / Winthrop University online college radio in Rock Hill, South Carolina with worldwide streaming and international artist eligibility not explicitly stated',
    language: 'en',
    genres: [
      'college-radio',
      'student-radio',
      'independent-music',
      'popular-music',
      'electronic',
      'alternative',
      'reggae',
      'world-music',
      'bass-music',
      'cross-genre',
      'authorized-digital-submission-route',
      'public-business-email',
      'free-first',
      'asset-free-inquiry-first',
      'international-eligibility-unconfirmed',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-music-submission-email-with-asset-free-requirements-inquiry-before-audio-delivery',
    feeRequired: false,
    feeAmount:
      'Winthrop University publishes no submission fee, account login, CAPTCHA or mandatory payment for the Eagle Air music-submissions mailbox. Technical delivery requirements are not published.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'Winthrop University explicitly labels eagleairradio@gmail.com for music submissions, but does not publish accepted release types, attachment-versus-link instructions, audio formats, file-size limits, metadata, artwork, international eligibility, explicit-content rules, release timing, rights declarations or AI-origin policy. A human must first send a short asset-free requirements inquiry and must not attach audio or include private download links until Eagle Air confirms its current procedure.',
    notes:
      'Verified on 2026-07-17 from Winthrop University’s official Eagle Air Radio page. The page states that Eagle Air streams 24 hours a day, is available worldwide by web stream and TuneIn, features popular and college music spanning seven decades, identifies current staff and publishes eagleairradio@gmail.com specifically for music submissions. The page shows Last Updated: 3/30/26. No music-submission form, CAPTCHA, login or payment requirement was identified. No email, audio, attachment, link, form field, account or payment was submitted.'
  },
  ...run415SeedPlatforms
];
