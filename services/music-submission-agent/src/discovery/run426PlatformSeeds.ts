import type { PlatformInput } from '../models/types.js';
import { run427SeedPlatforms } from './run427PlatformSeeds.js';

export const run426SeedPlatforms: PlatformInput[] = [
  {
    name: 'WWPV 92.5 FM The Mike High-Quality WAV and Physical Music Submission Opportunity',
    websiteUrl: 'https://www.smcvt.edu/student-life/wwpv-92-5-fm-the-mike/',
    submissionUrl: 'mailto:wwpv925@gmail.com',
    sourceUrl: 'https://www.smcvt.edu/student-life/wwpv-92-5-fm-the-mike/',
    sourceType: 'automation_run_426_public_research',
    country:
      'United States / Colchester, Vermont non-profit student-run Saint Michael’s College low-power FM and online radio station; submissions are publicly accepted, but eligibility for artists based outside the United States is not explicitly published',
    language: 'en',
    genres: [
      'college-radio',
      'non-commercial-radio',
      'student-radio',
      'community-programming',
      'freeform',
      'independent-music',
      'indie',
      'jazz',
      'blues',
      'folk',
      'punk',
      'alternative',
      'high-quality-wav',
      'digital-email-submission',
      'physical-cd-or-record-alternative',
      'nacc',
      'radiofx',
      'spinitron',
      'no-visible-login-captcha-or-payment',
      'manual-review'
    ],
    submissionMethod:
      'official-first-party-public-email-for-high-quality-wav-digital-submissions-with-authorized-cd-or-record-physical-alternative',
    feeRequired: false,
    feeAmount:
      'The official Saint Michael’s College station page publishes digital and physical submission routes and does not state a fee, login or paid prerequisite.',
    loginRequired: false,
    captchaDetected: false,
    paymentRequired: false,
    manualReviewRequired: true,
    manualReviewReason:
      'WWPV publicly accepts high-quality WAV submissions through a first-party published Gmail mailbox and accepts CDs or records by mail, but does not publish attachment-size limits, exact WAV bit depth or sample rate, track-count or release-type rules, international eligibility, explicit-content and clean-edit policy, rights requirements, release-window expectations or an AI-assisted and AI-generated music policy. A human must select one suitable MarcsMusic release, inspect the exact master and metadata, confirm delivery mechanics and eligibility, verify rights and content suitability, choose one route, avoid duplicate servicing to staff or specialist contacts, and submit manually.',
    notes:
      'Verified on 2026-07-17 from Saint Michael’s College’s official WWPV page and WWPV’s current Spinitron surface. The official page says digital submissions should be high-quality WAV files and directs them to wwpv925@gmail.com; CDs and records are also accepted by mail and are not returned. The same page identifies the mailbox for general inquiries and music tracking, publishes current music-director contacts, provides live streams, states that WWPV airs music 24 hours a day and describes freeform programming including indie, jazz, blues, folk and punk. Current Spinitron pages expose upcoming and recent programmes. No email, WAV, attachment, link, physical package, phone call, form field, login, CAPTCHA or payment was submitted.'
  },
  ...run427SeedPlatforms
];
