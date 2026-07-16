import type { PlatformInput } from '../models/types.js';
import { run411SeedPlatforms } from './run411PlatformSeeds.js';

export const run410SeedPlatforms: PlatformInput[] = [
  {
    name: 'KZYX One-Selection Digital and Physical Music Submission Route',
    websiteUrl: 'https://www.kzyx.org/',
    submissionUrl: 'https://www.kzyx.org/how-to-submit-music',
    sourceUrl: 'https://www.kzyx.org/how-to-submit-music',
    sourceType: 'automation_run_410_public_research',
    country: 'United States / Mendocino County, California community radio with international eligibility not explicitly stated',
    language: 'en',
    genres: [
      'community-radio',
      'public-radio',
      'independent-music',
      'electronic',
      'edm',
      'reggae',
      'world-music',
      'latinx',
      'alternative',
      'groove',
      'cross-genre',
      'public-business-email',
      'authorized-digital-submission-route',
      'authorized-physical-submission-alternative',
      'single-selection-only',
      'streaming-link-or-wav',
      'dj-or-show-routing-requested',
      'capacity-gated',
      'international-eligibility-unconfirmed',
      'manual-review'
    ],
    submissionMethod: 'official-first-party-music-department-email-with-one-streaming-link-or-wav-selection-and-optional-physical-media',
    feeRequired: false,
    feeAmount:
      'KZYX publishes no submission fee, account login, CAPTCHA or mandatory payment for its email route. Digital email is free-first. Optional vinyl or CD production and postage remain sender costs.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'KZYX authorizes one musical selection by email to music@kzyx.org using either a streaming link or WAV file and requests a subject line naming a DJ, show or genre plus contact details, artist links, label or radio-promoter details, a short description and release date. A human must select exactly one suitable MarcsMusic track, identify genuinely relevant programmes, clarify the page’s unusual published WAV wording before attaching a file, confirm whether international artists are eligible, check current explicit-content, rights and AI-origin rules, and send manually. The optional vinyl/CD route is authorized but should not be used together with digital delivery unless intentionally approved.',
    notes:
      'Verified on 2026-07-16 from KZYX’s official How to Submit Music, homepage, staff and programme pages. The submission page publishes music@kzyx.org in plaintext, directs one musical selection to that mailbox, permits a streaming link or WAV file, requests DJ/show/genre routing in the subject and provides an optional physical address. The staff page identifies Katharine Cole as Music Director. Activity was supported by a live-radio surface, a July 9, 2026 newsletter, an August 30, 2026 station festival notice, current programme listings and playlist access. The mailbox was verified by first-party plaintext publication, explicit submission purpose, valid syntax and exact kzyx.org domain alignment; no SMTP, MX, catch-all, mailbox-level or deliverability probing was performed. No email, audio, link, physical package, form field, login, CAPTCHA, consent or payment was submitted.'
  },
  ...run411SeedPlatforms
];
