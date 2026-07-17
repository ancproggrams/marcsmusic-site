import type { PlatformInput } from '../models/types.js';

export const run450SeedPlatforms: PlatformInput[] = [
  {
    name: 'Wepa.Fm Royalty-Free Independent Music Email Submission Route',
    websiteUrl: 'https://wepa.fm/',
    submissionUrl: 'https://wepa.fm/independent-music-submission',
    sourceUrl: 'https://wepa.fm/independent-music-submission',
    sourceType: 'automation_run_450_public_research',
    country:
      'United States / Miami, Florida bilingual internet radio station with worldwide streaming and an independent-music mission; the submission page does not separately publish territorial eligibility rules',
    language: 'en/es',
    genres: [
      'independent-music',
      'bilingual-radio',
      'latin',
      'salsa',
      'freestyle',
      'merengue',
      'bachata',
      'house',
      'reggaeton',
      'disco',
      'pop',
      'clean-content-only',
      'royalty-free-license-required',
      'public-submission-email',
      'mp3-320kbps',
      'metadata-and-artwork-required',
      'free-first',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-public-email-with-mp3-320kbps-metadata-artwork-and-signed-royalty-free-license',
    feeRequired: false,
    feeAmount:
      'The dedicated submission page publishes a direct email route and does not state a submission fee, login, purchase or paid prerequisite.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The first-party route requires a completed and signed royalty-free licensing agreement and delivery by editorial email. The legal scope of the licence, territorial and term conditions, royalty waiver, ownership and authority to license, AI-assisted-music eligibility, exact genre fit, attachment size, number of tracks and international artist eligibility require human review. A human must select a clean format-compatible MarcsMusic track, verify the 320 kbps MP3 metadata and artwork, approve and execute the agreement, and send manually.',
    notes:
      'Verified on 2026-07-17 from Wepa.Fm’s first-party independent-music submission page, current homepage, about page, staff page and 2026 station content. The page asks independent artists or labels to email info@wepa.fm with a correctly tagged 320 kbps MP3 and artwork and to return a completed signed royalty-free licensing agreement. Explicit music is not accepted and tracks must fit the station format. The mailbox is published in plaintext on the first-party page and is syntactically, contextually and domain aligned. The staff page separately publishes jojeda@wepa.fm for the program/music director; that adjacent address is excluded because the dedicated submission page names info@wepa.fm as the canonical route. No agreement was downloaded or signed, and no email, attachment, account, login, CAPTCHA, payment or submission action was completed.'
  }
];
