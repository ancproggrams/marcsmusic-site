import type { PlatformInput } from '../models/types.js';

export const run463SeedPlatforms: PlatformInput[] = [
  {
    name: 'IndieMusicFans Worldwide Free Rock Radio Submission Form',
    websiteUrl: 'https://indiemusicfans.com/',
    submissionUrl: 'https://indiemusicfans.com/contact',
    sourceUrl: 'https://indiemusicfans.com/contact',
    sourceType: 'automation_run_463_public_research',
    country:
      'Worldwide independent-music radio submission route; the first-party page welcomes indie rock bands and artists worldwide',
    language: 'en',
    genres: [
      'independent-music',
      'indie-rock',
      'rock',
      'metal',
      'punk',
      'ska',
      'synthwave',
      'edm',
      'pop',
      'acoustic',
      'meta-tagged-mp3',
      'ai-disclosure',
      'streaming-permission',
      'public-form',
      'worldwide',
      'free-first',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-free-music-submission-page-with-embedded-online-form-for-radio-consideration',
    feeRequired: false,
    feeAmount:
      'The first-party page describes free music submission with no fees to get started.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The first-party page provides an embedded online form that was not passively field-inspected in this runtime. A human must verify the required fields, MP3 upload limits, CAPTCHA or login controls, privacy and streaming-permission terms, AI-disclosure eligibility, track suitability and rights status before completing the form manually.',
    notes:
      'Verified on 2026-07-17 from IndieMusicFans first-party contact/submission, station and about pages. The submission page welcomes artists worldwide, requests meta-tagged MP3 files, accepts Rock, Metal, Ska, Punk and Synth/EDM/Pop, requires disclosure of AI elements, states that artists retain their rights and grants the station permission to stream submitted tracks. The public otat247@gmail.com address is retained only as a fallback business-question contact because the page instructs music submitters to use the online form. No form was filled, no email was sent, no file was uploaded, no login was used, no CAPTCHA was solved and no payment or submission action was completed.'
  }
];
