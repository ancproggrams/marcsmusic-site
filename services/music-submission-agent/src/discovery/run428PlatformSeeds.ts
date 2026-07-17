import type { PlatformInput } from '../models/types.js';

export const run428SeedPlatforms: PlatformInput[] = [
  {
    name: 'Owl Radio KSU Public MP3/WAV-or-Link Airplay Submission Form',
    websiteUrl: 'https://ksuradio.com/',
    submissionUrl:
      'https://owllife.kennesaw.edu/submitter/form/step/1?Guid=985dbf34-2c5d-4ef7-a2ff-da89e923b538',
    sourceUrl:
      'https://owllife.kennesaw.edu/submitter/form/step/1?Guid=985dbf34-2c5d-4ef7-a2ff-da89e923b538',
    sourceType: 'automation_run_428_public_research',
    country:
      'United States / Kennesaw, Georgia student-run Kennesaw State University streaming college-radio station; the official submission form says it accepts music from anyone with recordings, but country-specific and territorial conditions are not separately published',
    language: 'en',
    genres: [
      'college-radio',
      'student-radio',
      'streaming-radio',
      'independent-music',
      'underground-music',
      'indie',
      'jazz',
      'metal',
      'alternative',
      'eclectic',
      'mp3-or-wav-upload',
      'music-link-alternative',
      'artist-description',
      'public-multi-step-form',
      'free-first',
      'no-visible-login-or-payment-on-first-step',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-public-multi-step-airplay-form-with-mp3-or-wav-upload-or-music-link-alternative',
    feeRequired: false,
    feeAmount:
      'The official Kennesaw State submission form publishes a direct upload-or-link route and does not state a submission fee, account purchase or paid prerequisite.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'The public first step accepts an MP3 or WAV upload and/or music link and then continues through a Next control, but later-step fields, CAPTCHA or identity controls, upload-size limits, exact audio specifications, track-count rules, explicit-content policy, release-window requirements, rights declarations and the current AI-assisted or AI-generated music policy are not fully published in the accessible first-step content. A human must choose a suitable MarcsMusic track, inspect the exact master, link and metadata, verify the live multi-step form, confirm all later fields and declarations, avoid duplicate contact through adjacent general or staff mailboxes, and submit manually.',
    notes:
      'Verified on 2026-07-17 from the official Kennesaw State Owl Life music-submission form, Owl Radio site, weekly schedule, listen surface, current management page and KSU Student Media pages. The first-party form states that Owl Radio accepts music submissions from anyone with recordings and considers them for airplay. It requests artist name, artist email and a short artist or group description, and offers an MP3/WAV file upload and a music-link field before a Next step. The form also publishes owlradioksu@gmail.com specifically for follow-up on submitted music. Current station activity is supported by a live listen page, a populated weekly schedule, a current management roster, a current KSU organization page and 2026 station-related content. No field, file, link, email, login, CAPTCHA, payment or final submit action was completed.'
  }
];
